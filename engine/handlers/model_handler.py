import pandas as pd
import numpy as np
import json
import os
import shutil
import tempfile
import time
import logging
from engine.handlers.registry import register
from engine import metrics
from engine.contract import seasonal_period_for

logger = logging.getLogger('engine')

# Weekly data is anchored to Monday everywhere (engine + date-gap filler) so
# generated future timestamps line up with the training grid; an unanchored
# 'W' defaults to Sunday in pandas and silently misaligns the holdout merge.
WEEK_ANCHOR = 'W-MON'

# ─── Frequency mapping ───────────────────────────────────────────────────────
# Frontend sends human-readable strings; AutoGluon needs pandas-style aliases.
FREQ_MAP = {
    # Human-readable (from frontend)
    'daily': 'D', 'weekly': 'W', 'monthly': 'M', 'quarterly': 'Q', 'yearly': 'Y',
    # Short codes (from auto-detect button)
    'D': 'D', 'W': 'W', 'M': 'M', 'Q': 'Q', 'Y': 'Y',
    # Pandas period strings (passthrough)
    'MS': 'MS', 'QS': 'QS', 'YS': 'YS', 'H': 'H', 'T': 'T', 'min': 'min',
}
# AutoGluon period-start aliases (avoid ambiguity on month/quarter boundaries)
FREQ_TO_AG = {
    'D': 'D', 'W': WEEK_ANCHOR, 'M': 'MS', 'Q': 'QS', 'Y': 'YS',
    'MS': 'MS', 'QS': 'QS', 'YS': 'YS', 'H': 'H', 'T': 'min', 'min': 'min',
}

# ─── Preset mapping ───────────────────────────────────────────────────────────
# Frontend card 'fast' must map to AutoGluon's 'fast_training'.
PRESET_MAP = {
    'fast': 'fast_training',
    'fast_training': 'fast_training',
    'medium': 'medium_quality',
    'medium_quality': 'medium_quality',
    'high': 'high_quality',
    'high_quality': 'high_quality',
    'best': 'best_quality',
    'best_quality': 'best_quality',
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_freq(raw: str) -> str:
    """Normalize a user-supplied frequency string to an AutoGluon-safe alias."""
    normalized = FREQ_MAP.get(raw, raw)
    return FREQ_TO_AG.get(normalized, normalized)


def _resolve_preset(raw: str) -> str:
    return PRESET_MAP.get(raw, 'medium_quality')


def _parse_quantiles(quantile_cfg) -> list:
    """Convert cfgQuantiles (list of strings) to sorted list of floats."""
    if not quantile_cfg:
        return [0.1, 0.5, 0.9]
    try:
        qs = sorted([float(q) for q in quantile_cfg])
        return qs if qs else [0.1, 0.5, 0.9]
    except Exception:
        return [0.1, 0.5, 0.9]


def _future_cov_rows(grp, time_col, freq, horizon, known_covariates_cols, holiday_country):
    """Future covariate rows for one series: calendar columns are recomputed
    from the future dates; all other covariates carry the last observed value."""
    grp = grp.sort_values(time_col)
    future_dates = pd.date_range(start=grp[time_col].max(), periods=horizon + 1, freq=freq)[1:]
    last_row = grp.iloc[-1]
    data = {time_col: future_dates}
    cal_cols = [c for c in known_covariates_cols if c.startswith(CAL_PREFIX)]
    other_cols = [c for c in known_covariates_cols if not c.startswith(CAL_PREFIX) and c in grp.columns]
    for c in other_cols:
        data[c] = last_row[c]
    rows = pd.DataFrame(data)
    if cal_cols:
        cal = _calendar_frame(future_dates, holiday_country)
        for c in cal_cols:
            if c in cal.columns:
                rows[c] = cal[c].values
    return rows


def _apply_user_future_covariates(rows, future_df, id_col, time_col,
                                  known_covariates_cols):
    """Overlay user-supplied actual future covariate values onto the projected
    `rows`, matched on timestamp (and id_col when present).

    Only non-calendar columns are overlaid — calendar/holiday columns are
    deterministic and already correct.  Any future timestamp/covariate the user
    didn't provide keeps its projected (forward-filled) value, so a partial
    future table still helps.
    """
    overlay_cols = [c for c in known_covariates_cols
                    if not c.startswith(CAL_PREFIX) and c in future_df.columns]
    if not overlay_cols:
        return rows
    fut = future_df.copy()
    fut['_ts'] = pd.to_datetime(fut[time_col])
    rows = rows.copy()
    rows['_ts'] = pd.to_datetime(rows[time_col])
    keys = ['_ts']
    if id_col and id_col in fut.columns and id_col in rows.columns:
        fut['_item'] = fut[id_col].astype(str)
        rows['_item'] = rows[id_col].astype(str)
        keys = ['_item', '_ts']
    fut_idx = fut.set_index(keys)
    for c in overlay_cols:
        mapped = rows.set_index(keys).index.map(
            lambda k: fut_idx[c].get(k) if k in fut_idx.index else None)
        vals = pd.Series(list(mapped), index=rows.index)
        rows[c] = vals.where(vals.notna(), rows[c])
    return rows.drop(columns=[c for c in ('_ts', '_item') if c in rows.columns])


def _build_future_covariates(df: pd.DataFrame, id_col: str, time_col: str,
                             freq: str, horizon: int, known_covariates_cols: list,
                             TimeSeriesDataFrame, holiday_country: str = None,
                             future_df: pd.DataFrame = None):
    """Build the future known-covariates frame AutoGluon needs at predict time.

    AutoGluon requires values for every ``known_covariates_names`` column over
    the forecast horizon.  Deterministic calendar/holiday columns (``cal_*``)
    are recomputed from the future timestamps.  For other covariates, if the user
    supplies a ``future_df`` (a second upstream dataset with actual planned future
    values, e.g. price/promo), those values are used; otherwise we project the
    last observed value forward.  Returns a TimeSeriesDataFrame or ``None``.
    """
    if not known_covariates_cols:
        return None
    try:
        if id_col and id_col in df.columns:
            cov_frames = []
            for item, grp in df.groupby(id_col):
                rows = _future_cov_rows(grp, time_col, freq, horizon,
                                        known_covariates_cols, holiday_country)
                rows.insert(0, id_col, item)
                if future_df is not None:
                    rows = _apply_user_future_covariates(
                        rows, future_df, id_col, time_col, known_covariates_cols)
                cov_frames.append(rows)
            if not cov_frames:
                return None
            future_cov_df = pd.concat(cov_frames, ignore_index=True)
            return TimeSeriesDataFrame.from_data_frame(
                future_cov_df, id_column=id_col, timestamp_column=time_col)
        else:
            rows = _future_cov_rows(df, time_col, freq, horizon,
                                    known_covariates_cols, holiday_country)
            if future_df is not None:
                rows = _apply_user_future_covariates(
                    rows, future_df, id_col, time_col, known_covariates_cols)
            return TimeSeriesDataFrame.from_data_frame(
                rows, timestamp_column=time_col)
    except Exception as e:
        logger.warning(f"Could not build known_covariates: {e}. Predicting without them.")
        return None


def _future_dates(last_date, freq: str, horizon: int):
    """Generate `horizon` future timestamps after `last_date` at `freq`.

    Uses the AutoGluon-resolved alias (so weekly is Monday-anchored, monthly is
    month-start, etc.) keeping the statistical fallback's timestamps on the same
    grid AutoGluon would produce.
    """
    return pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]


