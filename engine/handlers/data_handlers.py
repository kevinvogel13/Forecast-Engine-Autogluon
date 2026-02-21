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
    
    df = upstream_data[0]
    n_rows = min(int(node_data.get('previewRows', 100)), len(df))
    return df.head(n_rows)


@register('filter')
def handle_filter(node_data: dict, upstream_data: list, **kwargs):
    if not upstream_data:
        raise ValueError("Filter requires an upstream data source")
    
    df = upstream_data[0].copy()
    column = node_data.get('filterColumn', '')
    operator = node_data.get('filterOperator', 'equals')
    value = node_data.get('filterValue', '')
    
    if not column or column not in df.columns:
        logger.warning(f"Filter column '{column}' not found, passing data through")
        return df
    
    col = df[column]
    
    try:
        numeric_val = float(value) if value else None
    except (ValueError, TypeError):
        numeric_val = None
    
    if operator == 'equals':
        if numeric_val is not None and pd.api.types.is_numeric_dtype(col):
            mask = col == numeric_val
        else:
            mask = col.astype(str) == str(value)
    elif operator == 'not_equals':
        if numeric_val is not None and pd.api.types.is_numeric_dtype(col):
            mask = col != numeric_val
        else:
            mask = col.astype(str) != str(value)
    elif operator == 'greater_than':
        mask = pd.to_numeric(col, errors='coerce') > (numeric_val or 0)
    elif operator == 'less_than':
        mask = pd.to_numeric(col, errors='coerce') < (numeric_val or 0)
    elif operator == 'greater_equal':
        mask = pd.to_numeric(col, errors='coerce') >= (numeric_val or 0)
    elif operator == 'less_equal':
        mask = pd.to_numeric(col, errors='coerce') <= (numeric_val or 0)
    elif operator == 'contains':
        mask = col.astype(str).str.contains(str(value), case=False, na=False)
    elif operator == 'not_contains':
        mask = ~col.astype(str).str.contains(str(value), case=False, na=False)
    elif operator == 'starts_with':
        mask = col.astype(str).str.startswith(str(value), na=False)
    elif operator == 'ends_with':
        mask = col.astype(str).str.endswith(str(value), na=False)
    elif operator == 'is_null':
        mask = col.isna()
    elif operator == 'is_not_null':
        mask = col.notna()
    elif operator == 'in':
        values = [v.strip() for v in str(value).split(',')]
        if numeric_val is not None and pd.api.types.is_numeric_dtype(col):
            num_values = [float(v) for v in values if v]
            mask = col.isin(num_values)
        else:
            mask = col.astype(str).isin(values)
    else:
        logger.warning(f"Unknown filter operator: {operator}")
        return df
    
    filtered = df[mask]
    logger.info(f"Filter: {len(df)} → {len(filtered)} rows ({column} {operator} {value})")
    return filtered
