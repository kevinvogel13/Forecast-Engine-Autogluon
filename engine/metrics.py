"""Shared forecast-accuracy metrics.

Both the AutoGluon path and the statistical-fallback path compute backtest
metrics.  Historically each rolled its own MAPE/RMSE/MAE inline, which meant
they could (and did) drift apart.  This module is the single source of truth.

All functions accept array-likes of equal length and return plain Python
floats (or ``None`` when the metric is undefined for the given inputs), so the
results are JSON-serialisable for the SSE payload.
"""
from __future__ import annotations

from typing import Optional, Sequence

import numpy as np


def _clean(actual: Sequence[float], forecast: Sequence[float]) -> tuple[np.ndarray, np.ndarray]:
    a = np.asarray(actual, dtype=float)
    f = np.asarray(forecast, dtype=float)
    mask = np.isfinite(a) & np.isfinite(f)
    return a[mask], f[mask]


def mae(actual, forecast) -> Optional[float]:
    a, f = _clean(actual, forecast)
    if a.size == 0:
        return None
    return float(np.mean(np.abs(a - f)))


def rmse(actual, forecast) -> Optional[float]:
    a, f = _clean(actual, forecast)
    if a.size == 0:
        return None
    return float(np.sqrt(np.mean((a - f) ** 2)))


def mape(actual, forecast) -> Optional[float]:
    """Mean Absolute Percentage Error (%).  Undefined where actual == 0, so
    those points are dropped.  Returns ``None`` if no non-zero actuals."""
    a, f = _clean(actual, forecast)
    nz = a != 0
    if not nz.any():
        return None
    return float(np.mean(np.abs((a[nz] - f[nz]) / a[nz])) * 100)


def smape(actual, forecast) -> Optional[float]:
    """Symmetric MAPE (%).  Bounded in [0, 200], well-defined when actual==0
    as long as the forecast is non-zero, making it far more robust than MAPE
    for intermittent demand."""
    a, f = _clean(actual, forecast)
    if a.size == 0:
        return None
    denom = np.abs(a) + np.abs(f)
    nz = denom != 0
    if not nz.any():
        return None
    return float(np.mean(2.0 * np.abs(f[nz] - a[nz]) / denom[nz]) * 100)


def wape(actual, forecast) -> Optional[float]:
    """Weighted Absolute Percentage Error (%), aka MAD/Mean ratio.  Robust to
    individual zeros because it divides the *total* absolute error by the
    *total* actual volume — the preferred accuracy KPI for demand planning."""
    a, f = _clean(actual, forecast)
    denom = np.sum(np.abs(a))
    if denom == 0:
        return None
    return float(np.sum(np.abs(a - f)) / denom * 100)


def mase(actual, forecast, train_actual=None, seasonal_period: int = 1) -> Optional[float]:
    """Mean Absolute Scaled Error.

    Scales MAE by the in-sample MAE of a (seasonal) naive forecast.  A value
    < 1 means the model beats the naive baseline.  ``train_actual`` should be
    the in-sample history used to compute the naive scale; if omitted we fall
    back to scaling by the naive error of the actuals themselves.
    """
    a, f = _clean(actual, forecast)
    if a.size == 0:
        return None
    err = np.mean(np.abs(a - f))

    base = np.asarray(train_actual, dtype=float) if train_actual is not None else a
    base = base[np.isfinite(base)]
    if base.size <= seasonal_period:
        seasonal_period = 1
    if base.size <= seasonal_period:
        return None
    scale = np.mean(np.abs(base[seasonal_period:] - base[:-seasonal_period]))
    if scale == 0:
        return None
    return float(err / scale)


def pinball_loss(actual, forecast_q, q: float) -> Optional[float]:
    """Average pinball (quantile) loss for the q-quantile forecast.

    The proper scoring rule for a single quantile: penalises under-prediction by
    ``q`` and over-prediction by ``1-q``.  Lower is better.  This is what makes a
    probabilistic forecast's intervals trustworthy, not just its point estimate.
    """
    a, f = _clean(actual, forecast_q)
    if a.size == 0:
        return None
    diff = a - f
    return float(np.mean(np.maximum(q * diff, (q - 1) * diff)))


def coverage(actual, lower, upper) -> Optional[float]:
    """Empirical coverage (%) — the fraction of actuals that fall within the
    [lower, upper] interval.  A well-calibrated 80% interval should cover ~80%."""
    a = np.asarray(actual, dtype=float)
    lo = np.asarray(lower, dtype=float)
    hi = np.asarray(upper, dtype=float)
    mask = np.isfinite(a) & np.isfinite(lo) & np.isfinite(hi)
    if not mask.any():
        return None
    a, lo, hi = a[mask], lo[mask], hi[mask]
    return float(np.mean((a >= lo) & (a <= hi)) * 100)


def compute_all(actual, forecast, train_actual=None, seasonal_period: int = 1,
                ndigits: int = 2) -> dict:
    """Return every metric as a rounded dict, dropping any that are undefined.

    This is the canonical shape consumed by the frontend Backtest Metrics chart.
    """
    out: dict[str, float] = {}
    for name, value in (
        ('mape', mape(actual, forecast)),
        ('smape', smape(actual, forecast)),
        ('wape', wape(actual, forecast)),
        ('rmse', rmse(actual, forecast)),
        ('mae', mae(actual, forecast)),
        ('mase', mase(actual, forecast, train_actual, seasonal_period)),
    ):
        if value is not None:
            out[name] = round(value, ndigits)
    return out


def compute_interval_metrics(actual, quantile_forecasts: dict, ndigits: int = 2) -> dict:
    """Calibration metrics from a dict of {quantile_level: forecast_array}.

    Returns mean pinball loss across the supplied quantiles, plus empirical
    coverage of the central interval spanned by the lowest/highest quantiles
    (e.g. 0.1/0.9 → ``coverage_80``).  Quantile levels are floats in (0, 1).
    """
    out: dict[str, float] = {}
    if not quantile_forecasts:
        return out

    losses = []
    for q, fc in quantile_forecasts.items():
        pl = pinball_loss(actual, fc, float(q))
        if pl is not None:
            losses.append(pl)
    if losses:
        out['pinball_loss'] = round(float(np.mean(losses)), ndigits)

    qs = sorted(float(q) for q in quantile_forecasts)
    if len(qs) >= 2 and qs[0] < 0.5 < qs[-1]:
        lo_q, hi_q = qs[0], qs[-1]
        cov = coverage(actual, quantile_forecasts[_key(quantile_forecasts, lo_q)],
                       quantile_forecasts[_key(quantile_forecasts, hi_q)])
        if cov is not None:
            nominal = int(round((hi_q - lo_q) * 100))
            out[f'coverage_{nominal}'] = round(cov, ndigits)
            out['coverage_nominal'] = nominal
    return out


def _key(d: dict, target: float):
    """Return the original dict key whose float value equals `target`."""
    for k in d:
        if float(k) == target:
            return k
    return target
