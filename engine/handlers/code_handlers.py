"""Handlers for user-supplied Python and SQL pipeline nodes.

Execution happens in a subprocess via `engine.sandbox.runner` so the
user code runs under OS-level resource limits with no network and no
filesystem visibility outside its own tmpdir. Previous versions exec'd
user code in-process behind a lowercased-substring blocklist, which was
trivial to bypass (e.g. `__import__('o' + 's')`).
"""
from __future__ import annotations

import logging

from engine.handlers.registry import register
from engine.sandbox.runner import run_python, run_sql, SandboxError

logger = logging.getLogger("engine")


@register("python_script")
def handle_python_script(node_data: dict, upstream_data: list, **_kwargs):
    if not upstream_data:
        raise ValueError("Python Script requires upstream data")
    code = (node_data.get("code") or "").strip()
    if not code:
        return upstream_data[0]
    try:
        return run_python(code, list(upstream_data))
    except SandboxError as e:
        raise ValueError(f"Python script error: {e}") from e


@register("sql_transform")
def handle_sql_transform(node_data: dict, upstream_data: list, **_kwargs):
    if not upstream_data:
        raise ValueError("SQL Transform requires upstream data")
    query = (node_data.get("query") or node_data.get("sqlQuery") or "").strip()
    if not query:
        return upstream_data[0]
    try:
        return run_sql(query, list(upstream_data))
    except SandboxError as e:
        raise ValueError(f"SQL query error: {e}") from e
