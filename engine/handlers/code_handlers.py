import ast
import pandas as pd
import numpy as np
import logging
import io
import sys
import traceback
from engine.handlers.registry import register

logger = logging.getLogger('engine')


# ── AST-based sandbox validation ─────────────────────────────────────────────
# A textual blocklist (the previous approach) is trivially bypassed with
# whitespace, aliasing, or string tricks. Validating the *parsed* AST is far
# harder to evade: we reject the language features that enable sandbox escape
# regardless of how they are spelled.
_FORBIDDEN_NAMES = {
    'eval', 'exec', 'compile', '__import__', 'globals', 'locals', 'vars',
    'getattr', 'setattr', 'delattr', 'open', 'input', 'breakpoint',
    'memoryview', 'classmethod', 'staticmethod', 'super', 'exit', 'quit',
    'help', 'dir',
}


def _validate_ast(code: str) -> None:
    """Parse `code` and reject constructs that enable sandbox escape.

    Bans: any import, attribute access to dunder names (``__class__``,
    ``__globals__`` …), calls to forbidden builtins, and `with`/`global`/
    `nonlocal` statements. Raises ValueError on the first violation.
    """
    try:
        tree = ast.parse(code, mode='exec')
    except SyntaxError as e:
        raise ValueError(f"Python script syntax error: {e}")

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise ValueError("import statements are not allowed for security reasons")
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            raise ValueError("global/nonlocal statements are not allowed")
        if isinstance(node, ast.Attribute) and node.attr.startswith('__'):
            raise ValueError(f"access to dunder attribute '{node.attr}' is not allowed")
        if isinstance(node, ast.Name) and node.id in _FORBIDDEN_NAMES:
            raise ValueError(f"use of '{node.id}' is not allowed for security reasons")


@register('python_script')
def handle_python_script(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Python Script requires upstream data")
    
    code = node_data.get('code', '')
    if not code.strip():
        return upstream_data[0]
    
    df = upstream_data[0].copy()
    
    import builtins as _builtins
    safe_builtins = {
        'abs': _builtins.abs, 'all': _builtins.all, 'any': _builtins.any,
        'bool': _builtins.bool, 'dict': _builtins.dict, 'enumerate': _builtins.enumerate,
        'filter': _builtins.filter, 'float': _builtins.float, 'format': _builtins.format,
        'frozenset': _builtins.frozenset, 'hasattr': _builtins.hasattr,
        'hash': _builtins.hash, 'int': _builtins.int, 'isinstance': _builtins.isinstance,
        'issubclass': _builtins.issubclass, 'iter': _builtins.iter, 'len': _builtins.len,
        'list': _builtins.list, 'map': _builtins.map, 'max': _builtins.max, 'min': _builtins.min,
        'next': _builtins.next, 'object': _builtins.object, 'pow': _builtins.pow,
        'print': _builtins.print, 'range': _builtins.range, 'repr': _builtins.repr,
        'reversed': _builtins.reversed, 'round': _builtins.round, 'set': _builtins.set,
        'slice': _builtins.slice, 'sorted': _builtins.sorted, 'str': _builtins.str,
        'sum': _builtins.sum, 'tuple': _builtins.tuple, 'type': _builtins.type,
        'zip': _builtins.zip, 'True': True, 'False': False, 'None': None,
        'ValueError': ValueError, 'TypeError': TypeError, 'KeyError': KeyError,
        'IndexError': IndexError, 'Exception': Exception, 'RuntimeError': RuntimeError,
    }
    
    namespace = {
        '__builtins__': safe_builtins,
        'df': df,
        'pd': pd,
        'np': np,
        'input_data': df,
        'result': None,
    }
    
    # Primary gate: reject unsafe constructs in the parsed AST (bypass-resistant).
    _validate_ast(code)

    old_stdout = sys.stdout
    captured = io.StringIO()
    sys.stdout = captured
    
    try:
        exec(code, namespace)
    except Exception as e:
        sys.stdout = old_stdout
        raise ValueError(f"Python script error: {e}\n{traceback.format_exc()}")
    finally:
        sys.stdout = old_stdout
    
    output = captured.getvalue()
    if output:
        logger.info(f"Python Script stdout: {output[:500]}")
    
    if namespace.get('result') is not None:
        result = namespace['result']
        if isinstance(result, pd.DataFrame):
            return result
        else:
            raise ValueError("'result' variable must be a pandas DataFrame")
    
    if isinstance(namespace.get('df'), pd.DataFrame):
        return namespace['df']
    
    return df


@register('sql_transform')
def handle_sql_transform(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("SQL Transform requires upstream data")
    
    query = node_data.get('query') or node_data.get('sqlQuery', '')
    if not query.strip():
        return upstream_data[0]
    
    try:
        import duckdb
    except ImportError:
        raise ValueError("DuckDB is required for SQL transforms. Install with: pip install duckdb")
    
    con = duckdb.connect(':memory:')
    
    try:
        for i, df in enumerate(upstream_data):
            table_name = f'input_{i}' if i > 0 else 'input_data'
            con.register(table_name, df)

        if len(upstream_data) == 1:
            con.register('df', upstream_data[0])
            # 'input_table' is the name the preview SQL editor uses
            con.register('input_table', upstream_data[0])
        
        result = con.execute(query).fetchdf()
        logger.info(f"SQL Transform: query returned {len(result)} rows × {len(result.columns)} cols")
        return result
    
    except Exception as e:
        raise ValueError(f"SQL query error: {e}")
    
    finally:
        con.close()
