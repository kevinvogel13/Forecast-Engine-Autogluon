"""End-to-end smoke test that exercises the real AutoGluon path.

Skipped automatically when ``autogluon.timeseries`` is not installed (e.g. the
default PR CI), so the fast suite stays AG-free. The nightly/dispatch CI job
installs AutoGluon and runs this to catch breakage the unit tests can't —
every backtest/covariate/forecast code path that actually calls AutoGluon.

Run locally with: ``uv run pytest tests/test_autogluon_smoke.py``
(after ``uv pip install autogluon.timeseries``).
"""
import numpy as np
import pandas as pd
import pytest

pytest.importorskip("autogluon.timeseries",
                    reason="AutoGluon not installed; smoke test runs in the nightly CI job")

from engine.handlers import model_handler as M


def _panel(n_series=2, n=40, seed=0):
    rng = np.random.default_rng(seed)
    frames = []
    for s in range(n_series):
        idx = pd.date_range("2021-01-01", periods=n, freq="MS")
        base = 100 + 50 * s
        vals = base + 20 * np.sin(2 * np.pi * np.arange(n) / 12) + np.arange(n) * 1.5 \
            + rng.normal(0, 3, n)
        frames.append(pd.DataFrame({"date": idx, "sales": vals, "item": f"S{s}"}))
    return pd.concat(frames, ignore_index=True)


def _base_node(**over):
    node = {
        "modelMode": "train",
        "cfgTargetVar": "sales",
        "cfgTimeCol": "date",
        "cfgDfu": "item",
        "dataFrequency": "monthly",
        "forecastHorizon": 6,
        "cfgPreset": "fast",          # fast_training — keep the smoke test quick
        "cfgTimeLimit": 30,
        "cfgQuantiles": ["0.1", "0.5", "0.9"],
    }
    node.update(over)
    return node


def test_train_produces_forecast_and_leaderboard(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "models"))
    res = M.handle_model_config(_base_node(), [_panel()],
                                config={"MODEL_PATH": str(tmp_path / "models")})
    assert res["forecast"], "expected forecast rows"
    assert "leaderboard" in res
    assert res["info"]["horizon"] == 6
    # forecast covers both series across the horizon
    items = {r.get("item_id") or r.get("item") for r in res["forecast"]}
    assert len(items) >= 1


def test_backtest_surfaces_metrics_and_calibration(tmp_path):
    cfg = {"MODEL_PATH": str(tmp_path / "models")}
    node = _base_node(backtestEnabled=True, backtestFolds=2)
    res = M.handle_model_config(node, [_panel()], config=cfg)
    info = res["info"]
    # at least one accuracy metric and the calibration metrics are present
    assert any(k in info for k in ("mape", "wape", "rmse", "mae"))
    assert "pinball_loss" in info
    assert info.get("backtest_method") == "retrain_oos"
    assert res.get("backtest"), "expected pooled backtest rows"


def test_holiday_covariates_do_not_break_training(tmp_path):
    cfg = {"MODEL_PATH": str(tmp_path / "models")}
    node = _base_node(cfgHolidayEnabled=True, cfgHolidayCountry="US")
    res = M.handle_model_config(node, [_panel()], config=cfg)
    assert res["forecast"]
