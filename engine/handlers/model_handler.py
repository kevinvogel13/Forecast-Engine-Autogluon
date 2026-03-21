import pandas as pd
import numpy as np
import json
import os
import time
import logging
from engine.handlers.registry import register

logger = logging.getLogger('engine')


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


def run_statistical_forecast(df, node_data, fill_configs, outlier_configs):
    target_col = node_data.get('cfgTargetVar', '')
    time_col = node_data.get('cfgTimeCol', node_data.get('configDateColumn', ''))
    id_col = node_data.get('cfgDfu', '')
    horizon = int(node_data.get('forecastHorizon', 12))
    freq = node_data.get('dataFrequency', 'M')
    backtest_enabled = node_data.get('backtestEnabled', False)
    n_folds = int(node_data.get('backtestFolds', 3))
    
    if not target_col or not time_col:
        raise ValueError("Target variable and timestamp column are required")
    
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(time_col)
    
    df, train_stats = preprocess_fold(df, fill_configs, outlier_configs)
    
    importance = compute_feature_importance(None, df, target_col, time_col, id_col)
    
    freq_map = {'D': 'D', 'W': 'W', 'M': 'MS', 'Q': 'QS', 'Y': 'YS'}
    pd_freq = freq_map.get(freq, 'MS')
    
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

        # Per-series accuracy breakdown
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
    
    target_col = node_data.get('cfgTargetVar', '')
    time_col = node_data.get('cfgTimeCol', node_data.get('configDateColumn', ''))
    id_col = node_data.get('cfgDfu', '')
    horizon = int(node_data.get('forecastHorizon', 12))
    freq = node_data.get('dataFrequency', 'M')
    preset = node_data.get('cfgPreset', 'medium_quality')
    time_limit = int(node_data.get('cfgTimeLimit', 600))
    backtest_enabled = node_data.get('backtestEnabled', False)
    n_folds = int(node_data.get('backtestFolds', 3))
    
    if not target_col or not time_col:
        raise ValueError("Target variable and timestamp column are required")
    
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.sort_values(time_col)
    
    df, train_stats = preprocess_fold(df, fill_configs, outlier_configs)
    
    model_path = config.get('MODEL_PATH', 'models') if config else 'models'
    save_path = os.path.join(model_path, f"ag_model_{int(time.time())}")
    os.makedirs(save_path, exist_ok=True)
    
    static_features_cols = [c for c in node_data.get('cfgStaticFeatures', []) or [] if c and c in df.columns and c not in [id_col, time_col, target_col]]
    known_covariates_cols = [c for c in node_data.get('cfgKnownCovariates', []) or [] if c and c in df.columns and c not in [id_col, time_col, target_col]]
    eval_metric = node_data.get('cfgEvalMetric', 'MASE') or 'MASE'

    if mode == 'train':
        static_df = None
        ts_input_df = df.copy()
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

        predictor.fit(
            train_data=ts_df,
            presets=preset,
            time_limit=time_limit,
        )
        
        predictions = predictor.predict(ts_df)
        
        importance = compute_feature_importance(predictor, df, target_col, time_col, id_col)
        
        results = {
            'dataframe': df,
            'message': f'Model trained and saved to {save_path}',
            'info': {
                'model_path': save_path,
                'rows': len(df),
                'columns': list(df.columns),
                'target': target_col,
                'horizon': horizon,
                'preset': preset,
            },
            'forecast': json.loads(predictions.reset_index().to_json(orient='records', date_format='iso')),
        }
        
        if importance:
            results['feature_importance'] = importance
        
        if backtest_enabled:
            try:
                leaderboard = predictor.leaderboard(ts_df)
                results['info']['leaderboard'] = json.loads(leaderboard.to_json(orient='records'))
            except Exception as e:
                logger.warning(f"Leaderboard failed: {e}")
        
        return results
    
    elif mode == 'load':
        load_path = node_data.get('modelPath', '')
        if not load_path:
            raise ValueError("Model path is required for load mode")
        
        predictor = TimeSeriesPredictor.load(load_path)
        
        ts_df = TimeSeriesDataFrame.from_data_frame(
            df,
            id_column=id_col if id_col else None,
            timestamp_column=time_col,
        )
        
        predictions = predictor.predict(ts_df)
        
        return {
            'dataframe': df,
            'message': f'Loaded model from {load_path}',
            'info': {
                'model_path': load_path,
                'rows': len(df),
                'forecast_rows': len(predictions),
            },
            'forecast': json.loads(predictions.reset_index().to_json(orient='records', date_format='iso')),
        }
    
    else:
        raise ValueError(f"Unknown model mode: {mode}")
