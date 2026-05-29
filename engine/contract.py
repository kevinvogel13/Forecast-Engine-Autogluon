"""Frontend <-> engine contract: the canonical config-key vocabulary.

The changelog in ``replit.md`` records dozens of bugs caused by the React
FlowEditor and the Python engine drifting apart on field names (``cfgTargetVar``
vs ``targetVar``, ``calculate`` vs ``calculated``, ``config`` vs
``model_config`` …).  This module makes the engine side of that contract
explicit and machine-checkable so the test-suite can catch drift before users
do.

Nothing here changes runtime behaviour on its own; handlers continue to read
``node_data``.  But the names a handler is *allowed* to read are declared here,
and ``tests/test_contract.py`` asserts the FlowEditor emits the same vocabulary.
"""
from __future__ import annotations

# ─── Canonical model-config node keys (read by model_handler) ────────────────
MODEL_CONFIG_KEYS = frozenset({
    'modelMode', 'modelPath',
    'cfgTargetVar', 'cfgTimeCol', 'configDateColumn', 'cfgDfu',
    'forecastHorizon', 'dataFrequency', 'cfgPreset', 'cfgTimeLimit',
    'cfgQuantiles', 'cfgEvalMetric', 'cfgSelectedModels',
    'cfgStaticFeatures', 'cfgKnownCovariates',
    'cfgFillMissing', 'cfgFillConfigs', 'cfgOutlierTreatment', 'cfgOutlierConfigs',
    'cfgRefitFull', 'cfgGpus', 'cfgCpus',
    'cfgHolidayEnabled', 'cfgHolidayCountry',
    'backtestEnabled', 'backtestFolds', 'backtestStepSize',
})

# ─── Enumerations the frontend must stay aligned with ────────────────────────
VALID_FREQUENCIES = frozenset({'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
                               'D', 'W', 'M', 'Q', 'Y', 'MS', 'QS', 'YS', 'H', 'T', 'min'})

VALID_PRESETS = frozenset({'fast', 'fast_training', 'medium', 'medium_quality',
                           'high', 'high_quality', 'best', 'best_quality'})

# AutoGluon-supported point/probabilistic eval metrics we expose in the UI.
VALID_EVAL_METRICS = frozenset({'MASE', 'MAPE', 'sMAPE', 'WAPE', 'RMSE', 'MAE',
                                'MSE', 'RMSSE', 'WQL', 'SQL'})

# ─── Seasonal period inference (used by stats fallback + MASE scaling) ────────
# Default number of periods in one seasonal cycle, keyed by resolved pandas
# frequency alias.  Used when the user hasn't supplied an explicit season length.
SEASONAL_PERIODS = {
    'D': 7,     # weekly seasonality on daily data
    'W': 52,    # yearly seasonality on weekly data
    'M': 12, 'MS': 12,
    'Q': 4,  'QS': 4,
    'Y': 1,  'YS': 1,
    'H': 24,
    'T': 60, 'min': 60,
}


def seasonal_period_for(freq: str, n_obs: int | None = None) -> int:
    """Return a sensible seasonal cycle length for a resolved frequency.

    If ``n_obs`` is provided, the period is capped so at least two full cycles
    fit in the history (statsmodels needs ``2 * m`` observations to fit a
    seasonal model); otherwise we degrade gracefully to non-seasonal (1).
    """
    # Strip any anchor suffix ('W-MON' -> 'W') before lookup.
    base = freq.split('-')[0] if freq else freq
    m = SEASONAL_PERIODS.get(freq, SEASONAL_PERIODS.get(base, 1))
    if m < 2:
        return 1
    if n_obs is not None and n_obs < 2 * m:
        return 1
    return m