# Calendar/holiday covariate columns are deterministic functions of the
# timestamp, so — unlike ordinary covariates — they are genuinely *known* over
# the forecast horizon and can be recomputed for future dates rather than
# forward-filled.  All such columns share this prefix so the future-covariate
# builder knows to recompute (not carry-forward) them.
CAL_PREFIX = 'cal_'


def _calendar_frame(dates, holiday_country: str = None) -> pd.DataFrame:
    """Deterministic calendar features for a series of timestamps."""
    dts = pd.to_datetime(pd.Series(list(dates))).reset_index(drop=True)
    out = pd.DataFrame({
        f'{CAL_PREFIX}month': dts.dt.month.astype(int),
        f'{CAL_PREFIX}dayofweek': dts.dt.dayofweek.astype(int),
        f'{CAL_PREFIX}quarter': dts.dt.quarter.astype(int),
        f'{CAL_PREFIX}weekofyear': dts.dt.isocalendar().week.astype(int),
    })
    if holiday_country:
        try:
            import holidays as _holidays
            cal = _holidays.country_holidays(holiday_country)
            out[f'{CAL_PREFIX}holiday'] = dts.dt.date.map(lambda d: 1 if d in cal else 0).astype(int)
        except Exception as e:
            logger.warning(f"Holiday features unavailable for '{holiday_country}': {e}")
    return out


def _augment_calendar(df: pd.DataFrame, time_col: str, holiday_country: str = None) -> tuple:
    """Append calendar feature columns to `df`; return (df, added_column_names).

    These become known covariates so the model can learn seasonality/holiday
    effects even when no exogenous data was supplied.
    """
    cal = _calendar_frame(df[time_col], holiday_country)
    df = df.copy()
    for c in cal.columns:
        df[c] = cal[c].values
    return df, list(cal.columns)



# ─── Frontend key → AutoGluon model class name ────────────────────────────────
# Frontend stores lowercase snake_case keys; AutoGluon needs exact class names.
_MODEL_KEY_TO_AG = {
    'naive':              'Naive',
    'seasonal_naive':     'SeasonalNaive',
    'ets':                'ETS',
    'arima':              'ARIMA',
    'auto_arima':         'AutoARIMA',
    'theta':              'Theta',
    'croston':            'Croston',
    'deepar':             'DeepAR',
    'tft':                'TemporalFusionTransformer',
    'transformer':        'Transformer',
    'simple_feed_forward':'SimpleFeedForward',
    'recursive_tabular':  'RecursiveTabular',
    'direct_tabular':     'DirectTabular',
    'chronos':            'Chronos',
    'chronos_bolt':       'ChronosBolt',
    'weighted_ensemble':  'WeightedEnsemble',
}


def _build_excluded_models(selected_models: dict) -> list:
    """Return list of AutoGluon class name strings for models the user de-selected."""
    if not selected_models:
        return []
    excluded = []
    for k, v in selected_models.items():
        if not v:
            ag_name = _MODEL_KEY_TO_AG.get(k)
            if ag_name:
                excluded.append(ag_name)
    return excluded


def apply_fill_missing_per_column(df: pd.DataFrame, fill_configs: dict, fit_stats: dict = None) -> tuple:
    stats = fit_stats or {}
    df = df.copy()
    
    for col, cfg in fill_configs.items():
        if col not in df.columns:
            continue
        strategy = cfg.get('strategy', 'ffill')
        constant = cfg.get('constant') or ''

        # mean/median/interpolate produce floats; widen int columns first (pandas 3.0)
        if strategy in ('mean', 'median', 'interpolate') and pd.api.types.is_integer_dtype(df[col]):
            df[col] = df[col].astype('float64')

        if strategy == 'ffill':
            df[col] = df[col].ffill()
        elif strategy == 'bfill':
            df[col] = df[col].bfill()
        elif strategy == 'interpolate':
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].interpolate(method='linear')
            else:
                df[col] = df[col].ffill()
        elif strategy == 'mean':
            if pd.api.types.is_numeric_dtype(df[col]):
                if col not in stats:
                    stats[col] = {'mean': df[col].mean()}
                df[col] = df[col].fillna(stats[col]['mean'])
        elif strategy == 'median':
            if pd.api.types.is_numeric_dtype(df[col]):
                if col not in stats:
                    stats[col] = {'median': df[col].median()}
                df[col] = df[col].fillna(stats[col].get('median', df[col].median()))
        elif strategy == 'zero':
            df[col] = df[col].fillna(0)
        elif strategy == 'constant':
            try:
                fill_val = float(constant)
            except (ValueError, TypeError):
                fill_val = constant
            df[col] = df[col].fillna(fill_val)
    
    return df, stats


