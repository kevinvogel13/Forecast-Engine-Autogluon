"""Tests for the AutoGluon-only model handler.

AutoGluon is the sole forecasting engine — there is no statistical fallback —
so the AG-dependent code paths can't run in this sandbox. These tests cover the
parts that *don't* need AutoGluon: the hard-fail behaviour when it's missing,
seasonal-period inference, and the leakage-safe backtest helpers (`_split_holdout`,
`_score_holdout`) that decide what data the model is trained and scored on.
"""
import numpy as np
import pandas as pd
import pytest

from engine.handlers import model_handler as M
from engine.contract import seasonal_period_for


def _monthly(n=36, base=100):
    idx = pd.date_range('2021-01-01', periods=n, freq='MS')
    vals = base + 20 * np.sin(2 * np.pi * np.arange(n) / 12) + np.arange(n) * 1.5
    return pd.DataFrame({'date': idx, 'sales': vals})


# ── Hard-fail when AutoGluon is absent ───────────────────────────────────────
def test_model_config_requires_autogluon():
    # AutoGluon is not installed in the test sandbox, so this must fail loudly
    # rather than silently falling back to some other model.
    pytest.importorskip  # noqa — explicit: we WANT the absence path
    try:
        import autogluon.timeseries  # noqa: F401
        pytest.skip("AutoGluon is installed; hard-fail path not exercised here")
    except ImportError:
        pass
    df = _monthly()
    node = {'cfgTargetVar': 'sales', 'cfgTimeCol': 'date', 'dataFrequency': 'monthly',
            'forecastHorizon': 6}
    with pytest.raises(ValueError, match='AutoGluon is required'):
        M.handle_model_config(node, [df])


def test_model_config_validates_required_columns():
    # Missing target/time is caught before the AutoGluon import is even attempted?
    # No — import is attempted first, so without AutoGluon we still get the AG error.
    # With AutoGluon present, the column check fires. Either way it raises ValueError.
    with pytest.raises(ValueError):
        M.handle_model_config({'cfgTargetVar': 'sales'}, [_monthly()])


# ── Seasonal period inference ────────────────────────────────────────────────
def test_seasonal_period_inference():
    assert seasonal_period_for('MS') == 12
    assert seasonal_period_for('D') == 7
    assert seasonal_period_for('W-MON') == 52
    assert seasonal_period_for('MS', n_obs=10) == 1   # too short for 2 cycles


# ── Leakage-safe holdout split ───────────────────────────────────────────────
def test_split_holdout_single_series():
    df = _monthly(n=24)
    train, actual = M._split_holdout(df, id_col='', time_col='date', horizon=6)
    assert len(actual) == 6
    assert len(train) == 18
    # the holdout must be the LAST 6 points, and disjoint from train
    assert actual['date'].min() > train['date'].max()


def test_split_holdout_multi_series_per_series_tail():
    a, b = _monthly(n=24, base=100), _monthly(n=24, base=500)
    a['item'], b['item'] = 'A', 'B'
    df = pd.concat([a, b], ignore_index=True)
    train, actual = M._split_holdout(df, id_col='item', time_col='date', horizon=4)
    assert set(actual['item']) == {'A', 'B'}
    assert (actual.groupby('item').size() == 4).all()
    assert (train.groupby('item').size() == 20).all()


def test_split_holdout_too_short_returns_none():
    df = _monthly(n=4)
    train, actual = M._split_holdout(df, id_col='', time_col='date', horizon=6)
    assert train is None and actual is None


# ── Holdout scoring against RAW actuals ──────────────────────────────────────
def test_score_holdout_matches_raw_actuals():
    # Synthetic AutoGluon-style prediction frame (item_id, timestamp, '0.5')
    dates = pd.date_range('2023-01-01', periods=3, freq='MS')
    actual = pd.DataFrame({'item': ['A', 'A', 'A'], 'date': dates, 'sales': [100.0, 110.0, 120.0]})
    pred = pd.DataFrame({'item_id': ['A', 'A', 'A'], 'timestamp': dates, '0.5': [90.0, 110.0, 130.0]})
    agg, per_series, rows = M._score_holdout(pred, actual, 'sales', 'date', 'item', 'MS')
    assert len(rows) == 3
    assert rows[0]['actual'] == 100.0 and rows[0]['forecast'] == 90.0
    assert rows[0]['horizon_step'] == 1 and rows[2]['horizon_step'] == 3
    # MAE = mean(|10|,|0|,|10|) = 6.67
    assert agg['mae'] == pytest.approx(6.67, abs=0.01)
    assert per_series is not None and per_series[0]['item'] == 'A'


def test_score_holdout_empty_on_timestamp_mismatch():
    actual = pd.DataFrame({'date': pd.date_range('2023-01-01', periods=2, freq='MS'),
                           'sales': [1.0, 2.0]})
    pred = pd.DataFrame({'item_id': ['x', 'x'],
                         'timestamp': pd.date_range('2030-01-01', periods=2, freq='MS'),
                         '0.5': [1.0, 2.0]})
    agg, per_series, rows = M._score_holdout(pred, actual, 'sales', 'date', '', 'MS')
    assert agg is None and rows is None
