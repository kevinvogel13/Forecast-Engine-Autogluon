import json
import sys
import time
import traceback
from collections import defaultdict
from typing import Any
import pandas as pd

from engine.config import setup_logging, get_config
from engine.adapters.storage import create_storage_adapter


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    graph = defaultdict(list)
    in_degree = defaultdict(int)
    node_ids = {n['id'] for n in nodes}
    
    for nid in node_ids:
        in_degree[nid] = 0
    
    for edge in edges:
        src, tgt = edge['source'], edge['target']
        if src in node_ids and tgt in node_ids:
            graph[src].append(tgt)
            in_degree[tgt] += 1
    
    queue = [nid for nid in node_ids if in_degree[nid] == 0]
    queue.sort()
    order = []
    
    while queue:
        node = queue.pop(0)
        order.append(node)
        for neighbor in sorted(graph[node]):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    
    if len(order) != len(node_ids):
        raise ValueError("Pipeline contains a cycle")
    
    return order


def get_upstream_data(node_id: str, edges: list[dict], results: dict[str, pd.DataFrame]) -> list[pd.DataFrame]:
    upstream = []
    for edge in edges:
        if edge['target'] == node_id and edge['source'] in results:
            upstream.append(results[edge['source']])
    return upstream


def emit_progress(node_id: str, node_label: str, status: str, message: str = "", result_info: dict = None):
    progress = {
        'type': 'progress',
        'nodeId': node_id,
        'nodeLabel': node_label,
        'status': status,
        'message': message,
        'timestamp': time.time(),
    }
    if result_info:
        progress['resultInfo'] = result_info
    print(json.dumps(progress), flush=True)


def execute_pipeline(pipeline_json: dict) -> dict:
    logger = setup_logging()
    config = get_config()
    storage = create_storage_adapter()
    
    nodes = pipeline_json.get('nodes', [])
    edges = pipeline_json.get('edges', [])
    
    node_map = {n['id']: n for n in nodes}
    
    try:
        execution_order = topological_sort(nodes, edges)
    except ValueError as e:
        return {'success': False, 'error': str(e)}
    
    logger.info(f"Execution order: {[node_map[nid]['data'].get('label', nid) for nid in execution_order]}")
    
    results: dict[str, pd.DataFrame] = {}
    node_outputs: dict[str, Any] = {}
    
    from engine.handlers import registry
    
    for node_id in execution_order:
        node = node_map[node_id]
        node_data = node.get('data', {})
        node_type = node_data.get('type', 'unknown')
        node_label = node_data.get('label', node_id)
        
        emit_progress(node_id, node_label, 'running', f'Executing {node_label}...')
        
        handler = registry.get_handler(node_type)
        if handler is None:
            emit_progress(node_id, node_label, 'skipped', f'No handler for node type: {node_type}')
            continue
        
        try:
            upstream_dfs = get_upstream_data(node_id, edges, results)
            
            result = handler(
                node_data=node_data,
                upstream_data=upstream_dfs,
                storage=storage,
                config=config,
                node_outputs=node_outputs,
            )
            
            if isinstance(result, pd.DataFrame):
                results[node_id] = result
                preview_df = result.head(5).where(pd.notnull(result.head(5)), None)
                result_info = {
                    'rows': len(result),
                    'columns': list(result.columns),
                    'preview_rows': preview_df.to_dict(orient='records'),
                }
                emit_progress(node_id, node_label, 'completed', f'{len(result)} rows × {len(result.columns)} cols', result_info)
            elif isinstance(result, dict):
                node_outputs[node_id] = result
                if 'dataframe' in result:
                    results[node_id] = result['dataframe']
                result_info = result.get('info', {}).copy()
                # Propagate small auxiliary payloads through SSE for the frontend
                if 'leaderboard' in result:
                    result_info['leaderboard'] = result['leaderboard']
                if 'feature_importance' in result:
                    result_info['feature_importance'] = result['feature_importance']
                if 'per_series_metrics' in result:
                    result_info['per_series_metrics'] = result['per_series_metrics']
                # Include forecast rows (capped at 5000) so the frontend can offer CSV export
                if 'forecast' in result:
                    fc = result['forecast']
                    if isinstance(fc, list):
                        result_info['forecast'] = fc[:5000]
                        result_info['forecast_rows'] = len(fc)
                emit_progress(node_id, node_label, 'completed', result.get('message', 'Done'), result_info)
            else:
                emit_progress(node_id, node_label, 'completed', 'Done')
                
        except Exception as e:
            logger.error(f"Error executing node {node_label}: {e}", exc_info=True)
            emit_progress(node_id, node_label, 'error', str(e))
            return {
                'success': False,
                'error': f"Error in node '{node_label}': {str(e)}",
                'failedNode': node_id,
                'traceback': traceback.format_exc(),
            }
    
    final_results = {}
    for node_id, df in results.items():
        node_label = node_map[node_id]['data'].get('label', node_id)
        final_results[node_id] = {
            'label': node_label,
            'rows': len(df),
            'columns': list(df.columns),
            'preview': json.loads(df.head(100).to_json(orient='records', date_format='iso')),
        }
    
    for node_id, output in node_outputs.items():
        if node_id not in final_results:
            node_label = node_map[node_id]['data'].get('label', node_id)
            final_results[node_id] = {
                'label': node_label,
                **{k: v for k, v in output.items() if k != 'dataframe'},
            }
    
    return {
        'success': True,
        'results': final_results,
    }


if __name__ == '__main__':
    if len(sys.argv) > 1:
        pipeline_file = sys.argv[1]
        with open(pipeline_file, 'r') as f:
            pipeline_data = json.load(f)
    else:
        pipeline_data = json.loads(sys.stdin.read())
    
    result = execute_pipeline(pipeline_data)
    print(json.dumps({'type': 'result', **result}), flush=True)
