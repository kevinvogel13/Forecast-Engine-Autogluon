"""Sandbox runner — parent-side glue around `engine.sandbox.worker`.

`run_python(code, inputs)` and `run_sql(query, inputs)` are the only
intended entry points. Both take a list of pandas DataFrames as input
and return a DataFrame (or raise).
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Sequence

import pandas as pd

from engine.sandbox.protocol import SandboxRequest, SandboxResponse

logger = logging.getLogger("engine")


class SandboxError(RuntimeError):
    """Raised when the sandbox refuses or aborts a request."""


def _run(kind: str, code: str, inputs: Sequence[pd.DataFrame], timeout_s: int) -> pd.DataFrame:
    if not code or not code.strip():
        raise SandboxError("Empty code/query")

    workdir = tempfile.mkdtemp(prefix="sandbox-host-")
    input_paths: list[str] = []
    try:
        for i, df in enumerate(inputs):
            p = os.path.join(workdir, f"input_{i}.parquet")
            df.to_parquet(p, index=False)
            input_paths.append(p)
        output_path = os.path.join(workdir, "output.parquet")

        req = SandboxRequest(
            kind=kind,
            code=code,
            inputs=input_paths,
            output=output_path,
            timeout_s=timeout_s,
        )

        # Minimal env. The worker re-strips again as defense in depth.
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "PYTHONPATH": os.environ.get("PYTHONPATH", ""),
            "PYTHONIOENCODING": "utf-8",
        }
        # `start_new_session=True` so the worker becomes a process-group leader
        # and Ctrl-C in the parent doesn't propagate.
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "engine.sandbox.worker"],
                input=req.to_json(),
                capture_output=True,
                text=True,
                timeout=timeout_s,
                env=env,
                check=False,
                start_new_session=True,
            )
        except subprocess.TimeoutExpired:
            raise SandboxError(f"Sandbox exceeded {timeout_s}s timeout")

        # The worker writes a JSON response even on error paths. If stdout
        # is empty something catastrophic happened (rlimit-killed before
        # writing, segfault, etc) — surface stderr.
        if not proc.stdout.strip():
            stderr_tail = (proc.stderr or "").splitlines()[-5:]
            raise SandboxError(
                f"Sandbox produced no response (rc={proc.returncode}): {' | '.join(stderr_tail)}"
            )

        resp = SandboxResponse.from_json(proc.stdout)
        if resp.stdout:
            logger.info("sandbox stdout: %s", resp.stdout[:1000])
        if not resp.ok:
            raise SandboxError(resp.error or "Sandbox reported failure")

        return pd.read_parquet(output_path)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def run_python(code: str, inputs: Sequence[pd.DataFrame], timeout_s: int = 60) -> pd.DataFrame:
    return _run("python", code, inputs, timeout_s)


def run_sql(query: str, inputs: Sequence[pd.DataFrame], timeout_s: int = 60) -> pd.DataFrame:
    return _run("sql", query, inputs, timeout_s)
