"""Sandbox worker — runs as a child process spawned by `runner.py`.

This file applies OS-level resource limits and a Python-level safe
`__builtins__` BEFORE the user code is exec'd. The order matters: rlimits
go down first so even import-time hooks can't bypass them.

Invocation: `python -m engine.sandbox.worker` with the request JSON on
stdin and the response JSON written to stdout. stderr is reserved for
the worker's own diagnostics (forwarded to the parent's logger).
"""
from __future__ import annotations

import io
import os
import resource
import socket
import ssl  # noqa: F401  — pre-import so the network patch doesn't break it later
import sys
import tempfile
import traceback
from contextlib import redirect_stdout

# Pre-import the heavy data libraries at module load time. pyarrow lazily
# imports `ssl`, which subclasses `socket.socket`. If we patched `socket`
# first and triggered the import later (via `pd.read_parquet`), Python
# would see the patched `socket.socket` (a function) as a base class and
# raise "function() argument 'code' must be code, not str". Importing here
# keeps the real `socket.socket` in ssl's closure.
import pandas as pd  # noqa: E402
import numpy as np  # noqa: E402
import pyarrow  # noqa: F401, E402  — force ssl init
import duckdb  # noqa: E402

from engine.sandbox.protocol import (  # noqa: E402
    SandboxRequest,
    SandboxResponse,
    MAX_PYTHON_CODE_LEN,
    MAX_SQL_QUERY_LEN,
)


# Python builtins that are safe to expose to user code. The set is
# intentionally small: no `open`, no `eval`/`exec`/`compile`, no
# `__import__`, no `getattr`/`setattr` (which can be used to walk class
# trees and find io classes). NB: even with builtins stripped, a hostile
# user could try to escape via dunder traversal on already-bound objects;
# the OS-level rlimits and network block are the real defense.
def _safe_builtins() -> dict:
    import builtins as _b
    safe = {
        "abs": _b.abs, "all": _b.all, "any": _b.any, "ascii": _b.ascii,
        "bin": _b.bin, "bool": _b.bool, "bytes": _b.bytes, "callable": _b.callable,
        "chr": _b.chr, "complex": _b.complex, "dict": _b.dict, "divmod": _b.divmod,
        "enumerate": _b.enumerate, "filter": _b.filter, "float": _b.float,
        "format": _b.format, "frozenset": _b.frozenset, "hasattr": _b.hasattr,
        "hash": _b.hash, "hex": _b.hex, "int": _b.int, "isinstance": _b.isinstance,
        "issubclass": _b.issubclass, "iter": _b.iter, "len": _b.len, "list": _b.list,
        "map": _b.map, "max": _b.max, "min": _b.min, "next": _b.next,
        "object": _b.object, "oct": _b.oct, "ord": _b.ord, "pow": _b.pow,
        "print": _b.print, "range": _b.range, "repr": _b.repr,
        "reversed": _b.reversed, "round": _b.round, "set": _b.set,
        "slice": _b.slice, "sorted": _b.sorted, "str": _b.str, "sum": _b.sum,
        "tuple": _b.tuple, "type": _b.type, "zip": _b.zip,
        "True": True, "False": False, "None": None,
        "ValueError": ValueError, "TypeError": TypeError, "KeyError": KeyError,
        "IndexError": IndexError, "Exception": Exception, "RuntimeError": RuntimeError,
        "ZeroDivisionError": ZeroDivisionError, "ArithmeticError": ArithmeticError,
        "AttributeError": AttributeError, "StopIteration": StopIteration,
    }
    return safe


def _apply_rlimits(memory_bytes: int, cpu_seconds: int) -> None:
    """Lock down resource usage before user code runs.

    These limits apply to the whole child process. Going over RLIMIT_AS
    causes allocations to fail with MemoryError; going over RLIMIT_CPU
    sends SIGXCPU (which we don't handle, so the process dies).
    """
    # Address space — soft and hard both set to the same value so user
    # code can't raise the limit. Includes mmaps and the heap.
    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    # CPU seconds — wall clock is enforced by the parent's
    # `subprocess.run(timeout=)`. This catches CPU-burn before the wall
    # clock fires.
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
    # File descriptor count — pandas/parquet need a handful; 64 is plenty
    # and stops fd-exhaustion attacks.
    try:
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    except (ValueError, OSError):
        # Hard limit may already be lower; not worth aborting over.
        pass
    # Max bytes any single file can grow to (limits parquet output too).
    resource.setrlimit(resource.RLIMIT_FSIZE, (256 << 20, 256 << 20))


