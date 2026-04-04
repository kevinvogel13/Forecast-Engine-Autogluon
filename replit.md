# Forecaster - Data Pipeline & Forecasting Application

## Overview

Forecaster is a visual data pipeline and forecasting application that allows users to upload CSV datasets, construct data transformation pipelines using a drag-and-drop editor, and execute forecasting models. It provides comprehensive exploratory data analysis, data validation, 16 distinct chart types for visualization, and HTML report generation. The application's backend uses a Python engine for pipeline execution, designed for flexible deployment adhering to 12-Factor app principles.

## User Preferences

- Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18 and TypeScript, using Wouter for routing. State management relies on TanStack React Query. UI components are developed with shadcn/ui (Radix UI) and styled using Tailwind CSS. The visual pipeline editor uses @xyflow/react, and Monaco Editor is integrated for code editing. Recharts handles data visualization. Vite is the build tool.

### Backend

The backend is developed with Node.js and Express in TypeScript, providing a RESTful JSON API. It uses Multer for file uploads and csv-parse for CSV processing.

### Database

PostgreSQL, hosted on Neon, is used as the database. Drizzle ORM manages database interactions, with drizzle-kit for migrations. Data validation is implemented with drizzle-zod and Zod. The database schema includes `users`, `pipelines`, and `datasets` tables to store user credentials, pipeline definitions, and dataset metadata respectively.

### Pipeline Engine (Python)

The Python pipeline execution engine follows 12-Factor app principles, using environment variables for configuration and structured JSON logging. It is stateless and manages dependencies via `pyproject.toml`. The engine processes pipeline definitions by resolving the topological order of nodes and executing handlers. Progress and results are emitted as structured JSON.

#### Node Types

The pipeline supports various color-coded node types:
- **Source:** Data Source (CSV import), Data Preview.
- **Prep:** Filter, Merge/Join, Sampling, Fill Missing Values, Date Gap Filler, Outlier Treatment, Column Transform, Remove Duplicates, Pivot/Unpivot.
- **Analysis:** Python Script (sandboxed pandas transforms), SQL Transform (DuckDB queries), Validation (EDA dashboard), Exploration (modular chart builder), Report (HTML report generation).
- **Model:** Model Config (forecasting model configuration), Output (forecast results).

#### Exploration Chart Types

The application offers 16 chart types for data exploration, including Time Series, Histogram, Box Plot, Bar Chart, Scatter Plot, Demand Classification, Pareto Chart, Data Table, Summary Statistics, Seasonal Plot, Data Completeness, Outlier Table, Forecast vs Actual, Backtest Metrics, Feature Importance, and Rich Text annotations.

#### Model Handling

The primary forecasting model uses AutoGluon TimeSeriesPredictor, with statistical models as a fallback. It includes features for data leakage prevention, permutation-based feature importance, and walk-forward cross-validation.

#### Python Script Sandboxing

The Python script execution environment is sandboxed to enhance security by restricting built-ins and blocking sensitive imports and class traversal patterns.

## External Dependencies

### Python Packages

Key Python dependencies include `pandas`, `numpy`, `scikit-learn`, `scipy`, and `duckdb`. AutoGluon is an optional runtime dependency for forecasting models.

### Node.js Packages

- **Frontend:** `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `recharts`, `react-dropzone`, `framer-motion`, `sonner`.
- **Backend/ORM:** `drizzle-orm`, `drizzle-kit`, `multer`, `csv-parse`.
- **Replit-Specific:** `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.

## Recent Changes

