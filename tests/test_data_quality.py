"""Tests for the pre-training data-quality gate."""
import numpy as np
import pandas as pd

from engine.data_quality import check_forecast_data


def _series(n, val=None, base=100):
    idx = pd.date_range('2021-01-01', periods=n, freq='MS')
    if val is not None:
        sales = [val] * n
    else:
        sales = base + np.arange(n) * 2.0
    return pd.DataFrame({'date': idx, 'sales': sales})


def test_clean_data_has_no_errors_or_warnings():
    rep = check_forecast_data(_series(36), 'sales', 'date', '', horizon=12)
    assert rep['errors'] == []
    assert rep['warnings'] == []
    assert rep['stats']['n_series'] == 1


def test_missing_columns_are_errors():
    rep = check_forecast_data(_series(10), 'nope', 'date', '', horizon=3)
    assert any('not found' in e for e in rep['errors'])


def test_missing_target_values_warn():
    df = _series(12)
    df.loc[2, 'sales'] = np.nan
    rep = check_forecast_data(df, 'sales', 'date', '', horizon=3)
    assert rep['stats']['missing_target'] == 1
    assert any('missing target' in w for w in rep['warnings'])


def test_negative_values_warn():
    df = _series(12)
    df.loc[0, 'sales'] = -5
    rep = check_forecast_data(df, 'sales', 'date', '', horizon=3)
    assert rep['stats']['negative_target'] == 1
    assert any('negative' in w for w in rep['warnings'])


def test_constant_series_warns():
    rep = check_forecast_data(_series(12, val=50), 'sales', 'date', '', horizon=3)
    assert rep['stats']['constant'] == 1
    assert any('constant' in w for w in rep['warnings'])


def test_all_series_too_short_is_error():
    rep = check_forecast_data(_series(2), 'sales', 'date', '', horizon=1)
    assert any('too short' in e for e in rep['errors'])


def test_short_for_backtest_warning_multi_series():
    a, b = _series(24), _series(5)
    a['item'], b['item'] = 'A', 'B'
    df = pd.concat([a, b], ignore_index=True)
    rep = check_forecast_data(df, 'sales', 'date', 'item', horizon=6)
    assert rep['stats']['n_series'] == 2
    assert rep['stats']['short_for_backtest'] >= 1


def test_duplicate_timestamps_warn():
    df = _series(12)
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    rep = check_forecast_data(df, 'sales', 'date', '', horizon=3)
    assert rep['stats']['duplicate_timestamps'] >= 1
