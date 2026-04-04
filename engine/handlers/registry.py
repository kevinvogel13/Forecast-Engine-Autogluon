from typing import Callable, Optional

_handlers: dict[str, Callable] = {}

# Maps frontend camelCase/short type strings → registered handler keys.
# The frontend and Python engine evolved separately; this table bridges them.
_TYPE_ALIASES: dict[str, str] = {
    'input':            'data_source',
    'preview':          'data_preview',
    'fillMissing':      'fill_missing',
    'removeDuplicates': 'remove_duplicates',
    'outlierTreatment': 'outlier_treatment',
    'columnTransform':  'column_transform',
    'dateGapFill':      'date_gap_filler',
    'pivotUnpivot':     'pivot',
    'python':           'python_script',
    'sql':              'sql_transform',
    'config':           'model_config',
}

def register(node_type: str):
    def decorator(fn: Callable):
        _handlers[node_type] = fn
        return fn
    return decorator

def get_handler(node_type: str) -> Optional[Callable]:
    resolved = _TYPE_ALIASES.get(node_type, node_type)
    return _handlers.get(resolved)

import engine.handlers.data_handlers
import engine.handlers.prep_handlers
import engine.handlers.code_handlers
import engine.handlers.model_handler
