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


def test_execute_pipeline_reports_cycle():
    pipeline = {
        'nodes': [{'id': 'a', 'data': {'type': 'data_source'}},
                  {'id': 'b', 'data': {'type': 'filter'}}],
        'edges': [{'source': 'a', 'target': 'b'}, {'source': 'b', 'target': 'a'}],
    }
    result = execute_pipeline(pipeline)
    assert result['success'] is False
    assert 'cycle' in result['error'].lower()
