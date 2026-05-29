"""Tests for the shared forecast-metrics module."""
import numpy as np
import pytest

from engine import metrics


def test_perfect_forecast_is_zero_error():
    a = [10, 20, 30, 40]
    assert metrics.mae(a, a) == 0
    assert metrics.rmse(a, a) == 0
    assert metrics.mape(a, a) == 0
    assert metrics.smape(a, a) == 0
    assert metrics.wape(a, a) == 0


def test_mae_and_rmse_known_values():
    actual = [1, 2, 3]
    forecast = [2, 2, 5]          # errors: 1, 0, 2
    assert metrics.mae(actual, forecast) == pytest.approx(1.0)
    assert metrics.rmse(actual, forecast) == pytest.approx(np.sqrt(5 / 3))


def test_mape_skips_zero_actuals():
    # zero actual would divide-by-zero; it must be dropped, not crash
    actual = [0, 100]
    forecast = [10, 110]
    assert metrics.mape(actual, forecast) == pytest.approx(10.0)


def test_mape_none_when_all_zero():
    assert metrics.mape([0, 0], [1, 2]) is None


def test_wape_robust_to_single_zero():
    actual = [0, 100, 100]
    forecast = [5, 110, 90]       # abs err = 5+10+10 = 25 ; sum|a| = 200
    assert metrics.wape(actual, forecast) == pytest.approx(12.5)


def test_smape_bounded_and_defined_at_zero_actual():
    # actual 0, forecast 10 -> 2*10/(0+10)=2.0 -> 200%
    assert metrics.smape([0], [10]) == pytest.approx(200.0)


def test_mase_below_one_beats_naive():
    # A nearly perfect forecast on a trending series should score well under 1
    train = list(range(1, 21))
    actual = [21, 22, 23]
    forecast = [21, 22, 23]
    val = metrics.mase(actual, forecast, train_actual=train, seasonal_period=1)
    assert val == pytest.approx(0.0)


def test_mase_none_on_flat_history():
    # naive scale is zero on a constant series -> undefined
    assert metrics.mase([5, 5], [4, 6], train_actual=[5, 5, 5, 5]) is None


def test_compute_all_drops_undefined_and_rounds():
    out = metrics.compute_all([0, 0], [1, 2])  # mape undefined (all zero actual)
    assert 'mape' not in out
    assert 'smape' in out and 'wape' not in out  # wape: sum|a|==0 -> undefined
    for v in out.values():
        assert isinstance(v, float)


def test_pinball_loss_zero_for_perfect_median():
    # at q=0.5 a perfect forecast has zero pinball loss
    assert metrics.pinball_loss([10, 20], [10, 20], 0.5) == pytest.approx(0.0)


def test_pinball_loss_asymmetry():
    # q=0.9 penalises under-prediction (actual above forecast) by 0.9
    under = metrics.pinball_loss([100], [90], 0.9)   # diff=+10 -> 0.9*10=9
    over = metrics.pinball_loss([100], [110], 0.9)   # diff=-10 -> 0.1*10=1
    assert under == pytest.approx(9.0)
    assert over == pytest.approx(1.0)


def test_coverage_basic():
    # 3 of 4 actuals inside [lower, upper]
    actual = [5, 15, 25, 35]
    lower = [0, 10, 20, 40]
    upper = [10, 20, 30, 50]
    assert metrics.coverage(actual, lower, upper) == pytest.approx(75.0)


def test_compute_interval_metrics_coverage_label():
    actual = [10, 20, 30, 40]
    qf = {0.1: [5, 15, 25, 35], 0.5: [10, 20, 30, 40], 0.9: [15, 25, 35, 45]}
    out = metrics.compute_interval_metrics(actual, qf)
    assert 'pinball_loss' in out
    assert out['coverage_nominal'] == 80
    assert out['coverage_80'] == pytest.approx(100.0)   # all actuals within band


def test_compute_interval_metrics_empty():
    assert metrics.compute_interval_metrics([1, 2], {}) == {}


def test_handles_nan_and_mismatched_finite():
    a = [1.0, np.nan, 3.0]
    f = [1.0, 5.0, 3.0]
    # the NaN pair is dropped; remaining perfect -> 0 error
    assert metrics.mae(a, f) == 0
