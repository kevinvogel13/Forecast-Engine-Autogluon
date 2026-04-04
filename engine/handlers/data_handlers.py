import pandas as pd
import io
import logging
from engine.handlers.registry import register

logger = logging.getLogger('engine')


@register('data_source')
def handle_data_source(node_data: dict, upstream_data: list, storage, config: dict, **kwargs):
    source_type = node_data.get('sourceType', 'upload')
    
    if source_type == 'upload':
        dataset_id = node_data.get('datasetId')
        filename = node_data.get('label', '')
        filepath = node_data.get('filepath', '')
        
        if filepath and storage.file_exists(filepath):
            file_bytes = storage.read_file(filepath)
            df = pd.read_csv(io.BytesIO(file_bytes))
            logger.info(f"Loaded {filepath}: {len(df)} rows × {len(df.columns)} cols")
            return df
        
        if filename and storage.file_exists(filename):
            file_bytes = storage.read_file(filename)
            df = pd.read_csv(io.BytesIO(file_bytes))
            logger.info(f"Loaded {filename}: {len(df)} rows × {len(df.columns)} cols")
            return df
        
        files = storage.list_files('')
        csv_file = None
        for f in files:
            if f == filename or (dataset_id and f.startswith(str(dataset_id))):
                csv_file = f
                break
        
        if not csv_file:
            for f in files:
                if f.endswith('.csv') and filename:
                    if filename.lower() in f.lower():
                        csv_file = f
                        break
        
        if not csv_file:
            raise ValueError(f"Dataset file not found: {filename or dataset_id}. Available files: {files}")
        
        file_bytes = storage.read_file(csv_file)
        df = pd.read_csv(io.BytesIO(file_bytes))
        logger.info(f"Loaded {csv_file}: {len(df)} rows × {len(df.columns)} cols")
        return df
    
    elif source_type == 'database':
        raise NotImplementedError("Database source not yet implemented")
    
    else:
        raise ValueError(f"Unknown source type: {source_type}")


@register('data_preview')
def handle_data_preview(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Data Preview requires an upstream data source")
    # Pass the full dataframe through — truncation for display is handled
    # automatically by pipeline.py's SSE emit (preview_rows = head 5).
    # Returning head(N) here would silently starve all downstream nodes of data.
    return upstream_data[0]


# ── Pass-through handlers for display/analysis terminal nodes ────────────────
# These nodes have no backend transform logic: their UI panels render
# client-side from the SSE resultInfo. Without a registered handler,
# pipeline.py skips them and leaves their node_id out of `results`, which
# breaks any node downstream of them (it would receive empty upstream_data).
@register('validation')
@register('exploration')
@register('report')
@register('output')
@register('comment')
def handle_passthrough(node_data: dict, upstream_data: list, **kwargs):
    if upstream_data:
        return upstream_data[0]
    return pd.DataFrame()


OP_ALIASES = {
    'eq': 'equals', 'neq': 'not_equals', 'ne': 'not_equals',
    'gt': 'greater_than', 'gte': 'greater_equal', 'ge': 'greater_equal',
    'lt': 'less_than', 'lte': 'less_equal', 'le': 'less_equal',
    'isin': 'in', 'notin': 'not_in', 'isnull': 'is_null', 'notnull': 'is_not_null',
}


def _apply_condition(df: pd.DataFrame, column: str, operator: str, value) -> 'pd.Series':
    op = OP_ALIASES.get(operator, operator)
    if column not in df.columns:
        return pd.Series([True] * len(df), index=df.index)
    col = df[column]
    try:
        numeric_val = float(value) if value not in (None, '', []) else None
    except (ValueError, TypeError):
        numeric_val = None

    if op == 'equals':
        return col == numeric_val if numeric_val is not None and pd.api.types.is_numeric_dtype(col) else col.astype(str) == str(value)
    elif op == 'not_equals':
        return col != numeric_val if numeric_val is not None and pd.api.types.is_numeric_dtype(col) else col.astype(str) != str(value)
    elif op == 'greater_than':
        return pd.to_numeric(col, errors='coerce') > (numeric_val or 0)
    elif op == 'less_than':
        return pd.to_numeric(col, errors='coerce') < (numeric_val or 0)
    elif op == 'greater_equal':
        return pd.to_numeric(col, errors='coerce') >= (numeric_val or 0)
    elif op == 'less_equal':
        return pd.to_numeric(col, errors='coerce') <= (numeric_val or 0)
    elif op == 'contains':
        return col.astype(str).str.contains(str(value), case=False, na=False)
    elif op == 'not_contains':
        return ~col.astype(str).str.contains(str(value), case=False, na=False)
    elif op == 'starts_with':
        return col.astype(str).str.startswith(str(value), na=False)
    elif op == 'ends_with':
        return col.astype(str).str.endswith(str(value), na=False)
    elif op == 'is_null':
        return col.isna()
    elif op == 'is_not_null':
        return col.notna()
    elif op in ('in', 'isin'):
        vals = value if isinstance(value, list) else [v.strip() for v in str(value).split(',')]
        if pd.api.types.is_numeric_dtype(col):
            try:
                return col.isin([float(v) for v in vals if v])
            except Exception:
                pass
        return col.astype(str).isin([str(v) for v in vals])
    elif op in ('not_in', 'notin'):
        vals = value if isinstance(value, list) else [v.strip() for v in str(value).split(',')]
        if pd.api.types.is_numeric_dtype(col):
            try:
                return ~col.isin([float(v) for v in vals if v])
            except Exception:
                pass
        return ~col.astype(str).isin([str(v) for v in vals])
    else:
        logger.warning(f"Unknown filter operator: {op}")
        return pd.Series([True] * len(df), index=df.index)


@register('filter')
def handle_filter(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Filter requires an upstream data source")

    df = upstream_data[0].copy()

    conditions = node_data.get('filterConditions') or []
    if conditions:
        mask = None
        for cond in conditions:
            col = cond.get('column', '')
            op = cond.get('op', 'equals')
            val = cond.get('values') if cond.get('values') else cond.get('value', '')
            logic = cond.get('logic', 'AND')
            if not col:
                continue
            cond_mask = _apply_condition(df, col, op, val)
            if mask is None:
                mask = cond_mask
            elif logic == 'OR':
                mask = mask | cond_mask
            else:
                mask = mask & cond_mask
        if mask is not None:
            filtered = df[mask]
            logger.info(f"Multi-condition filter: {len(df)} → {len(filtered)} rows ({len(conditions)} conditions)")
            return filtered
        return df

    column = node_data.get('filterColumn', '')
    operator = node_data.get('filterOperator', node_data.get('filterOp', 'equals'))
    value = node_data.get('filterValues') or node_data.get('filterValue', '')

    if not column or column not in df.columns:
        logger.warning(f"Filter column '{column}' not found, passing data through")
        return df

    mask = _apply_condition(df, column, operator, value)
    filtered = df[mask]
    logger.info(f"Filter: {len(df)} → {len(filtered)} rows ({column} {operator} {value})")
    return filtered
