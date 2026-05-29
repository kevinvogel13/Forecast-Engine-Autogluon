"""Tests for pipeline orchestration and the handler registry."""
import pandas as pd
import pytest

from engine.pipeline import topological_sort, execute_pipeline
from engine.handlers import registry


def test_topological_sort_linear():
    nodes = [{'id': 'a'}, {'id': 'b'}, {'id': 'c'}]
    edges = [{'source': 'a', 'target': 'b'}, {'source': 'b', 'target': 'c'}]
    assert topological_sort(nodes, edges) == ['a', 'b', 'c']


def test_topological_sort_detects_cycle():
    nodes = [{'id': 'a'}, {'id': 'b'}]
    edges = [{'source': 'a', 'target': 'b'}, {'source': 'b', 'target': 'a'}]
    with pytest.raises(ValueError, match='cycle'):
        topological_sort(nodes, edges)


def test_registry_resolves_camelcase_aliases():
    # frontend emits camelCase / short names; engine must map them
    assert registry.get_handler('input') is registry.get_handler('data_source')
    assert registry.get_handler('config') is registry.get_handler('model_config')
    assert registry.get_handler('fillMissing') is registry.get_handler('fill_missing')
    assert registry.get_handler('python') is registry.get_handler('python_script')


def test_registry_unknown_type_returns_none():
    assert registry.get_handler('does_not_exist') is None


def test_execute_pipeline_filter_chain(tmp_path, monkeypatch):
    # Write a CSV the data_source handler can load via the local storage adapter
    csv = tmp_path / 'data.csv'
    pd.DataFrame({'region': ['n', 's', 'n'], 'sales': [1, 2, 3]}).to_csv(csv, index=False)
    monkeypatch.setenv('STORAGE_PATH', str(tmp_path))
    monkeypatch.setenv('STORAGE_TYPE', 'local')

    pipeline = {
        'nodes': [
            {'id': 'src', 'data': {'type': 'data_source', 'label': 'Source',
                                   'sourceType': 'upload', 'filepath': 'data.csv'}},
            {'id': 'flt', 'data': {'type': 'filter', 'label': 'Filter',
                                   'filterColumn': 'region', 'filterOperator': 'equals',
                                   'filterValue': 'n'}},
        ],
        'edges': [{'source': 'src', 'target': 'flt'}],
    }
    result = execute_pipeline(pipeline)
    assert result['success'] is True
    assert result['results']['flt']['rows'] == 2


def test_compute_last_use_frees_intermediate():
    from engine.pipeline import _compute_last_use
    order = ['a', 'b', 'c']
    edges = [{'source': 'a', 'target': 'b'}, {'source': 'b', 'target': 'c'}]
    node_map = {nid: {'data': {}} for nid in order}
    last_use = _compute_last_use(order, edges, node_map)
    # 'a' is last used by 'b' (pos 1); 'b' by 'c' (pos 2); 'c' terminal (pos 2)
    assert last_use['a'] == 1
    assert last_use['b'] == 2
    assert last_use['c'] == 2


def test_pipeline_evicts_intermediate_dataframes(tmp_path, monkeypatch):
    # A 3-node chain: the source frame should be freed once the filter consumes it.
    csv = tmp_path / 'data.csv'
    pd.DataFrame({'region': ['n', 's', 'n'], 'sales': [1, 2, 3]}).to_csv(csv, index=False)
    monkeypatch.setenv('STORAGE_PATH', str(tmp_path))
    monkeypatch.setenv('STORAGE_TYPE', 'local')
    pipeline = {
        'nodes': [
            {'id': 'src', 'data': {'type': 'data_source', 'sourceType': 'upload', 'filepath': 'data.csv'}},
            {'id': 'f1', 'data': {'type': 'filter', 'filterColumn': 'region',
                                  'filterOperator': 'equals', 'filterValue': 'n'}},
            {'id': 'f2', 'data': {'type': 'remove_duplicates'}},
        ],
        'edges': [{'source': 'src', 'target': 'f1'}, {'source': 'f1', 'target': 'f2'}],
    }
    result = execute_pipeline(pipeline)
    assert result['success'] is True
    # terminal node result is present
    assert 'f2' in result['results']


def test_execute_pipeline_reports_cycle():
    pipeline = {
        'nodes': [{'id': 'a', 'data': {'type': 'data_source'}},
                  {'id': 'b', 'data': {'type': 'filter'}}],
        'edges': [{'source': 'a', 'target': 'b'}, {'source': 'b', 'target': 'a'}],
    }
    result = execute_pipeline(pipeline)
    assert result['success'] is False
    assert 'cycle' in result['error'].lower()