def apply_outlier_treatment_per_column(df: pd.DataFrame, outlier_configs: dict, fit_stats: dict = None) -> tuple:
    stats = fit_stats or {}
    df = df.copy()
    
    for col, cfg in outlier_configs.items():
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        
        method = cfg.get('method', 'iqr')
        threshold = float(cfg.get('threshold') or 1.5)
        action = cfg.get('action', 'cap')
        
        col_key = f'outlier_{col}'
        if col_key not in stats:
            col_data = df[col].dropna()
            if method == 'iqr':
                q1 = col_data.quantile(0.25)
                q3 = col_data.quantile(0.75)
                iqr = q3 - q1
                lower = q1 - threshold * iqr
                upper = q3 + threshold * iqr
            elif method == 'zscore':
                mean = col_data.mean()
                std = col_data.std()
                lower = mean - threshold * std
                upper = mean + threshold * std
            elif method == 'percentile':
                if threshold > 1:
                    threshold = threshold / 100.0
                threshold = max(0.001, min(threshold, 0.499))
                lower = col_data.quantile(threshold)
                upper = col_data.quantile(1 - threshold)
            else:
                continue
            stats[col_key] = {'lower': lower, 'upper': upper, 'median': col_data.median(), 'mean': col_data.mean()}
        
        bounds = stats[col_key]
        lower, upper = bounds['lower'], bounds['upper']
        outlier_mask = (df[col] < lower) | (df[col] > upper)

        # pandas 3.0 refuses float/NaN assignment into an int column.
        if action in ('cap', 'median', 'mean', 'null') and pd.api.types.is_integer_dtype(df[col]):
            df[col] = df[col].astype('float64')

        if action == 'cap':
            df.loc[df[col] < lower, col] = lower
            df.loc[df[col] > upper, col] = upper
        elif action == 'median':
            df.loc[outlier_mask, col] = bounds['median']
        elif action == 'mean':
            df.loc[outlier_mask, col] = bounds['mean']
        elif action == 'null':
            df.loc[outlier_mask, col] = np.nan
        elif action == 'remove':
            df = df[~outlier_mask]
    
    return df, stats


def preprocess_fold(df: pd.DataFrame, fill_configs: dict, outlier_configs: dict, fit_stats: dict = None):
    stats = fit_stats or {}
    fill_stats = {k: v for k, v in stats.items() if not k.startswith('outlier_')}
    outlier_stats = {k: v for k, v in stats.items() if k.startswith('outlier_')}
    
    if fill_configs:
        df, fill_stats = apply_fill_missing_per_column(df, fill_configs, fill_stats)
    if outlier_configs:
        df, outlier_stats = apply_outlier_treatment_per_column(df, outlier_configs, outlier_stats)
    
    combined_stats = {**fill_stats, **outlier_stats}
    return df, combined_stats


def compute_feature_importance(model, train_df: pd.DataFrame, target_col: str,
                                time_col: str, id_col: str, n_iterations: int = 5,
                                ts_data=None):
    """Compute feature importance.  Prefer AutoGluon's native method when a
    TimeSeriesDataFrame (ts_data) is supplied; fall back to a sklearn surrogate
    permutation-importance otherwise."""
    try:
        if model is not None and hasattr(model, 'feature_importance') and ts_data is not None:
            importance = model.feature_importance(ts_data)
            if importance is not None and len(importance) > 0:
                if isinstance(importance, pd.DataFrame):
                    records = []
                    for idx, row in importance.iterrows():
                        records.append({
                            'feature': str(idx),
                            'importance': float(row.iloc[0]) if len(row) > 0 else 0.0,
                        })
                    return records
                elif isinstance(importance, pd.Series):
                    return [{'feature': str(k), 'importance': float(v)} for k, v in importance.items()]
    except Exception as e:
        logger.warning(f"AutoGluon feature_importance failed: {e}")
    
    try:
        feature_cols = [c for c in train_df.columns if c not in [target_col, time_col, id_col]]
        numeric_cols = [c for c in feature_cols if pd.api.types.is_numeric_dtype(train_df[c])]
        
        if not numeric_cols:
            return []
        
        from sklearn.inspection import permutation_importance
        from sklearn.ensemble import GradientBoostingRegressor
        
        sample_df = train_df.dropna(subset=[target_col] + numeric_cols)
        if len(sample_df) > 5000:
            sample_df = sample_df.sample(5000, random_state=42)
        
        if len(sample_df) < 10:
            return []
        
        X = sample_df[numeric_cols].values
        y = sample_df[target_col].values
        
        surrogate = GradientBoostingRegressor(n_estimators=50, max_depth=4, random_state=42)
        surrogate.fit(X, y)
        
        perm = permutation_importance(surrogate, X, y, n_repeats=n_iterations, random_state=42)
        
        records = []
        for i, col in enumerate(numeric_cols):
            records.append({
                'feature': col,
                'importance': float(perm.importances_mean[i]),
                'std': float(perm.importances_std[i]),
            })
        
        records.sort(key=lambda x: abs(x['importance']), reverse=True)
        return records
        
    except Exception as e:
        logger.warning(f"Permutation importance failed: {e}")
        return []


def _build_static_and_ts(df, id_col, time_col, static_features_cols, TimeSeriesDataFrame):
    """Split static features out of `df` and build a TimeSeriesDataFrame.
    Returns (static_df, ts_df, ts_input_df)."""
    static_df = None
    ts_input_df = df
    cols = [c for c in (static_features_cols or []) if c in df.columns]
    if cols and id_col and id_col in df.columns:
        try:
            static_df = df.groupby(id_col)[cols].first()
            ts_input_df = df.drop(columns=cols, errors='ignore')
        except Exception as e:
            logger.warning(f"Could not build static features df: {e}")
            static_df, ts_input_df = None, df
    ts_df = TimeSeriesDataFrame.from_data_frame(
        ts_input_df,
        id_column=id_col if id_col else None,
        timestamp_column=time_col,
        static_features_df=static_df,
    )
    return static_df, ts_df, ts_input_df


