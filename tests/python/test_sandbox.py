"""End-to-end tests for the subprocess sandbox.

Each test spawns the real worker via `runner.run_python` /
`runner.run_sql`, so the rlimits / network block / safe-builtins all
fire as they would in production.
"""
from __future__ import annotations

import os
import pytest
import pandas as pd

from engine.sandbox.runner import run_python, run_sql, SandboxError


@pytest.fixture
def small_df() -> pd.DataFrame:
    return pd.DataFrame({"x": [1, 2, 3, 4, 5], "y": [10, 20, 30, 40, 50]})


# ── Happy path ─────────────────────────────────────────────────────────────

def test_python_filter_round_trip(small_df: pd.DataFrame) -> None:
    out = run_python('result = df[df["x"] > 2]', [small_df])
    assert list(out["x"]) == [3, 4, 5]


def test_python_implicit_df_return(small_df: pd.DataFrame) -> None:
    out = run_python('df["z"] = df["x"] + df["y"]', [small_df])
    assert "z" in out.columns
    assert out["z"].iloc[0] == 11


def test_sql_aggregation(small_df: pd.DataFrame) -> None:
    out = run_sql("SELECT SUM(x) AS sx, AVG(y) AS ay FROM df", [small_df])
    assert out["sx"].iloc[0] == 15
    assert out["ay"].iloc[0] == 30.0


# ── Network is unavailable inside the sandbox ──────────────────────────────

def test_python_import_socket_blocked(small_df: pd.DataFrame) -> None:
    """`__import__` itself is gone; even if the user had it, the socket
    constructor raises."""
    with pytest.raises(SandboxError):
        run_python("__import__('socket')", [small_df])


def test_sql_external_csv_blocked(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError):
        run_sql("SELECT * FROM read_csv_auto('http://example.com/x.csv')", [small_df])


def test_sql_attach_external_db_blocked(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError):
        run_sql("ATTACH 'http://example.com/x.db' AS evil", [small_df])


# ── Process isolation ──────────────────────────────────────────────────────

def test_os_system_blocked(small_df: pd.DataFrame, tmp_path) -> None:
    """`os.system` would create this marker file. The sandbox must keep
    `__import__` out of reach so the call never lands."""
    marker = tmp_path / "pwned"
    code = f"__import__('os').system('touch {marker}')"
    with pytest.raises(SandboxError):
        run_python(code, [small_df])
    assert not marker.exists()


def test_open_blocked(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError):
        run_python('result = open("/etc/passwd").read()', [small_df])


def test_exec_blocked(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError):
        run_python('exec("import os; os.system(\'id\')")', [small_df])


def test_eval_blocked(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError):
        run_python('result = eval("1+1")', [small_df])


# ── Resource limits ────────────────────────────────────────────────────────

def test_infinite_loop_killed_by_timeout(small_df: pd.DataFrame) -> None:
    with pytest.raises(SandboxError) as exc:
        run_python("while True: pass", [small_df], timeout_s=2)
    # Either CPU rlimit, wall-clock timeout, or "no response" — all fine.
    assert "timeout" in str(exc.value).lower() or "no response" in str(exc.value).lower() or "memory" in str(exc.value).lower()


def test_memory_limit_blocks_huge_allocation(small_df: pd.DataFrame) -> None:
    # 1.5 GB allocation attempt under a 1 GiB RLIMIT_AS — should fail.
    with pytest.raises(SandboxError):
        run_python('result = pd.DataFrame({"a": [0] * 200_000_000})', [small_df])


# ── Multiple inputs to SQL ────────────────────────────────────────────────

def test_sql_joins_multiple_inputs() -> None:
    a = pd.DataFrame({"id": [1, 2, 3], "name": ["a", "b", "c"]})
    b = pd.DataFrame({"id": [1, 2, 3], "val": [10, 20, 30]})
    out = run_sql(
        "SELECT a.name, b.val FROM input_data a JOIN input_1 b ON a.id = b.id",
        [a, b],
    )
    assert len(out) == 3
    assert set(out.columns) == {"name", "val"}


# ── Empty / edge inputs ────────────────────────────────────────────────────

def test_empty_code_returns_first_input_via_handler(small_df: pd.DataFrame) -> None:
    # `runner._run` rejects empty code explicitly. The handler shim
    # short-circuits before calling, but at the runner layer we get a
    # SandboxError.
    with pytest.raises(SandboxError):
        run_python("", [small_df])


def test_script_without_result_raises(small_df: pd.DataFrame) -> None:
    # The default-bound `df` is a DataFrame, so the script falls back to
    # returning that. Replacing `df` with a non-DataFrame should fail.
    with pytest.raises(SandboxError):
        run_python("df = 42", [small_df])
