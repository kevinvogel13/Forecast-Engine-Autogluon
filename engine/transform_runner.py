"""Stdin-driven transform runner for the Node server's preview endpoints.

Previously ``server/routes.ts`` built Python source by *string-interpolating*
the user's SQL query / Python code into a script template and running it with
``python3 -c``.  A query containing ``\"\"\"`` or a backslash could break out of
the string literal and execute arbitrary Python (and DuckDB can read the local
filesystem), so the preview endpoints were a code-injection vector.

This module removes that vector: the server sends a single JSON job on stdin —

    {"records": [...], "op": "python"|"sql"|"filter"|"sampling", "data": ...}

— and we run it through the *same* sandboxed engine handlers the pipeline uses.
The user's code/query is treated purely as data; it is never concatenated into
this file's source.  Output is JSON on stdout: ``{"data": [...]}`` or
``{"error": "..."}`` with a non-zero exit code.
"""
import json
import sys

import pandas as pd

from engine.handlers.code_handlers import handle_python_script, handle_sql_transform
from engine.handlers.data_handlers import handle_filter
from engine.handlers.prep_handlers import handle_sampling


def _rewrite_returns(code: str) -> str:
    """The preview editor lets users write top-level ``return <expr>``.  The
    sandbox executes module-level code (no function), so translate those into an
    assignment to ``result`` — the variable handle_python_script returns."""
    out = []
    for line in (code or '').split('\n'):
        stripped = line.strip()
        if stripped.startswith('return '):
            indent = line[:len(line) - len(line.lstrip())]
            out.append(f'{indent}result = {stripped[len("return "):].strip()}')
        else:
            out.append(line)
    return '\n'.join(out)


def run(job: dict) -> dict:
    records = job.get('records', []) or []
    op = job.get('op')
    data = job.get('data')
    df = pd.DataFrame(records)

    if op == 'python':
        df = handle_python_script({'code': _rewrite_returns(data or '')}, [df])
    elif op == 'sql':
        df = handle_sql_transform({'query': data or ''}, [df])
    elif op == 'filter':
        df = handle_filter(data if isinstance(data, dict) else {}, [df])
    elif op == 'sampling':
        d = data if isinstance(data, dict) else {}
        df = handle_sampling({
            'samplingColumn': d.get('column', ''),
            'samplePercent': d.get('percent', 100),
            'samplingSeed': d.get('seed', 42),
        }, [df])
    else:
        raise ValueError(f"Unknown transform op: {op}")

    return {'data': json.loads(df.to_json(orient='records', date_format='iso'))}


def main():
    try:
        job = json.loads(sys.stdin.read() or '{}')
        sys.stdout.write(json.dumps(run(job)))
    except Exception as e:  # noqa: BLE001 — surface any handler error to the caller
        sys.stdout.write(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
