import pandas as pd
import numpy as np
import json
import os
import time
import logging
from engine.handlers.registry import register

logger = logging.getLogger('engine')

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
    'D': 'D', 'W': 'W', 'M': 'MS', 'Q': 'QS', 'Y': 'YS',
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


def _build_excluded_models(selected_models: dict) -> list:
    """Return list of model type strings the user *de-selected*."""
    if not selected_models:
        return []
    return [k for k, v in selected_models.items() if not v]


def apply_fill_missing_per_column(df: pd.DataFrame, fill_configs: dict, fit_stats: dict = None) -> tuple:
    stats = fit_stats or {}
    df = df.copy()
    
    for col, cfg in fill_configs.items():
        if col not in df.columns:
            continue
        strategy = cfg.get('strategy', 'ffill')
        constant = cfg.get('constant', '')
        
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
        threshold = float(cfg.get('threshold', 1.5))
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
                lower = col_data.quantile(threshold)
                upper = col_data.quantile(1 - threshold)
            else:
                continue
            stats[col_key] = {'lower': lower, 'upper': upper, 'median': col_data.median(), 'mean': col_data.mean()}
        
        bounds = stats[col_key]
        lower, upper = bounds['lower'], bounds['upper']
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        
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
                                time_col: str, id_col: str, n_iterations: int = 5):
    try:
        if hasattr(model, 'feature_importance'):
            importance = model.feature_importance()
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