- 2026-04-04: Seventh audit pass — fixed 5 bugs: (1) SQL Transform field `query` wasn't being read by Python handler (only `sqlQuery` fallback) — fixed in `code_handlers.py` to read `query` first; (2) `apply_outlier_treatment_per_column` in `model_handler.py` had the same percentile threshold crash as `prep_handlers.py` (values > 1 not normalized to fraction) — fixed with same percent-to-fraction normalization and clamping; (3) `getPreviewKey` cache key only included legacy `filterColumn` fields, not `filterConditions` — preview panels didn't refresh when multi-condition filters changed; fixed to include `JSON.stringify(conditions)`; (4) OR logic in multi-condition filter builder was silently ignored in server-side previews — conditions were sent individually (all applied as AND); fixed by sending grouped `{ conditions: [...] }` format preserving `logic` field, and adding `applyFilterTransform` helper in routes.ts that correctly applies OR/AND; (5) same grouped-conditions fix applied to `collectTransforms` in the preview-panel effect.
- 2026-04-04: Sixth audit pass — fixed 2 bugs: `collectTransforms` (node preview panel) was a stale duplicate of `getUpstreamTransforms` that never received the multi-condition `filterConditions` fix — preview panels showed un-filtered data; SQL Transform field name mismatch (`node.data.query` saved by frontend, `sqlQuery` read by Python handler) — SQL transforms silently never executed.
- 2026-04-04: Fifth audit pass — fixed 4 bugs: (1) CRITICAL: 10 frontend node type strings (input, preview, fillMissing, removeDuplicates, outlierTreatment, columnTransform, dateGapFill, pivotUnpivot, python, sql, config) didn't match Python handler registration names (data_source, data_preview, fill_missing, remove_duplicates, outlier_treatment, column_transform, date_gap_filler, pivot, python_script, sql_transform, model_config) — pipeline silently skipped every mismatched node including the data source, so ALL pipelines produced empty results; fixed by adding a _TYPE_ALIASES dict in registry.py so get_handler resolves frontend names to Python names; (2) SeasonalPlotChart used toLocaleString('default', {month: 'short'}) which returns locale-specific month abbreviations (e.g. 'janv.' in French) that never matched the hardcoded English array ['Jan', ..., 'Dec'], making the chart blank on non-English browsers; fixed to use 'en-US'; (3) Percentile outlier threshold: frontend placeholder says "e.g. 95" so users enter 95, but Python called quantile(95) which is out of range (must be 0–1) and raised ValueError; fixed by normalising values > 1 (divide by 100) and clamping to (0.001, 0.499); (4) lagData in ForecastResultsDashboard pushed actuals and forecasts independently — if a row had only one of the two as a number the arrays grew misaligned and MAPE paired wrong rows; fixed to push both only when both are numbers.
- 2026-04-04: Fourth audit pass — fixed 4 more bugs: (1) MAPE-by-lag computation in ForecastResultsDashboard used wrong array indices — `nonZero.map((a, i) => forecasts[i])` indexed into the filtered actuals array but `i` no longer aligned with the original forecasts array after zeros were removed; fixed to iterate original indices; (2) Leaderboard score always showed `—` for real runs — rendering checked `m.score` but AutoGluon returns `score_val`; fixed to use `m.score_val ?? m.score`; (3) AutoGluon holdout backtest rows had no `horizon_step` field — all lag-analysis entries collapsed to step 1; fixed by sorting merged DataFrame per item then computing 1-based cumcount as `horizon_step`; (4) `eq`/`neq` filter operators in all 5 server-side exploration filter switch blocks used pure string comparison — numeric values like `5.0` vs `5` never matched; fixed with numeric-first comparison with string fallback.
- 2026-04-04: Third audit pass — fixed 2 more bugs: (1) `getUpstreamTransforms` in the frontend only looked at `node.data.filterColumn` (old single-condition format) and silently ignored `node.data.filterConditions` (new multi-condition filter builder) — exploration previews with multi-condition filters now correctly apply each condition as a transform; (2) server-side filter switch blocks in 5 routes were missing `not_contains`, `starts_with`, `ends_with` operators — they fell through to the default pass-all case, so those operators had no effect in exploration previews.
- 2026-04-04: Second audit pass — fixed 5 more bugs: (1) SSE progress events silently lost when Python emits a JSON line spanning two stdout chunks — added line buffer in server/routes.ts so partial chunks are held until a complete newline arrives; (2) AutoGluon feature_importance() was always called with no arguments — its signature requires a TimeSeriesDataFrame; now passes ts_df in both train and load mode, falling back to sklearn surrogate only when ts_df is absent (statistical path); (3) `apply_outlier_treatment_per_column` crashes with float(None) if the user clears the threshold config field — fixed with `or 1.5` guard; (4) `cfgFillConfigs`/`cfgOutlierConfigs` crash with AttributeError if the frontend sends explicit `null` — `get(key, {})` returns None when key exists with null value; fixed with `or {}`; (5) `backtestStepSize` has no try/except — `int("1.5")` (decimal string) raises ValueError; fixed with `int(float(...))` and try/except fallback.
- 2026-04-04: Handler audit — fixed 5 bugs: (1) CRITICAL: `data_preview` returned `df.head(previewRows)` (default 100 rows) and passed that truncated slice to all downstream nodes — model config in the default template was only training on 100 rows; fixed to pass full dataframe through, (2) `validation`, `exploration`, `report`, `output`, `comment` had no registered handlers — pipeline.py skipped them and any node downstream of them received empty upstream_data (no data); added pass-through handlers for all five types, (3) `samplingSeed` crashes with `int(None)` when user clears the seed field — `null` is now safely handled with fallback to 42, (4) `samplePercent` and `outlierThreshold` crash with `float(None)` when cleared — both now safely handled, (5) merge handler raised raw pandas `KeyError` on nonexistent join columns — now raises descriptive error listing available columns.
- 2026-04-04: Modeling audit pass 4 — fixed 3 bugs: (1) `n_folds` crash in `run_statistical_forecast` on empty backtestFolds string — safe-parsed with fallback to 3, (2) Load mode returned sparse result with no leaderboard/feature_importance/backtest — expanded to match train mode parity (leaderboard, feature_importance, holdout backtest, ag_score_val, evaluate score), (3) Load mode info dict was missing horizon/freq/ag_score_val/ag_eval_metric.
- 2026-04-04: Modeling audit pass 3 — fixed 4 bugs: (1) `_build_excluded_models` returned lowercase snake_case keys instead of AutoGluon class names — added `_MODEL_KEY_TO_AG` mapping; model checkboxes now work, (2) leaderboard frontend used `model_name`/`score` fields — AutoGluon returns `model`/`score_val` — fixed field names + sort direction + added fit_time_marginal column, (3) `cfgTimeLimit` empty string crash — safe-parsed with fallback 600, (4) `forecastHorizon` empty string crash — both statistical and AutoGluon paths safe-parsed with fallback 12.
- 2026-04-04: Modeling audit pass 2 — fixed 5 bugs: (1) `backtest` rows never forwarded through SSE, (2) `_compute_backtest_metrics_from_predictions` replaced with `_holdout_backtest()` (true holdout: slice last horizon rows, predict, compare), (3) `backtestFolds` now passed as `num_val_windows` to AutoGluon fit, (4) `backtestStepSize` now passed as `val_step_size`, (5) `ag_score_val` from leaderboard surfaced in Output node panel as fallback metric.
- 2026-04-04: Modeling audit pass 1 — fixed 8 bugs: preset 'fast'→'fast_training' via PRESET_MAP; frequency string normalization via FREQ_MAP+FREQ_TO_AG; quantiles passed to predict(); known covariates future stub; backtest metrics path; `refit_full`, `excluded_model_types`, `num_gpus`/`num_cpus` wired.
- 2026-04-04: Pipeline editor — multi-condition filter builder (AND/OR, 14 operators), right-click context menu portal, Ctrl+K command palette, SVG chart export, ForecastResultsDashboard wired to live resultInfo, auto-detect frequency button, CI preset cards, model leaderboard table, per-series accuracy breakdown, full resultInfo SSE propagation.
- 2026-02-22: Hardened sandbox with restricted builtins whitelist. Improved DataSource file resolution.
- 2026-02-21: Added Feature Importance chart (16th). Express execution bridge. Frontend progress events.