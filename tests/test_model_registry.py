"""Tests for the model registry (list + retention pruning)."""
import os

from engine.model_registry import list_models, prune_models


def _make_model(root, ts):
    d = os.path.join(root, f'ag_model_{ts}')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'predictor.pkl'), 'wb') as f:
        f.write(b'x' * 10)
    return d


def test_list_models_newest_first(tmp_path):
    root = str(tmp_path)
    for ts in (100, 300, 200):
        _make_model(root, ts)
    models = list_models(root)
    assert [m['created_ts'] for m in models] == [300, 200, 100]
    assert all(m['size_bytes'] >= 10 for m in models)
    assert models[0]['name'] == 'ag_model_300'


def test_list_models_missing_dir_is_empty(tmp_path):
    assert list_models(str(tmp_path / 'nope')) == []


def test_prune_keeps_n_most_recent(tmp_path):
    root = str(tmp_path)
    for ts in (100, 200, 300, 400):
        _make_model(root, ts)
    removed = prune_models(root, keep=2)
    assert set(removed) == {'ag_model_100', 'ag_model_200'}
    remaining = {m['name'] for m in list_models(root)}
    assert remaining == {'ag_model_300', 'ag_model_400'}


def test_prune_zero_is_noop(tmp_path):
    root = str(tmp_path)
    _make_model(root, 100)
    assert prune_models(root, keep=0) == []
    assert len(list_models(root)) == 1


def test_prune_ignores_non_model_dirs(tmp_path):
    root = str(tmp_path)
    _make_model(root, 100)
    _make_model(root, 200)
    os.makedirs(os.path.join(root, 'not_a_model'), exist_ok=True)
    prune_models(root, keep=1)
    names = {m['name'] for m in list_models(root)}
    assert 'not_a_model' in names      # unrelated dirs are never pruned
    assert 'ag_model_200' in names
    assert 'ag_model_100' not in names
