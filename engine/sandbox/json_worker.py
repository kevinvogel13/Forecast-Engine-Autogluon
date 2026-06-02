"""JSON-IO sandbox worker for the Node-side preview/transform routes.

Same sandboxing primitives as `worker.py` (rlimits + network block +
safe builtins + tmpdir + stripped env) but exchanges records as JSON on
stdin/stdout instead of Parquet via on-disk paths, which is what the
existing TypeScript callers in `server/routes.ts` already speak.

Protocol:
  request  = {"kind": "python"|"sql", "code": "...", "data": [ {col: val, ...} ], "timeout_s"?: int, "memory_bytes"?: int}
  response = {"ok": true,  "data": [ {col: val, ...} ]}
           | {"ok": false, "error": "..."}
"""
from __future__ import annotations

import io
import json
import os
import resource
import socket
import ssl  # noqa: F401  — keep ssl init ahead of network patch
import sys
import tempfile
import traceback
from contextlib import redirect_stdout

import pandas as pd  # noqa: E402
import numpy as np  # noqa: E402
import pyarrow  # noqa: F401, E402
import duckdb  # noqa: E402

# Reuse the safe-builtins set and OS-level guards from the parquet worker
# so any future change applies to both protocols at once.
from engine.sandbox.worker import (  # noqa: E402
    _safe_builtins,
    _apply_rlimits,
    _disable_network,
    _isolate_filesystem,
)
from engine.sandbox.protocol import MAX_PYTHON_CODE_LEN, MAX_SQL_QUERY_LEN  # noqa: E402


def _df_from_records(data) -> pd.DataFrame:
    if not isinstance(data, list):
        raise ValueError("`data` must be a JSON array of row objects")
    return pd.DataFrame(data)


def _records_from_df(df: pd.DataFrame):
    # Strings keep their type, dates/Timestamps stringify, NaN → None.
    return json.loads(df.to_json(orient="records", date_format="iso"))


def _run_python(code: str, df: pd.DataFrame) -> pd.DataFrame:
    if len(code) > MAX_PYTHON_CODE_LEN:
        raise ValueError(f"Python code exceeds {MAX_PYTHON_CODE_LEN} chars")

    namespace: dict = {
        "__builtins__": _safe_builtins(),
        "pd": pd,
        "np": np,
        "df": df,
        "input_df": df,
        "input_data": df,
        "result_df": None,
        "result": None,
    }
    captured = io.StringIO()
    with redirect_stdout(captured):
        exec(compile(code, "<sandbox-json>", "exec"), namespace)

    # Truthiness checks on DataFrames raise; pick the first non-None binding.
    for name in ("result_df", "result", "df"):
        val = namespace.get(name)
        if val is not None:
            if not isinstance(val, pd.DataFrame):
                raise ValueError(f"`{name}` must be a pandas.DataFrame")
            return val
    raise ValueError("Script must leave a pandas.DataFrame in `result_df`, `result`, or `df`")


def _run_sql(query: str, df: pd.DataFrame) -> pd.DataFrame:
    if len(query) > MAX_SQL_QUERY_LEN:
        raise ValueError(f"SQL query exceeds {MAX_SQL_QUERY_LEN} chars")

    # Normalise string-like columns to numpy `object` so DuckDB doesn't
    # choke on pandas StringDtype (mirrors the previous inline behaviour).
    for col in df.columns:
        if str(df[col].dtype).startswith(("string", "object", "str")):
            df[col] = df[col].astype(object)

    con = duckdb.connect(":memory:")
    try:
        try:
            con.execute("SET enable_external_access = false")
        except Exception:
            pass
        # Match the parquet worker — one DuckDB thread inside the
        # sandboxed RLIMIT_NOFILE / NPROC envelope.
        try:
            con.execute("SET threads = 1")
        except Exception:
            pass
        con.register("input_table", df)
        con.register("df", df)
        return con.execute(query).fetchdf()
    finally:
        con.close()


def main() -> int:
    raw = sys.stdin.read()
    try:
        req = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON request: {e}"}))
        return 1

    kind = req.get("kind")
    code = req.get("code", "")
    data = req.get("data", [])
    timeout_s = int(req.get("timeout_s", 60))
    memory_bytes = int(req.get("memory_bytes", 1 << 30))

    # Lock down BEFORE the dataframe is materialised. pandas DataFrame
    # construction itself doesn't need network / fs access.
    _isolate_filesystem()
    _disable_network()
    _apply_rlimits(memory_bytes, max(1, timeout_s))

    try:
        df = _df_from_records(data)
        if kind == "python":
            out = _run_python(code, df)
        elif kind == "sql":
            out = _run_sql(code, df)
        else:
            raise ValueError(f"Unknown kind: {kind!r}")
        print(json.dumps({"ok": True, "data": _records_from_df(out)}))
        return 0
    except MemoryError:
        print(json.dumps({"ok": False, "error": "Sandbox exceeded memory limit"}))
        return 1
    except Exception as e:
        # Don't leak stack frames to the user; log a tail to stderr for
        # the host so production logs still show what happened.
        sys.stderr.write(traceback.format_exc()[-4000:])
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
