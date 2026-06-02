"""Subprocess sandbox for executing user-supplied Python and SQL.

Public API: `runner.run_python(code, inputs)` and `runner.run_sql(query, inputs)`.

Both spawn `python -m engine.sandbox.worker` with rlimits, no network, and
a stripped environment. Input/output dataframes cross the boundary as
Parquet files in a temp directory the parent process creates and deletes.
"""
