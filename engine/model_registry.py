"""Model registry: list and prune saved AutoGluon model artifacts.

Every training run writes ``MODEL_PATH/ag_model_<unix_ts>/``.  Without a
retention policy these accumulate forever (the original audit flagged this).
This module lists saved models newest-first and prunes to keep the N most
recent, so disk stays bounded while recent models remain loadable.

Pruning is opt-in via ``MODEL_RETENTION`` (0 = keep everything) so we never
delete a model a saved "load" pipeline might reference unless the operator
asked for a cap.
"""
from __future__ import annotations

import os
import re
import shutil
import logging

logger = logging.getLogger('engine')

_MODEL_DIR_RE = re.compile(r'^ag_model_(\d+)$')


def _dir_size(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def list_models(model_path: str) -> list[dict]:
    """Return saved models as dicts, newest first:
    ``{'name', 'path', 'created_ts', 'size_bytes'}``."""
    if not model_path or not os.path.isdir(model_path):
        return []
    out = []
    for name in os.listdir(model_path):
        full = os.path.join(model_path, name)
        if not os.path.isdir(full):
            continue
        m = _MODEL_DIR_RE.match(name)
        # created ts: prefer the encoded timestamp, fall back to mtime
        created = int(m.group(1)) if m else int(os.path.getmtime(full))
        out.append({
            'name': name,
            'path': full,
            'created_ts': created,
            'size_bytes': _dir_size(full),
        })
    out.sort(key=lambda d: d['created_ts'], reverse=True)
    return out


def prune_models(model_path: str, keep: int) -> list[str]:
    """Delete all but the `keep` most recent ag_model_* dirs.  ``keep<=0`` is a
    no-op (retain everything).  Returns the names that were removed.  Only our
    own ``ag_model_*`` directories are ever pruned."""
    if not keep or keep <= 0:
        return []
    prunable = [m for m in list_models(model_path) if _MODEL_DIR_RE.match(m['name'])]
    removed = []
    for m in prunable[keep:]:
        try:
            shutil.rmtree(m['path'], ignore_errors=True)
            removed.append(m['name'])
        except OSError as e:
            logger.warning(f"Could not prune model {m['name']}: {e}")
    if removed:
        logger.info(f"Pruned {len(removed)} old model(s), kept {keep} most recent")
    return removed
