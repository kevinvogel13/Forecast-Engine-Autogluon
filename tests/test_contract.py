"""Frontend <-> engine contract drift guard.

The audit-pass history in ``replit.md`` is dominated by bugs where the React
FlowEditor emitted one field name and the Python engine read another.  This
test fails loudly the moment the engine declares a config key the FlowEditor no
longer emits — catching that class of bug in CI instead of in production.
"""
import re
from pathlib import Path

import pytest

from engine import contract
from engine.handlers import registry

REPO = Path(__file__).resolve().parent.parent
FLOW_EDITOR = REPO / 'client' / 'src' / 'components' / 'pipeline' / 'FlowEditor.tsx'


def _frontend_keys() -> set:
    text = FLOW_EDITOR.read_text(encoding='utf-8')
    # Keys the editor emits onto node.data: cfg*, plus the well-known camelCase ones
    pattern = re.compile(
        r'\b(cfg[A-Za-z0-9]+|forecastHorizon|dataFrequency|modelMode|modelPath'
        r'|configDateColumn|backtestEnabled|backtestFolds|backtestStepSize)\b')
    return set(pattern.findall(text))


@pytest.mark.skipif(not FLOW_EDITOR.exists(), reason="FlowEditor.tsx not present")
def test_every_engine_key_is_emitted_by_frontend():
    frontend = _frontend_keys()
    missing = contract.MODEL_CONFIG_KEYS - frontend
    assert not missing, (
        f"Engine reads config keys the FlowEditor never emits: {sorted(missing)}. "
        f"Either the frontend stopped sending them or the engine key drifted.")


def test_preset_map_covers_contract_presets():
    from engine.handlers.model_handler import PRESET_MAP
    assert contract.VALID_PRESETS <= set(PRESET_MAP.keys())


def test_freq_map_covers_contract_frequencies():
    from engine.handlers.model_handler import FREQ_MAP
    assert contract.VALID_FREQUENCIES <= set(FREQ_MAP.keys())


def test_default_eval_metric_is_valid():
    assert 'MASE' in contract.VALID_EVAL_METRICS


def test_registry_aliases_resolve_to_real_handlers():
    # Every alias the frontend can send must resolve to a registered handler
    for alias in registry._TYPE_ALIASES:
        assert registry.get_handler(alias) is not None, f"alias {alias!r} resolves to nothing"
