import pandas as pd
import numpy as np
import logging
import io
import sys
import traceback
from engine.handlers.registry import register

logger = logging.getLogger('engine')


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
    
    blocked_patterns = [
        'import os', 'import sys', 'import subprocess', 'import shutil',
        'import pathlib', 'import socket', 'import http', 'import urllib',
        'import requests', 'import importlib', 'import ctypes', 'import signal',
        'from os', 'from sys', 'from subprocess', 'from shutil',
        'from pathlib', 'from socket', 'from http', 'from urllib',
        'from requests', 'from importlib', 'from ctypes', 'from signal',
        '__import__', 'eval(', 'exec(', 'compile(', 'globals(', 'locals(',
        'open(', 'getattr(', '__subclasses__', '__bases__', '__class__',
    ]
    
    code_lower = code.lower()
    for pattern in blocked_patterns:
        if pattern.lower() in code_lower:
            raise ValueError(f"'{pattern.strip()}' is not allowed for security reasons")
    
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