def _compute_backtest_metrics_from_predictions(predictions_df, ts_df, target_col, id_col):
    """
    Extract MAPE/RMSE/MAE from AutoGluon predictions vs actual data.
    predictions_df has the forecast horizon rows; ts_df has actuals.
    Returns (mape, rmse, mae, per_series_metrics, backtest_rows).
    """
    try:
        # Flatten predictions to a comparable form
        pred_reset = predictions_df.reset_index() if hasattr(predictions_df, 'reset_index') else predictions_df

        # Try to join with actuals by item_id + timestamp
        actual_reset = ts_df.reset_index() if hasattr(ts_df, 'reset_index') else ts_df.copy()

        # Normalise column names
        ts_col = [c for c in actual_reset.columns if 'timestamp' in c.lower() or 'date' in c.lower() or 'time' in c.lower()]
        item_col = [c for c in actual_reset.columns if 'item_id' in c.lower() or (id_col and c == id_col)]

        if not ts_col:
            return None, None, None, None, None

        ts_col = ts_col[0]
        item_col = item_col[0] if item_col else None

        merge_keys = [ts_col]
        if item_col and item_col in pred_reset.columns:
            merge_keys = [item_col, ts_col]

        pred_col = '0.5' if '0.5' in pred_reset.columns else 'mean' if 'mean' in pred_reset.columns else None
        if pred_col is None:
            # Take the column closest to median
            num_cols = [c for c in pred_reset.columns if c not in merge_keys]
            pred_col = num_cols[len(num_cols) // 2] if num_cols else None

        if pred_col is None or target_col not in actual_reset.columns:
            return None, None, None, None, None

        merged = pd.merge(actual_reset[[*merge_keys, target_col]],
                          pred_reset[[*merge_keys, pred_col]],
                          on=merge_keys, how='inner')

        if merged.empty:
            return None, None, None, None, None

        actuals = merged[target_col].values
        forecasts = merged[pred_col].values
        non_zero = actuals != 0

        mape = round(float(np.mean(np.abs((actuals[non_zero] - forecasts[non_zero]) / actuals[non_zero])) * 100), 2) if non_zero.any() else None
        rmse = round(float(np.sqrt(np.mean((actuals - forecasts) ** 2))), 2)
        mae = round(float(np.mean(np.abs(actuals - forecasts))), 2)

        backtest_rows = []
        for _, row in merged.iterrows():
            br = {ts_col: row[ts_col], 'actual': float(row[target_col]), 'forecast': float(row[pred_col])}
            if item_col and item_col in row:
                br[item_col] = row[item_col]
            backtest_rows.append(br)

        per_series = []
        if item_col and item_col in merged.columns:
            for grp_name, grp_df in merged.groupby(item_col):
                a = grp_df[target_col].values
                f = grp_df[pred_col].values
                nz = a != 0
                sr = {id_col or item_col: str(grp_name), 'n': len(a),
                      'rmse': round(float(np.sqrt(np.mean((a - f) ** 2))), 2),
                      'mae': round(float(np.mean(np.abs(a - f))), 2)}
                if nz.any():
                    sr['mape'] = round(float(np.mean(np.abs((a[nz] - f[nz]) / a[nz])) * 100), 2)
                per_series.append(sr)
            per_series.sort(key=lambda x: x.get('mape', x.get('rmse', 0)), reverse=True)

        return mape, rmse, mae, per_series or None, backtest_rows

    except Exception as e:
        logger.warning(f"Could not compute backtest metrics from AutoGluon predictions: {e}")
        return None, None, None, None, None


def run_statistical_forecast(df, node_data, fill_configs, outlier_configs):
    target_col = node_data.get('cfgTargetVar', '')
    time_col = node_data.get('cfgTimeCol', node_data.get('configDateColumn', ''))
    id_col = node_data.get('cfgDfu', '')
    horizon = int(node_data.get('forecastHorizon', 12))
    freq_raw = node_data.get('dataFrequency', 'M')
    freq = FREQ_MAP.get(freq_raw, freq_raw)
    backtest_enabled = node_data.get('backtestEnabled', False)
    n_folds = int(node_data.get('backtestFolds', 3))
    
    if not target_col or not time_col:
        raise ValueError("Target variable and timestamp column are required")
    
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(time_col)
    
    df, train_stats = preprocess_fold(df, fill_configs, outlier_configs)
    
    importance = compute_feature_importance(None, df, target_col, time_col, id_col)
    
    results = {
        'dataframe': df,
        'message': 'Statistical forecast completed',
        'info': {
            'rows': len(df),
            'columns': list(df.columns),
            'target': target_col,
            'horizon': horizon,
        },
    }
    
    if importance:
        results['feature_importance'] = importance
    
    if id_col and id_col in df.columns:
        groups = df.groupby(id_col)
    else:
        groups = [('all', df)]
    
    forecast_rows = []
    backtest_rows = []
    
    for group_name, group_df in groups:
        group_df = group_df.sort_values(time_col)
        values = group_df[target_col].values
        
        if len(values) < 3:
            continue
        
        mean_val = np.mean(values[-min(12, len(values)):])
        std_val = np.std(values[-min(12, len(values)):]) if len(values) > 1 else mean_val * 0.1
        
        trend = 0
        if len(values) >= 6:
            recent = np.mean(values[-3:])
            earlier = np.mean(values[-6:-3])
            if earlier != 0:
                trend = (recent - earlier) / earlier
        
        last_date = group_df[time_col].max()
        
        for h in range(1, horizon + 1):
            forecast_val = mean_val * (1 + trend * h / horizon)
            lower = forecast_val - 1.96 * std_val
            upper = forecast_val + 1.96 * std_val
            
            future_date = last_date + pd.DateOffset(**{
                'D': {'days': h}, 'W': {'weeks': h}, 'M': {'months': h},
                'Q': {'months': h * 3}, 'Y': {'years': h}
            }.get(freq, {'months': h}))
            
            row = {
                time_col: future_date,
                'forecast': round(forecast_val, 4),
                'forecast_lower': round(lower, 4),
                'forecast_upper': round(upper, 4),
                'horizon_step': h,
            }
            if id_col:
                row[id_col] = group_name
            forecast_rows.append(row)
        
        if backtest_enabled and len(values) > horizon * 2:
            for fold in range(n_folds):
                fold_end = len(values) - fold * horizon
                fold_start = fold_end - horizon
                if fold_start < 3:
                    break
                
                train_vals = values[:fold_start]
                actual_vals = values[fold_start:fold_end]
                train_mean = np.mean(train_vals[-min(12, len(train_vals)):])
                
                for step, actual in enumerate(actual_vals):
                    bt_row = {
                        time_col: group_df[time_col].iloc[fold_start + step] if fold_start + step < len(group_df) else None,
                        'actual': float(actual),
                        'forecast': round(float(train_mean), 4),
                        'fold': n_folds - fold,
                        'horizon_step': step + 1,
                    }
                    if id_col:
                        bt_row[id_col] = group_name
                    backtest_rows.append(bt_row)
    
    if forecast_rows:
        forecast_df = pd.DataFrame(forecast_rows)
        results['forecast'] = json.loads(forecast_df.to_json(orient='records', date_format='iso'))
        results['info']['forecast_rows'] = len(forecast_rows)
    
    if backtest_rows:
        backtest_df = pd.DataFrame(backtest_rows)
        results['backtest'] = json.loads(backtest_df.to_json(orient='records', date_format='iso'))
        results['info']['backtest_rows'] = len(backtest_rows)
        
        actuals = backtest_df['actual'].values
        forecasts = backtest_df['forecast'].values
        non_zero = actuals != 0
        if non_zero.any():
            results['info']['mape'] = round(float(np.mean(np.abs((actuals[non_zero] - forecasts[non_zero]) / actuals[non_zero])) * 100), 2)
        results['info']['rmse'] = round(float(np.sqrt(np.mean((actuals - forecasts) ** 2))), 2)
        results['info']['mae'] = round(float(np.mean(np.abs(actuals - forecasts))), 2)

        if id_col and id_col in backtest_df.columns:
            per_series = []
            for grp_name, grp_df in backtest_df.groupby(id_col):
                a = grp_df['actual'].values
                f = grp_df['forecast'].values
                nz = a != 0
                row = {id_col: str(grp_name), 'n': len(a),
                       'rmse': round(float(np.sqrt(np.mean((a - f) ** 2))), 2),
                       'mae': round(float(np.mean(np.abs(a - f))), 2)}
                if nz.any():
                    row['mape'] = round(float(np.mean(np.abs((a[nz] - f[nz]) / a[nz])) * 100), 2)
                per_series.append(row)
            per_series.sort(key=lambda x: x.get('mape', x.get('rmse', 0)), reverse=True)
            results['per_series_metrics'] = per_series
    
    return results


@register('model_config')
def handle_model_config(node_data: dict, upstream_data: list, storage=None, config: dict = None, node_outputs: dict = None, **kwargs):
    if not upstream_data:
        raise ValueError("Model Config requires upstream data")
    
    df = upstream_data[0].copy()
    mode = node_data.get('modelMode', 'train')
    
    fill_configs = node_data.get('cfgFillConfigs', {})
    outlier_configs = node_data.get('cfgOutlierConfigs', {})
    fill_enabled = node_data.get('cfgFillMissing', False)
    outlier_enabled = node_data.get('cfgOutlierTreatment', False)
    
    if not fill_enabled:
        fill_configs = {}
    if not outlier_enabled:
        outlier_configs = {}
    
    try:
        from autogluon.timeseries import TimeSeriesPredictor, TimeSeriesDataFrame
        has_autogluon = True
    except ImportError:
        has_autogluon = False
        logger.warning("AutoGluon not installed, using statistical fallback")
    
    if not has_autogluon:
        return run_statistical_forecast(df, node_data, fill_configs, outlier_configs)
    
    # ── Core config ─────────────────────────────────────────────────────────
    target_col = node_data.get('cfgTargetVar', '')
    time_col = node_data.get('cfgTimeCol', node_data.get('configDateColumn', ''))
    id_col = node_data.get('cfgDfu', '')
    horizon = int(node_data.get('forecastHorizon', 12))

    # Frequency: normalise human-readable → AutoGluon alias
    freq_raw = node_data.get('dataFrequency', 'M')
    freq = _resolve_freq(freq_raw)

    # Preset: map 'fast' → 'fast_training', etc.
    preset_raw = node_data.get('cfgPreset', 'medium_quality')
    preset = _resolve_preset(preset_raw)

    time_limit = int(node_data.get('cfgTimeLimit', 600))
    backtest_enabled = node_data.get('backtestEnabled', False)
    n_folds = int(node_data.get('backtestFolds', 3))
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
    df = df.sort_values(time_col)
    
    df, train_stats = preprocess_fold(df, fill_configs, outlier_configs)
    
    model_path = config.get('MODEL_PATH', 'models') if config else 'models'
    save_path = os.path.join(model_path, f"ag_model_{int(time.time())}")
    os.makedirs(save_path, exist_ok=True)
    
    static_features_cols = [c for c in node_data.get('cfgStaticFeatures', []) or []
                             if c and c in df.columns and c not in [id_col, time_col, target_col]]
    known_covariates_cols = [c for c in node_data.get('cfgKnownCovariates', []) or []
                              if c and c in df.columns and c not in [id_col, time_col, target_col]]

    if mode == 'train':
        static_df = None
        ts_input_df = df.copy()

        # Build static features DataFrame (one row per item_id)
        if static_features_cols and id_col and id_col in df.columns:
            try:
                static_df = df.groupby(id_col)[static_features_cols].first()
                ts_input_df = df.drop(columns=static_features_cols, errors='ignore')
                logger.info(f"Static features: {static_features_cols}")
            except Exception as e:
                logger.warning(f"Could not build static features df: {e}")
                static_df = None
                ts_input_df = df.copy()

        ts_df = TimeSeriesDataFrame.from_data_frame(
            ts_input_df,
            id_column=id_col if id_col else None,
            timestamp_column=time_col,
            static_features_df=static_df,
        )

        # Build predictor kwargs
        predictor_kwargs = dict(
            target=target_col,
            prediction_length=horizon,
            freq=freq,
            path=save_path,
            eval_metric=eval_metric,
        )
        if known_covariates_cols:
            predictor_kwargs['known_covariates_names'] = known_covariates_cols
            logger.info(f"Known covariates: {known_covariates_cols}")

        predictor = TimeSeriesPredictor(**predictor_kwargs)

        # Build fit kwargs
        fit_kwargs = dict(
            train_data=ts_df,
            presets=preset,
            time_limit=time_limit,
            refit_full=refit_full,
        )
        if excluded_models:
            fit_kwargs['excluded_model_types'] = excluded_models
            logger.info(f"Excluded models: {excluded_models}")
        if num_gpus is not None:
            fit_kwargs['num_gpus'] = num_gpus
        if num_cpus is not None:
            fit_kwargs['num_cpus'] = num_cpus

        predictor.fit(**fit_kwargs)

        # ── Predict: handle known covariates ────────────────────────────────
        # If known_covariates_names is set, AutoGluon needs future covariate
        # data at predict time. Without it, prediction will fail.
        # We use the last `horizon` rows of each series as a proxy for future
        # covariates (realistic only if the dataset already contains them).
        predict_kwargs = dict(quantile_levels=quantiles)
        if known_covariates_cols:
            try:
                # Build future covariate stub: repeat last known values per series
                if id_col and id_col in df.columns:
                    cov_frames = []
                    for item, grp in df.groupby(id_col):
                        grp = grp.sort_values(time_col)
                        last_date = grp[time_col].max()
                        future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]
                        last_row = grp.iloc[-1]
                        cov_rows = pd.DataFrame({
                            id_col: item,
                            time_col: future_dates,
                            **{c: last_row[c] for c in known_covariates_cols if c in grp.columns},
                        })
                        cov_frames.append(cov_rows)
                    if cov_frames:
                        future_cov_df = pd.concat(cov_frames, ignore_index=True)
                        future_cov_ts = TimeSeriesDataFrame.from_data_frame(
                            future_cov_df, id_column=id_col, timestamp_column=time_col
                        )
                        predict_kwargs['known_covariates'] = future_cov_ts
                        logger.info("Built future covariate stub for prediction")
            except Exception as e:
                logger.warning(f"Could not build known_covariates for predict: {e}. Predicting without them.")

        predictions = predictor.predict(ts_df, **predict_kwargs)
        
        importance = compute_feature_importance(predictor, df, target_col, time_col, id_col)
        
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

        # ── Leaderboard ──────────────────────────────────────────────────────
        try:
            leaderboard = predictor.leaderboard(ts_df)
            results['leaderboard'] = json.loads(leaderboard.to_json(orient='records'))
        except Exception as e:
            logger.warning(f"Leaderboard failed: {e}")

        # ── Backtest metrics from predictions vs actuals ─────────────────────
        # Use the overlap between predictions (in-sample horizon rows) and
        # actual data to derive MAPE / RMSE / MAE and per-series breakdown.
        if backtest_enabled:
            try:
                mape, rmse, mae, per_series, backtest_rows = _compute_backtest_metrics_from_predictions(
                    predictions, ts_df, target_col, id_col
                )
                if mape is not None:
                    results['info']['mape'] = mape
                if rmse is not None:
                    results['info']['rmse'] = rmse
                if mae is not None:
                    results['info']['mae'] = mae
                if per_series:
                    results['per_series_metrics'] = per_series
                if backtest_rows:
                    results['backtest'] = backtest_rows
            except Exception as e:
                logger.warning(f"Backtest metric extraction failed: {e}")

            # Additionally compute walk-forward CV score via AutoGluon evaluate
            try:
                scores = predictor.evaluate(ts_df)
                logger.info(f"AutoGluon evaluate scores: {scores}")
                if isinstance(scores, dict):
                    for k, v in scores.items():
                        try:
                            results['info'][f'ag_{k.lower()}'] = round(float(v), 4)
                        except Exception:
                            pass
            except Exception as e:
                logger.warning(f"predictor.evaluate failed: {e}")
        
        return results
    
    elif mode == 'load':
        load_path = node_data.get('modelPath', '')
        if not load_path:
            raise ValueError("Model path is required for load mode")
        
        predictor = TimeSeriesPredictor.load(load_path)

        static_df = None
        ts_input_df = df.copy()
        if static_features_cols and id_col and id_col in df.columns:
            try:
                static_df = df.groupby(id_col)[static_features_cols].first()
                ts_input_df = df.drop(columns=static_features_cols, errors='ignore')
            except Exception:
                pass

        ts_df = TimeSeriesDataFrame.from_data_frame(
            ts_input_df,
            id_column=id_col if id_col else None,
            timestamp_column=time_col,
            static_features_df=static_df,
        )

        predict_kwargs = dict(quantile_levels=quantiles)
        if known_covariates_cols:
            try:
                if id_col and id_col in df.columns:
                    cov_frames = []
                    for item, grp in df.groupby(id_col):
                        grp = grp.sort_values(time_col)
                        last_date = grp[time_col].max()
                        future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]
                        last_row = grp.iloc[-1]
                        cov_rows = pd.DataFrame({
                            id_col: item,
                            time_col: future_dates,
                            **{c: last_row[c] for c in known_covariates_cols if c in grp.columns},
                        })
                        cov_frames.append(cov_rows)
                    if cov_frames:
                        future_cov_ts = TimeSeriesDataFrame.from_data_frame(
                            pd.concat(cov_frames, ignore_index=True), id_column=id_col, timestamp_column=time_col
                        )
                        predict_kwargs['known_covariates'] = future_cov_ts
            except Exception as e:
                logger.warning(f"Could not build known_covariates for load-mode predict: {e}")

        predictions = predictor.predict(ts_df, **predict_kwargs)
        
        return {
            'dataframe': df,
            'message': f'Loaded model from {load_path}',
            'info': {
                'model_path': load_path,
                'rows': len(df),
                'forecast_rows': len(predictions),
                'quantiles': quantiles,
            },
            'forecast': json.loads(predictions.reset_index().to_json(orient='records', date_format='iso')),
        }
    
    else:
        raise ValueError(f"Unknown model mode: {mode}")
