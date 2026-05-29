"""Pre-training data-quality checks for time-series forecasting.

Surfaces actionable warnings (and hard errors for fatal problems) before a
potentially long AutoGluon fit, so users learn about gaps, too-short series,
constant targets, or sign problems up front instead of getting a confusing
empty backtest or a silently degraded model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def check_forecast_data(df: pd.DataFrame, target_col: str, time_col: str,
                        id_col: str, horizon: int) -> dict:
    """Return a report dict: ``{'errors': [...], 'warnings': [...], 'stats': {...}}``.

    Errors indicate the fit cannot meaningfully proceed; warnings are advisory.
    The caller decides whether to raise on errors.
    """
    errors: list[str] = []
    warnings: list[str] = []
    stats: dict = {}

    if target_col not in df.columns:
        errors.append(f"Target column '{target_col}' not found in data")
    if time_col not in df.columns:
        errors.append(f"Timestamp column '{time_col}' not found in data")
    if errors:
        return {'errors': errors, 'warnings': warnings, 'stats': stats}

    # Per-series grouping
    if id_col and id_col in df.columns:
        groups = list(df.groupby(id_col))
        n_series = len(groups)
    else:
        groups = [('all', df)]
        n_series = 1
    stats['n_series'] = n_series

    # Missing target values
    n_missing = int(df[target_col].isna().sum())
    if n_missing:
        pct = round(n_missing / len(df) * 100, 1)
        warnings.append(f"{n_missing} missing target values ({pct}%); consider a Fill Missing step")
    stats['missing_target'] = n_missing

    # Negative values on the target (often invalid for demand/volume)
    numeric_target = pd.to_numeric(df[target_col], errors='coerce')
    n_negative = int((numeric_target < 0).sum())
    if n_negative:
        warnings.append(f"{n_negative} negative target values — verify this is expected for '{target_col}'")
    stats['negative_target'] = n_negative

    # Per-series length and constancy
    too_short = []
    constant = []
    short_for_backtest = []
    for name, g in groups:
        vals = pd.to_numeric(g[target_col], errors='coerce').dropna()
        n = len(vals)
        if n < 3:
            too_short.append(str(name))
        elif n <= horizon:
            short_for_backtest.append(str(name))
        if n >= 2 and float(np.nanstd(vals.values)) == 0:
            constant.append(str(name))

    if too_short:
        sample = ', '.join(too_short[:5]) + ('…' if len(too_short) > 5 else '')
        warnings.append(f"{len(too_short)} series have fewer than 3 points and will be skipped ({sample})")
    if short_for_backtest:
        warnings.append(
            f"{len(short_for_backtest)} series are shorter than the horizon ({horizon}); "
            "they cannot be backtested")
    if constant:
        sample = ', '.join(constant[:5]) + ('…' if len(constant) > 5 else '')
        warnings.append(f"{len(constant)} series have a constant target (no variation) ({sample})")

    if len(too_short) == n_series:
        errors.append("Every series is too short to forecast (need at least 3 points)")

    stats['too_short'] = len(too_short)
    stats['constant'] = len(constant)
    stats['short_for_backtest'] = len(short_for_backtest)

    # Duplicate timestamps within a series (breaks the regular grid)
    dup_total = 0
    for name, g in groups:
        dup_total += int(g[time_col].duplicated().sum())
    if dup_total:
        warnings.append(f"{dup_total} duplicate timestamps within series; "
                        "add Remove Duplicates or aggregate first")
    stats['duplicate_timestamps'] = dup_total

    return {'errors': errors, 'warnings': warnings, 'stats': stats}
