import json
import signal
import sys
import time
import traceback
from collections import defaultdict
from contextlib import contextmanager
from typing import Any
import pandas as pd

from engine.config import setup_logging, get_config
from engine.adapters.storage import create_storage_adapter


@contextmanager
def _node_timeout(seconds: int, label: str):
    """Abort a node that runs longer than `seconds` (SIGALRM, Unix only).

    A single global timeout can't tell which node hung; this isolates a runaway
    transform so the rest of the pipeline fails fast with a clear message. The
    model node is exempted by the caller (training legitimately runs long and
    has AutoGluon's own time_limit).
    """
    if not seconds or seconds <= 0 or not hasattr(signal, 'SIGALRM'):
        yield
        return

    def _handler(signum, frame):
        raise TimeoutError(f"Node '{label}' exceeded its time limit of {seconds}s")

    old = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(int(seconds))
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)


def _compute_last_use(execution_order: list, edges: list, node_map: dict) -> dict:
    """Map each node id → the position in execution_order after which its output
    DataFrame is no longer needed by any downstream node, so it can be freed.

    Keeps peak memory down on long pipelines: without this, every intermediate
    DataFrame is retained for the whole run.
    """
    pos = {nid: i for i, nid in enumerate(execution_order)}
    consumers = defaultdict(list)
    for e in edges:
        if e['source'] in pos and e['target'] in pos:
            consumers[e['source']].append(pos[e['target']])
    last_use = {}
    for nid in execution_order:
        # A node's own position counts (it may be a terminal result we keep),
        # plus the latest position of any consumer.
        last_use[nid] = max([pos[nid]] + consumers.get(nid, []))
    return last_use


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

    # Per-node timeout (seconds); 0 disables. Model nodes are exempt — training
    # legitimately runs long and is bounded by AutoGluon's own time_limit.
    node_timeout = int(config.get('NODE_TIMEOUT', 0) or 0)
    last_use = _compute_last_use(execution_order, edges, node_map)
    cur_pos = {nid: i for i, nid in enumerate(execution_order)}

    from engine.handlers import registry

    for step, node_id in enumerate(execution_order):
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

            # Model training is exempt from the per-node timeout.
            is_model = registry.get_handler(node_type) is registry.get_handler('model_config')
            timeout = 0 if is_model else node_timeout
            with _node_timeout(timeout, node_label):
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
                # Include backtest rows (capped at 2000) for the backtest chart
                if 'backtest' in result:
                    bt = result['backtest']
                    if isinstance(bt, list):
                        result_info['backtest'] = bt[:2000]
                emit_progress(node_id, node_label, 'completed', result.get('message', 'Done'), result_info)
            else:
                emit_progress(node_id, node_label, 'completed', 'Done')

            # ── Free intermediate DataFrames no longer needed downstream ──────
            # Keep terminal outputs (no consumer) so they can be returned; drop
            # any upstream frame whose last consumer has now run.
            for done_id in list(results.keys()):
                lu = last_use.get(done_id, cur_pos.get(done_id, step))
                has_consumer = lu > cur_pos.get(done_id, lu)
                if has_consumer and lu <= step and done_id not in node_outputs:
                    del results[done_id]

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