def _disable_network() -> None:
    """Make the network unavailable to user code.

    We don't have a kernel namespace, so we monkey-patch the socket
    constructor. AF_UNIX is also blocked since DuckDB / pandas don't
    need it but it could connect to local services.
    """
    def _block(*_args, **_kwargs):
        raise PermissionError("Network access is disabled in the sandbox")

    socket.socket = _block  # type: ignore[assignment]
    if hasattr(socket, "create_connection"):
        socket.create_connection = _block  # type: ignore[assignment]


def _isolate_filesystem() -> str:
    """Move the process into a fresh, empty temp directory and clamp the
    environment to a minimum. Returns the chosen tmpdir.
    """
    tmp = tempfile.mkdtemp(prefix="sandbox-")
    os.chdir(tmp)
    # Strip env. Keep only what python actually needs to import.
    keep = {"PATH", "PYTHONPATH", "PYTHONIOENCODING", "LANG", "LC_ALL"}
    for k in list(os.environ):
        if k not in keep:
            os.environ.pop(k, None)
    os.environ["HOME"] = tmp
    os.environ["TMPDIR"] = tmp
    return tmp


def _run_python(req: SandboxRequest) -> SandboxResponse:
    if len(req.code) > MAX_PYTHON_CODE_LEN:
        return SandboxResponse(ok=False, error=f"Python code exceeds {MAX_PYTHON_CODE_LEN} chars")

    inputs = [pd.read_parquet(p) for p in req.inputs]
    df = inputs[0] if inputs else pd.DataFrame()

    namespace: dict = {
        "__builtins__": _safe_builtins(),
        "pd": pd,
        "np": np,
        "df": df,
        "input_data": df,
        "inputs": inputs,
        "result": None,
    }

    captured = io.StringIO()
    try:
        with redirect_stdout(captured):
            exec(compile(req.code, "<sandbox>", "exec"), namespace)
    except MemoryError:
        return SandboxResponse(ok=False, error="Sandbox exceeded memory limit")
    except Exception as e:
        return SandboxResponse(
            ok=False,
            error=f"{type(e).__name__}: {e}",
            stdout=captured.getvalue(),
        )

    result = namespace.get("result")
    if result is None:
        result = namespace.get("df")
    if not isinstance(result, pd.DataFrame):
        return SandboxResponse(
            ok=False,
            error="Script must leave a pandas.DataFrame in `result` or `df`",
            stdout=captured.getvalue(),
        )

    result.to_parquet(req.output, index=False)
    return SandboxResponse(
        ok=True,
        stdout=captured.getvalue(),
        rows=int(len(result)),
        cols=int(len(result.columns)),
    )


def _run_sql(req: SandboxRequest) -> SandboxResponse:
    if len(req.code) > MAX_SQL_QUERY_LEN:
        return SandboxResponse(ok=False, error=f"SQL query exceeds {MAX_SQL_QUERY_LEN} chars")

    con = duckdb.connect(":memory:")
    try:
        # Block DuckDB's filesystem and network access. `enable_external_access=false`
        # stops `READ_CSV('http://...')`, `COPY ... TO 'file'`, attach, etc.
        try:
            con.execute("SET enable_external_access = false")
        except Exception:
            pass
        for i, p in enumerate(req.inputs):
            frame = pd.read_parquet(p)
            con.register("input_data" if i == 0 else f"input_{i}", frame)
            if i == 0:
                con.register("df", frame)
        result = con.execute(req.code).fetchdf()
        result.to_parquet(req.output, index=False)
        return SandboxResponse(ok=True, rows=int(len(result)), cols=int(len(result.columns)))
    except MemoryError:
        return SandboxResponse(ok=False, error="Sandbox exceeded memory limit")
    except Exception as e:
        return SandboxResponse(ok=False, error=f"{type(e).__name__}: {e}")
    finally:
        con.close()


def main() -> int:
    raw = sys.stdin.read()
    try:
        req = SandboxRequest.from_json(raw)
    except Exception as e:
        sys.stdout.write(SandboxResponse(ok=False, error=f"Invalid request: {e}").to_json())
        return 1

    _isolate_filesystem()
    _disable_network()
    _apply_rlimits(req.memory_bytes, max(1, req.timeout_s))

    try:
        if req.kind == "python":
            resp = _run_python(req)
        elif req.kind == "sql":
            resp = _run_sql(req)
        else:
            resp = SandboxResponse(ok=False, error=f"Unknown kind: {req.kind!r}")
    except Exception as e:  # last-resort catch-all
        resp = SandboxResponse(ok=False, error=f"Sandbox worker crashed: {e}\n{traceback.format_exc()}")

    sys.stdout.write(resp.to_json())
    sys.stdout.flush()
    return 0 if resp.ok else 1


if __name__ == "__main__":
    sys.exit(main())
