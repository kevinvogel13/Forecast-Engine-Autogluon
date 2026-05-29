"""Unit tests for the prep/data handlers.

These lock the behaviour of the transform nodes that the audit-pass history
shows are most prone to frontend/backend field-name drift (filter operators,
outlier methods, pivot/unpivot, calculated columns).
"""
import numpy as np
import pandas as pd
import pytest

from engine.handlers import data_handlers as D
from engine.handlers import prep_handlers as P


@pytest.fixture
def df():
    return pd.DataFrame({
        'region': ['north', 'south', 'north', 'east'],
        'sales': [100, 200, 300, 400],
        'qty': [1, 2, 3, 4],
    })


# ── Filter ────────────────────────────────────────────────────────────────
def test_filter_equals_string(df):
    out = D.handle_filter({'filterColumn': 'region', 'filterOperator': 'equals',
                           'filterValue': 'north'}, [df])
    assert list(out['sales']) == [100, 300]


def test_filter_greater_than_numeric(df):
    out = D.handle_filter({'filterColumn': 'sales', 'filterOperator': 'greater_than',
                           'filterValue': '200'}, [df])
    assert list(out['sales']) == [300, 400]


def test_filter_operator_aliases(df):
    # short alias 'gt' must resolve to greater_than
    out = D.handle_filter({'filterColumn': 'sales', 'filterOp': 'gt',
                           'filterValue': '200'}, [df])
    assert list(out['sales']) == [300, 400]


def test_filter_multi_condition_or(df):
    conds = [
        {'column': 'region', 'op': 'equals', 'value': 'south', 'logic': 'AND'},
        {'column': 'region', 'op': 'equals', 'value': 'east', 'logic': 'OR'},
    ]
    out = D.handle_filter({'filterConditions': conds}, [df])
    assert set(out['region']) == {'south', 'east'}


def test_filter_in_operator(df):
    out = D.handle_filter({'filterColumn': 'region', 'filterOperator': 'in',
                           'filterValue': 'north,east'}, [df])
    assert set(out['region']) == {'north', 'east'}


def test_filter_missing_column_passes_through(df):
    out = D.handle_filter({'filterColumn': 'nope', 'filterOperator': 'equals',
                           'filterValue': 'x'}, [df])
    assert len(out) == len(df)


# ── Outlier treatment ───────────────────────────────────────────────────────
def test_outlier_iqr_cap():
    s = pd.DataFrame({'v': [10, 11, 12, 13, 1000]})
    out = P.handle_outlier_treatment({'outlierColumn': 'v', 'outlierMethod': 'iqr',
                                      'outlierThreshold': 1.5, 'outlierAction': 'cap'}, [s])
    assert out['v'].max() < 1000


def test_outlier_remove():
    s = pd.DataFrame({'v': [10, 11, 12, 13, 1000]})
    out = P.handle_outlier_treatment({'outlierColumn': 'v', 'outlierMethod': 'iqr',
                                      'outlierThreshold': 1.5, 'outlierAction': 'remove'}, [s])
    assert 1000 not in out['v'].values
    assert len(out) == 4


def test_outlier_percentile_normalises_percent():
    # threshold 95 (percent) should be treated as 0.05 tails, not crash
    s = pd.DataFrame({'v': list(range(1, 101))})
    out = P.handle_outlier_treatment({'outlierColumn': 'v', 'outlierMethod': 'percentile',
                                      'outlierThreshold': 95, 'outlierAction': 'cap'}, [s])
    assert out['v'].min() >= 1
    assert out['v'].max() <= 100


# ── Fill missing ────────────────────────────────────────────────────────────
def test_fill_missing_mean():
    s = pd.DataFrame({'v': [1.0, np.nan, 3.0]})
    out = P.handle_fill_missing({'fillColumns': ['v'], 'fillStrategy': 'mean'}, [s])
    assert out['v'].isna().sum() == 0
    assert out['v'].iloc[1] == pytest.approx(2.0)


def test_fill_missing_zero():
    s = pd.DataFrame({'v': [1.0, np.nan]})
    out = P.handle_fill_missing({'fillColumns': ['v'], 'fillStrategy': 'zero'}, [s])
    assert out['v'].iloc[1] == 0


# ── Column transform ─────────────────────────────────────────────────────────
def test_calculated_column(df):
    out = P.handle_column_transform({'colOperation': 'calculate',
                                     'calcColumnName': 'total',
                                     'calcExpression': 'sales * qty'}, [df])
    assert 'total' in out.columns
    assert list(out['total']) == [100, 400, 900, 1600]


def test_rename_and_drop(df):
    renamed = P.handle_column_transform({'colOperation': 'rename',
                                         'renameFrom': 'sales', 'renameTo': 'revenue'}, [df])
    assert 'revenue' in renamed.columns and 'sales' not in renamed.columns
    dropped = P.handle_column_transform({'colOperation': 'drop', 'dropColumns': ['qty']}, [df])
    assert 'qty' not in dropped.columns


# ── Dedup / merge / pivot ────────────────────────────────────────────────────
def test_remove_duplicates():
    s = pd.DataFrame({'a': [1, 1, 2], 'b': [9, 9, 8]})
    out = P.handle_remove_duplicates({}, [s])
    assert len(out) == 2


def test_merge_inner_on_common():
    left = pd.DataFrame({'k': [1, 2], 'x': ['a', 'b']})
    right = pd.DataFrame({'k': [2, 3], 'y': ['p', 'q']})
    out = P.handle_merge({'joinType': 'inner'}, [left, right])
    assert list(out['k']) == [2]


def test_pivot_then_unpivot_roundtrip():
    s = pd.DataFrame({'date': ['d1', 'd1', 'd2'], 'item': ['a', 'b', 'a'], 'val': [1, 2, 3]})
    wide = P.handle_pivot({'pivotMode': 'pivot', 'pivotIndex': 'date',
                           'pivotColumns': 'item', 'pivotValues': 'val',
                           'pivotAggFunc': 'sum'}, [s])
    assert 'a' in wide.columns and 'b' in wide.columns


def test_filter_requires_upstream():
    with pytest.raises(ValueError):
        D.handle_filter({}, [])
