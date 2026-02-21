from typing import Callable, Optional

_handlers: dict[str, Callable] = {}

def register(node_type: str):
    def decorator(fn: Callable):
        _handlers[node_type] = fn
        return fn
    return decorator

def get_handler(node_type: str) -> Optional[Callable]:
    return _handlers.get(node_type)

import engine.handlers.data_handlers
import engine.handlers.prep_handlers
import engine.handlers.code_handlers
import engine.handlers.model_handler
