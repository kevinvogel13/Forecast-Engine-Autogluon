import pandas as pd
import numpy as np
import logging
from engine.handlers.registry import register

logger = logging.getLogger('engine')


@register('fill_missing')
def handle_fill_missing(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Fill Missing requires upstream data")
    
    df = upstream_data[0].copy()
    columns = node_data.get('fillColumns', [])
    strategy = node_data.get('fillStrategy', 'ffill')
    constant = node_data.get('fillConstant', '')
    
    if not columns:
        columns = df.columns.tolist()
    
    target_cols = [c for c in columns if c in df.columns]
    
    for col in target_cols:
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
                df[col] = df[col].fillna(df[col].mean())
        elif strategy == 'median':
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
        elif strategy == 'zero':
            df[col] = df[col].fillna(0)
        elif strategy == 'constant':
            try:
                fill_val = float(constant)
            except (ValueError, TypeError):
                fill_val = constant
            df[col] = df[col].fillna(fill_val)
    
    logger.info(f"Fill Missing: applied '{strategy}' to {len(target_cols)} columns")
    return df


@register('column_transform')
def handle_column_transform(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Column Transform requires upstream data")
    
    df = upstream_data[0].copy()
    operation = node_data.get('colOperation', '')
    
    if operation == 'rename':
        rename_from = node_data.get('renameFrom', '')
        rename_to = node_data.get('renameTo', '')
        if rename_from and rename_to and rename_from in df.columns:
            df = df.rename(columns={rename_from: rename_to})
            logger.info(f"Renamed column: {rename_from} → {rename_to}")
    
    elif operation == 'drop':
        drop_cols = node_data.get('dropColumns', [])
        existing = [c for c in drop_cols if c in df.columns]
        if existing:
            df = df.drop(columns=existing)
            logger.info(f"Dropped columns: {existing}")
    
    elif operation == 'cast':
        cast_col = node_data.get('castColumn', '')
        cast_type = node_data.get('castType', 'string')
        if cast_col and cast_col in df.columns:
            if cast_type == 'numeric':
                df[cast_col] = pd.to_numeric(df[cast_col], errors='coerce')
            elif cast_type == 'integer':
                df[cast_col] = pd.to_numeric(df[cast_col], errors='coerce').astype('Int64')
            elif cast_type == 'string':
                df[cast_col] = df[cast_col].astype(str)
            elif cast_type == 'datetime':
                df[cast_col] = pd.to_datetime(df[cast_col], errors='coerce')
            elif cast_type == 'boolean':
                df[cast_col] = df[cast_col].astype(bool)
            logger.info(f"Cast {cast_col} to {cast_type}")
    
    elif operation == 'calculated':
        calc_name = node_data.get('calcColumnName', '')
        calc_expr = node_data.get('calcExpression', '')
        if calc_name and calc_expr:
            try:
                df[calc_name] = df.eval(calc_expr)
                logger.info(f"Created calculated column: {calc_name}")
            except Exception as e:
                raise ValueError(f"Error in expression '{calc_expr}': {e}")
    
    return df


@register('remove_duplicates')
def handle_remove_duplicates(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Remove Duplicates requires upstream data")
    
    df = upstream_data[0].copy()
    key_columns = node_data.get('dedupColumns', [])
    keep = node_data.get('dedupKeep', 'first')
    
    before = len(df)
    if key_columns:
        existing = [c for c in key_columns if c in df.columns]
        df = df.drop_duplicates(subset=existing, keep=keep)
    else:
        df = df.drop_duplicates(keep=keep)
    
    logger.info(f"Remove Duplicates: {before} → {len(df)} rows")
    return df


@register('merge')
def handle_merge(node_data: dict, upstream_data: list, **kwargs):
    if len(upstream_data) < 2:
        raise ValueError("Merge requires at least two upstream data sources")
    
    left = upstream_data[0]
    right = upstream_data[1]
    
    join_type = node_data.get('joinType', 'inner')
    left_col = node_data.get('leftColumn', '')
    right_col = node_data.get('rightColumn', '')
    
    if not left_col or not right_col:
        common = list(set(left.columns) & set(right.columns))
        if common:
            df = left.merge(right, on=common, how=join_type)
        else:
            raise ValueError("No common columns found for merge. Specify join columns.")
    else:
        if left_col not in left.columns:
            raise ValueError(f"Left join column '{left_col}' not found. Available: {list(left.columns)}")
        if right_col not in right.columns:
            raise ValueError(f"Right join column '{right_col}' not found. Available: {list(right.columns)}")
        df = left.merge(right, left_on=left_col, right_on=right_col, how=join_type)
    
    logger.info(f"Merge: {len(left)} + {len(right)} → {len(df)} rows ({join_type})")
    return df


@register('sampling')
def handle_sampling(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Sampling requires upstream data")
    
    df = upstream_data[0].copy()
    sampling_col = node_data.get('samplingColumn', '')
    _pct_raw = node_data.get('samplePercent', 100)
    sample_pct = float(_pct_raw if _pct_raw is not None else 100) / 100.0
    _seed_raw = node_data.get('samplingSeed', 42)
    seed = int(_seed_raw if _seed_raw is not None else 42)
    
    if not sampling_col or sampling_col not in df.columns:
        n = max(1, int(len(df) * sample_pct))
        return df.sample(n=n, random_state=seed)
    
    unique_groups = df[sampling_col].unique()
    n_groups = max(1, int(len(unique_groups) * sample_pct))
    
    rng = np.random.RandomState(seed)
    selected = rng.choice(unique_groups, size=n_groups, replace=False)
    
    result = df[df[sampling_col].isin(selected)]
    logger.info(f"Sampling: {len(unique_groups)} groups → {n_groups} groups, {len(df)} → {len(result)} rows")
    return result


@register('date_gap_filler')
def handle_date_gap_filler(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Date Gap Filler requires upstream data")
    
    df = upstream_data[0].copy()
    date_col = node_data.get('dateColumn', '')
    freq = node_data.get('dateFrequency', 'D')
    group_col = node_data.get('dateGroupColumn', '')
    fill_strategy = node_data.get('gapFillStrategy', 'zero')
    
    if not date_col or date_col not in df.columns:
        raise ValueError(f"Date column '{date_col}' not found")
    
    df[date_col] = pd.to_datetime(df[date_col])
    
    freq_map = {'D': 'D', 'W': 'W-MON', 'M': 'MS', 'Q': 'QS', 'Y': 'YS'}
    pd_freq = freq_map.get(freq, freq)
    
    def fill_group(group_df):
        date_range = pd.date_range(
            start=group_df[date_col].min(),
            end=group_df[date_col].max(),
            freq=pd_freq
        )
        full_df = pd.DataFrame({date_col: date_range})
        merged = full_df.merge(group_df, on=date_col, how='left')
        
        if fill_strategy == 'ffill':
            merged = merged.ffill()
        elif fill_strategy == 'interpolate':
            for col in merged.select_dtypes(include=[np.number]).columns:
                merged[col] = merged[col].interpolate(method='linear')
        else:
            merged = merged.fillna(0)
        
        return merged
    
    if group_col and group_col in df.columns:
        results = []
        for name, group in df.groupby(group_col):
            filled = fill_group(group)
            if group_col not in filled.columns:
                filled[group_col] = name
            else:
                filled[group_col] = filled[group_col].fillna(name)
            results.append(filled)
        result = pd.concat(results, ignore_index=True)
    else:
        result = fill_group(df)
    
    logger.info(f"Date Gap Filler: {len(df)} → {len(result)} rows (freq={freq})")
    return result


@register('outlier_treatment')
def handle_outlier_treatment(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Outlier Treatment requires upstream data")
    
    df = upstream_data[0].copy()
    column = node_data.get('outlierColumn', '')
    method = node_data.get('outlierMethod', 'iqr')
    _thr_raw = node_data.get('outlierThreshold', 1.5)
    threshold = float(_thr_raw if _thr_raw is not None else 1.5)
    action = node_data.get('outlierAction', 'cap')
    
    if not column or column not in df.columns:
        raise ValueError(f"Outlier column '{column}' not found")
    
    if not pd.api.types.is_numeric_dtype(df[column]):
        logger.warning(f"Column '{column}' is not numeric, skipping outlier treatment")
        return df
    
    col_data = df[column].dropna()
    
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
        raise ValueError(f"Unknown outlier method: {method}")
    
    outlier_mask = (df[column] < lower) | (df[column] > upper)
    n_outliers = outlier_mask.sum()
    
    if action == 'cap':
        df.loc[df[column] < lower, column] = lower
        df.loc[df[column] > upper, column] = upper
    elif action == 'median':
        median_val = col_data.median()
        df.loc[outlier_mask, column] = median_val
    elif action == 'mean':
        mean_val = col_data.mean()
        df.loc[outlier_mask, column] = mean_val
    elif action == 'null':
        df.loc[outlier_mask, column] = np.nan
    elif action == 'remove':
        df = df[~outlier_mask]
    
    logger.info(f"Outlier Treatment: {n_outliers} outliers in '{column}' ({method}, {action})")
    return df


@register('pivot')
def handle_pivot(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Pivot requires upstream data")
    
    df = upstream_data[0].copy()
    pivot_type = node_data.get('pivotType', 'pivot')
    
    if pivot_type == 'pivot':
        index_col = node_data.get('pivotIndex', '')
        columns_col = node_data.get('pivotColumns', '')
        values_col = node_data.get('pivotValues', '')
        agg_func = node_data.get('pivotAggFunc', 'sum')
        
        if not all([index_col, columns_col, values_col]):
            raise ValueError("Pivot requires index, columns, and values")
        
        df = df.pivot_table(
            index=index_col,
            columns=columns_col,
            values=values_col,
            aggfunc=agg_func,
        ).reset_index()
        df.columns = [str(c) if not isinstance(c, tuple) else '_'.join(str(x) for x in c) for c in df.columns]
    
    elif pivot_type == 'unpivot':
        id_cols = node_data.get('unpivotIdCols', [])
        value_cols = node_data.get('unpivotValueCols', [])
        var_name = node_data.get('unpivotVarName', 'variable')
        val_name = node_data.get('unpivotValName', 'value')
        
        if id_cols:
            df = df.melt(
                id_vars=[c for c in id_cols if c in df.columns],
                value_vars=[c for c in value_cols if c in df.columns] if value_cols else None,
                var_name=var_name,
                value_name=val_name,
            )
    
    logger.info(f"Pivot ({pivot_type}): {len(df)} rows")
    return df