def _prepare_training_frame(raw_df, cfg, preprocess: bool = True):
    """Apply fill/outlier preprocessing (fit on THIS frame only) and append
    deterministic calendar covariates.  Returns (processed_df, known_cols).

    Because the stats are fit on whatever frame is passed in, calling this on a
    train-only slice gives leakage-safe preprocessing for the backtest, while
    calling it on the full series gives the deployment model.
    """
    df = raw_df
    if preprocess:
        df, _ = preprocess_fold(df, cfg['fill_configs'], cfg['outlier_configs'])
    known_cols = list(cfg['known_covariates_cols'])
    if cfg.get('holiday_enabled'):
        df, cal_cols = _augment_calendar(df, cfg['time_col'], cfg.get('holiday_country'))
        for c in cal_cols:
            if c not in known_cols:
                known_cols.append(c)
    return df, known_cols


def _fit_predictor(train_df, cfg, known_cols, TimeSeriesPredictor, TimeSeriesDataFrame, save_path):
    """Build a predictor from an already-preprocessed training frame and fit it.
    Returns (predictor, ts_df, static_df)."""
    static_df, ts_df, _ = _build_static_and_ts(
        train_df, cfg['id_col'], cfg['time_col'], cfg['static_features_cols'], TimeSeriesDataFrame)

    predictor_kwargs = dict(
        target=cfg['target'], prediction_length=cfg['horizon'],
        freq=cfg['freq'], path=save_path, eval_metric=cfg['eval_metric'],
    )
    if known_cols:
        predictor_kwargs['known_covariates_names'] = known_cols
    predictor = TimeSeriesPredictor(**predictor_kwargs)

    fit_kwargs = dict(train_data=ts_df, presets=cfg['preset'],
                      time_limit=cfg['time_limit'], refit_full=cfg['refit_full'])
    nvw = cfg.get('num_val_windows')
    if nvw and nvw > 1:
        fit_kwargs['num_val_windows'] = nvw
        if cfg.get('val_step_size') and cfg['val_step_size'] != cfg['horizon']:
            fit_kwargs['val_step_size'] = cfg['val_step_size']
    if cfg.get('excluded_models'):
        fit_kwargs['excluded_model_types'] = cfg['excluded_models']
    if cfg.get('num_gpus') is not None:
        fit_kwargs['num_gpus'] = cfg['num_gpus']
    if cfg.get('num_cpus') is not None:
        fit_kwargs['num_cpus'] = cfg['num_cpus']
    predictor.fit(**fit_kwargs)
    return predictor, ts_df, static_df


def _split_holdout(raw_df, id_col, time_col, horizon):
    """Split each series' last `horizon` points off as the holdout actuals.
    Returns (train_raw, actual_raw) or (None, None) if no series is long enough.
    Pure dataframe logic — unit-tested without AutoGluon."""
    if id_col and id_col in raw_df.columns:
        train_parts, actual_parts = [], []
        for _, grp in raw_df.groupby(id_col):
            g = grp.sort_values(time_col)
            if len(g) <= horizon:
                continue
            train_parts.append(g.iloc[:-horizon])
            actual_parts.append(g.iloc[-horizon:])
        if not train_parts:
            return None, None
        return (pd.concat(train_parts, ignore_index=True),
                pd.concat(actual_parts, ignore_index=True))
    g = raw_df.sort_values(time_col)
    if len(g) <= horizon:
        return None, None
    return g.iloc[:-horizon].reset_index(drop=True), g.iloc[-horizon:].reset_index(drop=True)


def _rolling_splits(raw_df, id_col, time_col, horizon, n_windows, step_size):
    """Rolling-origin evaluation windows.

    Window 0 holds out each series' most recent `horizon` points; each later
    window steps the origin back `step_size` points.  Returns a list of
    ``(train_raw, actual_raw, fold)`` tuples (oldest origin first), skipping any
    window that leaves too little training history.  Each window is a genuine
    out-of-sample slice — the model for window k must be trained only on data up
    to that window's origin.
    """
    n_windows = max(1, int(n_windows or 1))
    step_size = max(1, int(step_size or horizon))
    windows = []
    for k in range(n_windows):
        offset = k * step_size
        if id_col and id_col in raw_df.columns:
            parts = []
            for _, grp in raw_df.groupby(id_col):
                g = grp.sort_values(time_col)
                end = len(g) - offset
                if end - horizon < 1:        # no training data left for this series
                    continue
                parts.append(g.iloc[:end])
            truncated = pd.concat(parts, ignore_index=True) if parts else None
        else:
            g = raw_df.sort_values(time_col)
            end = len(g) - offset
            truncated = g.iloc[:end] if end - horizon >= 1 else None
        if truncated is None:
            continue
        train, actual = _split_holdout(truncated, id_col, time_col, horizon)
        if train is not None:
            windows.append((train, actual, k))
    # oldest origin first so the chart reads left→right in time
    windows.sort(key=lambda w: -w[2])
    return windows


def _interval_metrics_from_df(df):
    """Compute pinball loss + interval coverage from pooled backtest rows that
    carry q_<level> quantile columns."""
    q_cols = [c for c in df.columns if c.startswith('q_')]
    if not q_cols:
        return {}
    quantile_forecasts = {}
    for c in q_cols:
        try:
            quantile_forecasts[float(c[2:])] = df[c].values.astype(float)
        except (TypeError, ValueError):
            continue
    return metrics.compute_interval_metrics(df['actual'].values.astype(float), quantile_forecasts)


