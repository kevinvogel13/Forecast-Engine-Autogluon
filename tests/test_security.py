"""Security/robustness tests for the sandboxed code handlers and calculated columns."""
import pandas as pd
import pytest

from engine.handlers import code_handlers as C
from engine.handlers import prep_handlers as P


@pytest.fixture
def df():
    return pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})


# ── Python script sandbox (AST validation) ───────────────────────────────────
def test_python_script_allows_safe_transform(df):
    out = C.handle_python_script({'code': 'df["c"] = df["a"] + df["b"]\nresult = df'}, [df])
    assert list(out['c']) == [5, 7, 9]


@pytest.mark.parametrize('code', [
    'import os',
    'from sys import argv',
    'x = (1).__class__.__bases__',
    'y = ().__class__.__mro__',
    'getattr(df, "to_csv")("/tmp/x")',
    'eval("1+1")',
    'exec("x=1")',
    '__import__("os").system("echo hi")',
    'global df',
])
def test_python_script_blocks_escape_attempts(df, code):
    with pytest.raises(ValueError):
        C.handle_python_script({'code': code}, [df])


def test_python_script_blocks_obfuscated_dunder(df):
    # textual blocklist would miss this spacing; AST catches the attribute
    with pytest.raises(ValueError):
        C.handle_python_script({'code': 'z = type(df) .__class__'}, [df])


# ── Calculated column expression safety ──────────────────────────────────────
def test_calculated_column_basic(df):
    out = P.handle_column_transform(
        {'colOperation': 'calculate', 'calcColumnName': 'c', 'calcExpression': 'a * b'}, [df])
    assert list(out['c']) == [4, 10, 18]


@pytest.mark.parametrize('expr', [
    '@os.system("x")',
    'a.__class__',
    'a; import os',
    'a.__reduce__()',
])
def test_calculated_column_rejects_unsafe(df, expr):
    with pytest.raises(ValueError):
        P.handle_column_transform(
            {'colOperation': 'calculate', 'calcColumnName': 'c', 'calcExpression': expr}, [df])
