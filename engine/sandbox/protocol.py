"""Sandbox IPC protocol — Pydantic-style dataclasses + JSON helpers.

Kept dependency-free so the worker can import this with the minimum
possible footprint before any user code runs.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Literal, Optional


@dataclass
class SandboxRequest:
    kind: Literal["python", "sql"]
    # User-supplied code. Length bounded by the route-level Zod schemas
    # (20k for python, 10k for SQL) and re-asserted in the worker.
    code: str
    # Absolute paths to Parquet files holding the input dataframes. For
    # SQL the worker registers them as `input_data` (alias `df`) and
    # `input_1`, `input_2`, …. For Python the first input is bound to
    # both `df` and `input_data` in the user namespace.
    inputs: list[str] = field(default_factory=list)
    # Where to write the result Parquet. The parent creates the temp dir
    # so this path is guaranteed unique and inside a writable scratch.
    output: str = ""
    # Per-request time budget in seconds. The parent enforces a hard wall
    # clock with `subprocess.run(..., timeout=)`; the child still sets
    # RLIMIT_CPU to the same value as a defense-in-depth fallback.
    timeout_s: int = 60
    # Soft memory cap in bytes for the child process (RLIMIT_AS).
    memory_bytes: int = 1 << 30  # 1 GiB

    @classmethod
    def from_json(cls, s: str) -> "SandboxRequest":
        data = json.loads(s)
        return cls(
            kind=data["kind"],
            code=data["code"],
            inputs=list(data.get("inputs", [])),
            output=data.get("output", ""),
            timeout_s=int(data.get("timeout_s", 60)),
            memory_bytes=int(data.get("memory_bytes", 1 << 30)),
        )

    def to_json(self) -> str:
        return json.dumps(asdict(self))


@dataclass
class SandboxResponse:
    ok: bool
    error: Optional[str] = None
    stdout: str = ""
    rows: int = 0
    cols: int = 0

    @classmethod
    def from_json(cls, s: str) -> "SandboxResponse":
        data = json.loads(s)
        return cls(
            ok=bool(data.get("ok", False)),
            error=data.get("error"),
            stdout=data.get("stdout", ""),
            rows=int(data.get("rows", 0)),
            cols=int(data.get("cols", 0)),
        )

    def to_json(self) -> str:
        return json.dumps(asdict(self))


# Hard caps re-enforced in the worker even if the parent passed something
# more permissive. The parent should also reject these earlier (Zod), but
# defense in depth.
MAX_PYTHON_CODE_LEN = 20_000
MAX_SQL_QUERY_LEN = 10_000