def _aggregate_backtest_rows(rows, id_col, seasonal_period):
    """Pool actual/forecast pairs from all rolling windows into overall and
    per-series metrics (including probabilistic calibration metrics)."""
    if not rows:
        return None, None
    df = pd.DataFrame(rows)
    agg = metrics.compute_all(df['actual'].values, df['forecast'].values,
                              seasonal_period=seasonal_period)
    agg.update(_interval_metrics_from_df(df))
    per_series = None
    if id_col and id_col in df.columns:
        per_series = []
        for name, g in df.groupby(id_col):
            sr = {id_col: str(name), 'n': len(g)}
            sr.update(metrics.compute_all(g['actual'].values, g['forecast'].values,
                                          seasonal_period=seasonal_period))
            sr.update(_interval_metrics_from_df(g))
            per_series.append(sr)
        per_series.sort(key=lambda x: x.get('wape', x.get('mape', x.get('rmse', 0))), reverse=True)
    return agg, per_series


def _score_holdout(pred_reset, actual_df, target_col, time_col, id_col, freq):
    """Join AutoGluon predictions to RAW held-out actuals and compute metrics.
    Returns (agg_metrics, per_series_metrics, backtest_rows). Pure dataframe
    logic — unit-tested with a synthetic prediction frame (no AutoGluon)."""
    pred_reset = pred_reset.copy()
    non_key_cols = [c for c in pred_reset.columns if c not in ('item_id', 'timestamp')]
    # Quantile columns look like '0.1', '0.5', '0.9'; keep them for calibration.
    quantile_cols = []
    for c in non_key_cols:
        try:
            float(c)
            quantile_cols.append(c)
        except (TypeError, ValueError):
            pass
    if '0.5' in pred_reset.columns:
        pred_col = '0.5'
    elif 'mean' in pred_reset.columns:
        pred_col = 'mean'
    elif non_key_cols:
        pred_col = non_key_cols[len(non_key_cols) // 2]
    else:
        return None, None, None

    carry_cols = list(dict.fromkeys([pred_col] + quantile_cols))
    if id_col and id_col in actual_df.columns:
        a = actual_df[[id_col, time_col, target_col]].copy()
        a['_item'] = a[id_col].astype(str)
        a['_ts'] = pd.to_datetime(a[time_col])
        pred_reset['_item'] = pred_reset['item_id'].astype(str)
        pred_reset['_ts'] = pd.to_datetime(pred_reset['timestamp'])
        merged = pd.merge(a, pred_reset[['_item', '_ts'] + carry_cols], on=['_item', '_ts'], how='inner')
    else:
        a = actual_df[[time_col, target_col]].copy()
        a['_ts'] = pd.to_datetime(a[time_col])
        pred_reset['_ts'] = pd.to_datetime(pred_reset['timestamp'])
        merged = pd.merge(a, pred_reset[['_ts'] + carry_cols], on=['_ts'], how='inner')

    if merged.empty:
        logger.warning("Holdout backtest: merged DataFrame is empty — timestamp/id mismatch?")
        return None, None, None

    sort_cols = ['_item', '_ts'] if '_item' in merged.columns else ['_ts']
    merged = merged.sort_values(sort_cols).reset_index(drop=True)
    if '_item' in merged.columns:
        merged['_horizon_step'] = merged.groupby('_item').cumcount() + 1
    else:
        merged['_horizon_step'] = range(1, len(merged) + 1)

    seasonal_period = seasonal_period_for(freq)
    agg = metrics.compute_all(merged[target_col].values.astype(float),
                              merged[pred_col].values.astype(float),
                              seasonal_period=seasonal_period)

    backtest_rows = []
    for _, row in merged.iterrows():
        br = {
            'timestamp': str(row['_ts']),
            'actual': float(row[target_col]),
            'forecast': float(row[pred_col]),
            'horizon_step': int(row['_horizon_step']),
        }
        # Carry quantile predictions so calibration can be computed after pooling.
        for qc in quantile_cols:
            br[f'q_{qc}'] = float(row[qc])
        if id_col and '_item' in row:
            br[id_col] = str(row['_item'])
        backtest_rows.append(br)

    per_series = []
    if id_col and '_item' in merged.columns:
        for item_val, grp_df in merged.groupby('_item'):
            sr = {id_col: str(item_val), 'n': len(grp_df)}
            sr.update(metrics.compute_all(
                grp_df[target_col].values.astype(float),
                grp_df[pred_col].values.astype(float),
                seasonal_period=seasonal_period))
            per_series.append(sr)
        per_series.sort(key=lambda x: x.get('wape', x.get('mape', x.get('rmse', 0))), reverse=True)

    return agg, per_series or None, backtest_rows


def _backtest_one_window(train_raw, actual_raw, cfg, TimeSeriesPredictor,
                         TimeSeriesDataFrame, save_path, predictor=None):
    """Fit (or reuse) a predictor on one window's train slice and score it
    against that window's raw actuals.  Returns the backtest rows for the window."""
    # Preprocess + covariates fit on THIS window's train slice only (no peeking)
    train_proc, known_cols = _prepare_training_frame(train_raw, cfg, preprocess=True)

    if predictor is None:
        predictor, ts_df, _ = _fit_predictor(
            train_proc, {**cfg, 'num_val_windows': None}, known_cols,
            TimeSeriesPredictor, TimeSeriesDataFrame, save_path)
    else:
        _, ts_df, _ = _build_static_and_ts(
            train_proc, cfg['id_col'], cfg['time_col'], cfg['static_features_cols'], TimeSeriesDataFrame)

    predict_kwargs = dict(quantile_levels=cfg['quantiles'])
    fc = _build_future_covariates(train_proc, cfg['id_col'], cfg['time_col'], cfg['freq'],
                                  cfg['horizon'], known_cols, TimeSeriesDataFrame,
                                  holiday_country=cfg.get('holiday_country'),
                                  future_df=cfg.get('future_cov_df'))
    if fc is not None:
        predict_kwargs['known_covariates'] = fc

    preds = predictor.predict(ts_df, **predict_kwargs)
    _, _, rows = _score_holdout(preds.reset_index(), actual_raw,
                                cfg['target'], cfg['time_col'], cfg['id_col'], cfg['freq'])
    return rows


def _holdout_backtest(raw_df, cfg, TimeSeriesPredictor, TimeSeriesDataFrame,
                      predictor=None):
    """Leakage-free rolling-origin out-of-sample backtest.

    Driven by the user's `backtestFolds` setting (``cfg['backtest_windows']``):
    with 1 window it's a single last-`horizon` holdout; with N>1 it's an
    N-window rolling-origin evaluation, each window stepped back
    ``cfg['val_step_size']`` points.  For each window we **fit a fresh predictor
    on only the data up to that window's origin** (fill/outlier stats fit on that
    slice) and compare to the RAW held-out actuals.  Retraining per window is the
    whole point: reusing the full-data deployment model would let it "predict"
    points it had already trained on.

    In load mode a pre-fitted `predictor` is reused for every window (assumed
    trained on a different dataset, so this data's tail is genuinely OOS).

    Returns (agg_metrics, per_series_metrics, backtest_rows) pooled over windows.
    """
    try:
        n_windows = max(1, int(cfg.get('backtest_windows') or 1))
        step_size = cfg.get('val_step_size') or cfg['horizon']
        windows = _rolling_splits(raw_df, cfg['id_col'], cfg['time_col'],
                                  cfg['horizon'], n_windows, step_size)
        if not windows:
            logger.warning("Holdout backtest skipped: no series longer than the horizon")
            return None, None, None

        # Backtest predictors are throwaway — train them into a temp dir that is
        # always removed, so repeated runs don't leak model artifacts to disk.
        # They may also use a lighter preset than the deployment model.
        bt_preset = cfg.get('backtest_preset') or cfg['preset']
        bt_cfg = {**cfg, 'num_val_windows': None, 'preset': bt_preset}
        tmp_root = tempfile.mkdtemp(prefix='ag_backtest_')
        try:
            all_rows = []
            for win_idx, (train_raw, actual_raw, fold) in enumerate(windows, start=1):
                logger.info(f"Backtest window {win_idx}/{len(windows)} (origin offset fold={fold})")
                win_path = os.path.join(tmp_root, f'w{fold}') if predictor is None else tmp_root
                rows = _backtest_one_window(train_raw, actual_raw, bt_cfg, TimeSeriesPredictor,
                                            TimeSeriesDataFrame, win_path, predictor=predictor)
                if rows:
                    # fold number increases toward the most recent window (1 = oldest origin)
                    fold_label = n_windows - fold
                    for r in rows:
                        r['fold'] = fold_label
                    all_rows.extend(rows)
        finally:
            shutil.rmtree(tmp_root, ignore_errors=True)

        if not all_rows:
            return None, None, None

        seasonal_period = seasonal_period_for(cfg['freq'])
        agg, per_series = _aggregate_backtest_rows(all_rows, cfg['id_col'], seasonal_period)
        # Drop the per-row quantile columns (used only for calibration) so the
        # SSE backtest payload stays lean.
        clean_rows = [{k: v for k, v in r.items() if not k.startswith('q_')} for r in all_rows]
        return agg, per_series, clean_rows

    except Exception as e:
        logger.warning(f"Holdout backtest failed: {e}", exc_info=True)
        return None, None, None


@register('model_config')
def handle_model_config(node_data: dict, upstream_data: list, storage=None, config: dict = None, node_outputs: dict = None, **kwargs):
    if not upstream_data:
        raise ValueError("Model Config requires upstream data")

    df = upstream_data[0].copy()
    # Optional second upstream input: a future known-covariates table (actual
    # planned values over the horizon, e.g. price/promo). Used at predict time
    # instead of forward-filling. None when only the history is connected.
    future_cov_df = upstream_data[1].copy() if len(upstream_data) > 1 else None
    mode = node_data.get('modelMode', 'train')
    
    fill_configs = node_data.get('cfgFillConfigs') or {}
    outlier_configs = node_data.get('cfgOutlierConfigs') or {}
    fill_enabled = node_data.get('cfgFillMissing', False)
    outlier_enabled = node_data.get('cfgOutlierTreatment', False)
    
    if not fill_enabled:
        fill_configs = {}
    if not outlier_enabled:
        outlier_configs = {}
    
    # AutoGluon is THE forecasting engine — it already ships the full statistical
    # suite (SeasonalNaive, ETS/AutoETS, Theta, (Auto)ARIMA, Croston/NPTS for
    # intermittent demand) plus deep models, all trained and backtested inside
    # one leakage-safe framework.  We deliberately do NOT carry a second, parallel
    # forecasting code path; if AutoGluon is missing we fail loudly rather than
    # silently returning a different (and less trustworthy) kind of forecast.
    try:
        from autogluon.timeseries import TimeSeriesPredictor, TimeSeriesDataFrame
    except ImportError as e:
        raise ValueError(
            "AutoGluon is required for forecasting but is not installed. "
            "Install it with `pip install autogluon.timeseries` (or `uv sync`). "
            f"(import error: {e})"
        )

    # ── Core config ─────────────────────────────────────────────────────────
    target_col = node_data.get('cfgTargetVar', '')
    time_col = node_data.get('cfgTimeCol', node_data.get('configDateColumn', ''))
    id_col = node_data.get('cfgDfu', '')
    _hz_raw = node_data.get('forecastHorizon', 12)
    try:
        horizon = int(_hz_raw) if str(_hz_raw).strip() else 12
    except (ValueError, TypeError):
        horizon = 12

    # Frequency: normalise human-readable → AutoGluon alias
    freq_raw = node_data.get('dataFrequency', 'M')
    freq = _resolve_freq(freq_raw)

    # Preset: map 'fast' → 'fast_training', etc.
    preset_raw = node_data.get('cfgPreset', 'medium_quality')
    preset = _resolve_preset(preset_raw)

    # Optional lighter preset for throwaway backtest fits (defaults to the
    # deployment preset when unset, preserving previous behaviour).
    bt_preset_raw = node_data.get('cfgBacktestPreset')
    backtest_preset = _resolve_preset(bt_preset_raw) if bt_preset_raw else preset

    _tl_raw = node_data.get('cfgTimeLimit', 600)
    try:
        time_limit = int(_tl_raw) if str(_tl_raw).strip() else 600
    except (ValueError, TypeError):
        time_limit = 600
    backtest_enabled = node_data.get('backtestEnabled', False)
    _nf_raw = node_data.get('backtestFolds', 3)
    try:
        n_folds = int(_nf_raw) if str(_nf_raw).strip() else 3
    except (ValueError, TypeError):
        n_folds = 3
    # backtestStepSize: how many steps between validation windows (default = horizon)
    step_size_raw = node_data.get('backtestStepSize', None)
    try:
        backtest_step_size = int(float(step_size_raw)) if step_size_raw is not None and str(step_size_raw).strip() else horizon
    except (ValueError, TypeError):
        backtest_step_size = horizon
    refit_full = bool(node_data.get('cfgRefitFull', False))

    # Quantiles for confidence intervals
    quantiles = _parse_quantiles(node_data.get('cfgQuantiles'))

    # Model selection: excluded = de-selected models in UI
    excluded_models = _build_excluded_models(node_data.get('cfgSelectedModels', {}))

    # Eval metric
    eval_metric = node_data.get('cfgEvalMetric', 'MASE') or 'MASE'

    # Resource config
    num_gpus = node_data.get('cfgGpus', 'auto')
    num_cpus = node_data.get('cfgCpus', 'auto')
    if num_gpus == 'auto':
        num_gpus = None  # let AutoGluon decide
    else:
        try:
            num_gpus = int(num_gpus)
        except Exception:
            num_gpus = None
    if num_cpus == 'auto':
        num_cpus = None
    else:
        try:
            num_cpus = int(num_cpus)
        except Exception:
            num_cpus = None
    
    if not target_col or not time_col:
        raise ValueError("Target variable and timestamp column are required")

    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(time_col).reset_index(drop=True)

    # ── Pre-training data-quality gate ───────────────────────────────────────
    # Fail fast on fatal problems and collect advisory warnings before a long fit.
    from engine.data_quality import check_forecast_data
    dq = check_forecast_data(df, target_col, time_col, id_col, horizon)
    if dq['errors']:
        raise ValueError("Data quality check failed: " + "; ".join(dq['errors']))
    for w in dq['warnings']:
        logger.warning(f"Data quality: {w}")

    # Keep an un-preprocessed copy: the backtest must split *before* any
    # fill/outlier statistics are computed, so it can fit those on train-only
    # data and score against the raw (untreated) actuals — no leakage.
    raw_df = df.copy()

    holiday_enabled = bool(node_data.get('cfgHolidayEnabled', False))
    holiday_country = (node_data.get('cfgHolidayCountry') or '').strip() or None

    model_path = config.get('MODEL_PATH', 'models') if config else 'models'
    save_path = os.path.join(model_path, f"ag_model_{int(time.time())}")
    os.makedirs(save_path, exist_ok=True)

    static_features_cols = [c for c in node_data.get('cfgStaticFeatures', []) or []
                             if c and c in df.columns and c not in [id_col, time_col, target_col]]
    # Base (user-specified) known covariates; calendar columns are appended later
    # by _prepare_training_frame so the same logic runs for the main fit and the
    # per-fold backtest fit.
    base_known_cols = [c for c in node_data.get('cfgKnownCovariates', []) or []
                       if c and c in df.columns and c not in [id_col, time_col, target_col]]

    # Single config object shared by the main fit and the backtest fit so they
    # are guaranteed to use identical settings.
    cfg = {
        'target': target_col, 'time_col': time_col, 'id_col': id_col,
        'horizon': horizon, 'freq': freq, 'eval_metric': eval_metric,
        'preset': preset, 'time_limit': time_limit, 'refit_full': refit_full,
        'quantiles': quantiles, 'excluded_models': excluded_models,
        'num_gpus': num_gpus, 'num_cpus': num_cpus,
        'static_features_cols': static_features_cols,
        'known_covariates_cols': base_known_cols,
        'fill_configs': fill_configs, 'outlier_configs': outlier_configs,
        'holiday_enabled': holiday_enabled, 'holiday_country': holiday_country,
        'num_val_windows': n_folds if (backtest_enabled and n_folds > 1) else None,
        'val_step_size': backtest_step_size,
        # Rolling-origin window count for the explicit OOS backtest, driven by the
        # user's backtestFolds setting (1 = single holdout, N = N rolling windows).
        'backtest_windows': max(1, n_folds) if backtest_enabled else 1,
        # Backtest fits are throwaway; let them optionally use a lighter preset
        # than the deployment model so N-window backtests don't multiply runtime.
        'backtest_preset': backtest_preset,
        # Optional user-supplied future known-covariate table (second upstream).
        'future_cov_df': future_cov_df,
    }

    # Preprocess + calendar-augment the FULL series for the deployment model.
    df, known_covariates_cols = _prepare_training_frame(raw_df, cfg, preprocess=True)

    if mode == 'train':
        # Fit the deployment model on the full (preprocessed + calendar) series.
        predictor, ts_df, static_df = _fit_predictor(
            df, cfg, known_covariates_cols, TimeSeriesPredictor, TimeSeriesDataFrame, save_path)
        logger.info(f"Known covariates: {known_covariates_cols}; static: {static_features_cols}")

        # ── Predict: handle known covariates ────────────────────────────────
        # If known_covariates_names is set, AutoGluon needs future covariate
        # values over the horizon. We project the last observed values forward.
        predict_kwargs = dict(quantile_levels=quantiles)
        future_cov_ts = _build_future_covariates(
            df, id_col, time_col, freq, horizon, known_covariates_cols, TimeSeriesDataFrame,
            holiday_country=holiday_country, future_df=future_cov_df)
        if future_cov_ts is not None:
            predict_kwargs['known_covariates'] = future_cov_ts
            logger.info("Built future covariate stub for prediction")

        predictions = predictor.predict(ts_df, **predict_kwargs)

        importance = compute_feature_importance(predictor, df, target_col, time_col, id_col, ts_data=ts_df)
        
        results = {
            'dataframe': df,
            'message': f'Model trained ({preset}) and saved to {save_path}',
            'info': {
                'model_path': save_path,
                'rows': len(df),
                'columns': list(df.columns),
                'target': target_col,
                'horizon': horizon,
                'preset': preset,
                'freq': freq,
                'quantiles': quantiles,
            },
            'forecast': json.loads(predictions.reset_index().to_json(orient='records', date_format='iso')),
        }
        
        if importance:
            results['feature_importance'] = importance

        # ── Leaderboard (always computed) ────────────────────────────────────
        try:
            leaderboard = predictor.leaderboard(ts_df)
            lb_records = json.loads(leaderboard.to_json(orient='records'))
            results['leaderboard'] = lb_records
            # Surface the best model's internal validation score as ag_score
            if lb_records:
                best = lb_records[0]
                score_val = best.get('score_val')
                if score_val is not None:
                    try:
                        # AutoGluon maximizes, so score_val = -metric_value for error metrics
                        results['info']['ag_score_val'] = round(float(score_val), 4)
                        results['info']['ag_eval_metric'] = eval_metric
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Leaderboard failed: {e}")

        # ── Holdout backtest (leakage-free out-of-sample evaluation) ─────────
        # Trains a FRESH predictor on data with the last `horizon` points per
        # series removed, then scores against the raw held-out actuals.
        if backtest_enabled:
            try:
                agg, per_series, backtest_rows = _holdout_backtest(
                    raw_df, cfg, TimeSeriesPredictor, TimeSeriesDataFrame,
                )
                if agg:
                    results['info'].update(agg)
                if per_series:
                    results['per_series_metrics'] = per_series
                if backtest_rows:
                    results['backtest'] = backtest_rows
                    results['info']['backtest_method'] = 'retrain_oos'
            except Exception as e:
                logger.warning(f"Holdout backtest failed: {e}", exc_info=True)

            # Also surface AutoGluon's internal CV evaluation score
            try:
                scores = predictor.evaluate(ts_df)
                logger.info(f"AutoGluon evaluate scores: {scores}")
                if isinstance(scores, dict):
                    for k, v in scores.items():
                        try:
                            results['info'][f'ag_{k.lower()}'] = round(float(v), 4)
                        except Exception:
                            pass
                elif isinstance(scores, (int, float)):
                    results['info']['ag_eval_score'] = round(float(scores), 4)
            except Exception as e:
                logger.warning(f"predictor.evaluate failed: {e}")
        
        return results
    
    elif mode == 'load':
        load_path = node_data.get('modelPath', '')
        if not load_path:
            raise ValueError("Model path is required for load mode")
        
        predictor = TimeSeriesPredictor.load(load_path)

        static_df, ts_df, _ = _build_static_and_ts(
            df, id_col, time_col, static_features_cols, TimeSeriesDataFrame)

        predict_kwargs = dict(quantile_levels=quantiles)
        future_cov_ts = _build_future_covariates(
            df, id_col, time_col, freq, horizon, known_covariates_cols, TimeSeriesDataFrame,
            holiday_country=holiday_country, future_df=future_cov_df)
        if future_cov_ts is not None:
            predict_kwargs['known_covariates'] = future_cov_ts

        predictions = predictor.predict(ts_df, **predict_kwargs)

        load_results = {
            'dataframe': df,
            'message': f'Loaded model from {load_path}',
            'info': {
                'model_path': load_path,
                'rows': len(df),
                'forecast_rows': len(predictions),
                'quantiles': quantiles,
                'horizon': horizon,
                'freq': freq,
                'data_quality': dq,
            },
            'forecast': json.loads(predictions.reset_index().to_json(orient='records', date_format='iso')),
        }

        # ── Feature importance (load mode) ───────────────────────────────────
        load_importance = compute_feature_importance(predictor, df, target_col, time_col, id_col, ts_data=ts_df)
        if load_importance:
            load_results['feature_importance'] = load_importance

        # ── Leaderboard (load mode) ───────────────────────────────────────────
        try:
            lb = predictor.leaderboard(ts_df)
            lb_records = json.loads(lb.to_json(orient='records'))
            load_results['leaderboard'] = lb_records
            if lb_records:
                best = lb_records[0]
                sv = best.get('score_val')
                if sv is not None:
                    load_results['info']['ag_score_val'] = round(float(sv), 4)
                    load_results['info']['ag_eval_metric'] = predictor.eval_metric
        except Exception as e:
            logger.warning(f"Load-mode leaderboard failed: {e}")

        # ── Holdout backtest (load mode, if enabled) ──────────────────────────
        # Reuses the loaded model (assumed trained on a different dataset, so the
        # held-out tail of THIS data is genuinely out-of-sample) and scores
        # against the raw actuals.
        if backtest_enabled:
            try:
                agg, per_series, backtest_rows = _holdout_backtest(
                    raw_df, cfg, TimeSeriesPredictor, TimeSeriesDataFrame,
                    predictor=predictor,
                )
                if agg:
                    load_results['info'].update(agg)
                if per_series:
                    load_results['per_series_metrics'] = per_series
                if backtest_rows:
                    load_results['backtest'] = backtest_rows
                    load_results['info']['backtest_method'] = 'loaded_model_oos'
            except Exception as e:
                logger.warning(f"Load-mode holdout backtest failed: {e}", exc_info=True)

        # ── AutoGluon evaluate score (load mode) ──────────────────────────────
        try:
            scores = predictor.evaluate(ts_df)
            if isinstance(scores, dict):
                for k, v in scores.items():
                    try:
                        load_results['info'][f'ag_{k.lower()}'] = round(float(v), 4)
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Load-mode predictor.evaluate failed: {e}")

        return load_results

    else:
        raise ValueError(f"Unknown model mode: {mode}")
