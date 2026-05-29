# Forecaster - Data Pipeline & Forecasting Application

## Overview

Forecaster is a visual data pipeline and forecasting application designed for users to upload CSV datasets, construct data transformation pipelines using a drag-and-drop editor, and execute forecasting models. It provides comprehensive exploratory data analysis, data validation, 16 distinct chart types for visualization, and HTML report generation. The application's backend uses a Python engine for pipeline execution, designed for flexible deployment adhering to 12-Factor app principles. The project aims to empower users with powerful, intuitive tools for data analysis and predictive modeling.

## User Preferences

- Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18 and TypeScript, using Wouter for routing and TanStack React Query for state management. UI components are developed with shadcn/ui (Radix UI) and styled using Tailwind CSS. Key integrations include @xyflow/react for the visual pipeline editor, Monaco Editor for code editing, and Recharts for data visualization. Vite is used as the build tool.

### Backend

The backend is developed with Node.js and Express in TypeScript, providing a RESTful JSON API. It utilizes Multer for file uploads and csv-parse for CSV processing.

### Database

PostgreSQL, hosted on Neon, serves as the primary database. Drizzle ORM manages database interactions, with drizzle-kit used for migrations. Data validation is implemented with drizzle-zod and Zod. The database schema includes `users`, `pipelines`, and `datasets` tables to store user credentials, pipeline definitions, and dataset metadata.

### Pipeline Engine (Python)

The Python pipeline execution engine adheres to 12-Factor app principles, utilizing environment variables for configuration and structured JSON logging. It is stateless and manages dependencies via `pyproject.toml`. The engine processes pipeline definitions by resolving the topological order of nodes and executing corresponding handlers. Progress and results are emitted as structured JSON.

#### Node Types

The pipeline supports various node types, categorized as:
-   **Source:** Data Source (CSV import), Data Preview.
-   **Prep:** Filter, Merge/Join, Sampling, Fill Missing Values, Date Gap Filler, Outlier Treatment, Column Transform, Remove Duplicates, Pivot/Unpivot.
-   **Analysis:** Python Script (sandboxed pandas transforms), SQL Transform (DuckDB queries), Validation (EDA dashboard), Exploration (modular chart builder), Report (HTML report generation).
-   **Model:** Model Config (forecasting model configuration), Output (forecast results).

#### Exploration Chart Types

The application offers 16 chart types for data exploration, including Time Series, Histogram, Box Plot, Bar Chart, Scatter Plot, Demand Classification, Pareto Chart, Data Table, Summary Statistics, Seasonal Plot, Data Completeness, Outlier Table, Forecast vs Actual, Backtest Metrics, Feature Importance, and Rich Text annotations.

#### Model Handling

AutoGluon `TimeSeriesPredictor` is the **only** forecasting engine — there is no second/fallback model path. AutoGluon already ships the full statistical suite (SeasonalNaive, ETS/AutoETS, Theta, (Auto)ARIMA, Croston/NPTS for intermittent demand) alongside deep models, all trained and backtested inside one leakage-safe framework, so a parallel hand-rolled model would only add a divergent, less-trustworthy path. If AutoGluon is not installed the model node **fails loudly** with an actionable error rather than silently substituting a different kind of forecast.

**Leakage-free rolling-origin backtesting.** Driven by the user's `backtestFolds` setting: 1 fold = a single last-`horizon` holdout; N folds = an N-window rolling-origin evaluation, each window stepped back `backtestStepSize` points (default = horizon). For every window the engine trains a *fresh* predictor on only the data up to that window's origin (with fill/outlier statistics fit on that train slice), then scores against the **raw** held-out actuals; results are pooled across windows and each backtest row is tagged with its `fold`. Retraining per window is essential: the deployment model is trained on the full series, so reusing it would let it "predict" points it had already seen. AutoGluon's internal multi-window CV (`num_val_windows`) is also surfaced via the leaderboard `score_val`. (Load mode reuses the loaded model for each window, assuming it was trained on a different dataset.)

Backtest accuracy is reported through a single shared metrics module (`engine/metrics.py`): MAPE, sMAPE, WAPE, RMSE, MAE and MASE.

Optional calendar/holiday covariates: when `cfgHolidayEnabled` is set, the engine generates deterministic calendar features (month, day-of-week, quarter, ISO week) and, given `cfgHolidayCountry`, holiday flags via the `holidays` package. These are genuinely known over the forecast horizon, so they are recomputed (not forward-filled) for future timestamps and registered as known covariates.

#### Testing

A `pytest` suite under `tests/` covers the metrics module, prep/data handlers, pipeline orchestration and registry aliasing, the leakage-safe backtest helpers (`_split_holdout`/`_score_holdout`), the AutoGluon-required hard-fail, calendar/holiday features, and a frontend↔engine config-key contract guard (`engine/contract.py`) that fails if the engine reads a model-config key the FlowEditor no longer emits — directly targeting the field-name-drift class of bug recorded below.

#### Preview Transform Security

The Node server's preview/transform endpoints no longer build Python source by string-interpolating user SQL/Python (a code-injection vector — a crafted SQL query could escape the string literal and run arbitrary Python). User code and queries are now passed as JSON data on stdin to `engine/transform_runner.py`, which executes them through the same sandboxed engine handlers the pipeline uses.

#### Python Script Sandboxing

The Python script execution environment is sandboxed to enhance security by restricting built-ins and blocking sensitive imports and class traversal patterns.

## External Dependencies

### Python Packages

Key Python dependencies include `pandas`, `numpy`, `scikit-learn`, `scipy`, `duckdb`, and `holidays` (deterministic calendar/holiday covariates). AutoGluon (`autogluon.timeseries`) is **required** for the forecasting model node — the engine raises a clear error if it is missing rather than falling back to another model. `pytest` is a dev dependency.

### Node.js Packages

-   **Frontend:** `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `recharts`, `react-dropzone`, `framer-motion`, `sonner`.
-   **Backend/ORM:** `drizzle-orm`, `drizzle-kit`, `multer`, `csv-parse`.
-   **Replit-Specific:** `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.

## Recent Changes

- 2026-05-29: **Export pipeline as self-contained code** — a pipeline can now be exported as a downloadable, runnable project (.zip) instead of only executing in-app. `engine/exporter.py` vendors the engine into a `forecast_engine/` package with imports rewritten (`engine.` → `forecast_engine.`) so the output has **zero dependency on this repo**, and emits a project scaffold: `README.md`, `requirements.txt`, `run.py` (CLI), `databricks_notebook.py` (Databricks notebook-source), `pipeline.json` (the pipeline as data), and a `data/` folder. New `POST /api/pipelines/export-code` streams the zip (zipped in Python via the exporter's stdin CLI — no Node zip dep), and an "Export as Code (.zip)" item in the editor's menu downloads it. Verified end-to-end: the exported project runs in a clean subprocess with no access to this repo and produces identical results. Tests: `tests/test_exporter.py` (9) assert the vendored package has no bare `engine` imports, every rewritten module compiles, and the layout/Databricks header are correct. Python suite: 102 tests (+1 AG smoke, skipped); vitest: 17.
- 2026-05-29: UI surfacing + AutoGluon CI batch — (1) **Surfaced the new metrics in the UI**: the Forecast Results dashboard and the FlowEditor output panel now show WAPE/sMAPE/MASE/pinball-loss/interval-coverage alongside MAPE/RMSE/MAE (only those the engine reported). Pure presentation logic extracted to `client/src/lib/forecast-metrics.ts` and unit-tested. (2) **Data-quality warnings shown to the user** — an amber banner (dashboard) and a collapsible list (output panel) render `data_quality.warnings`. (3) **Model load picker**: new `GET /api/models` endpoint (backed by the registry) powers a dropdown of saved models in load mode, with a custom-path fallback. (4) **AutoGluon smoke test** (`tests/test_autogluon_smoke.py`) — a real end-to-end train/backtest/covariate fit, skipped when AutoGluon is absent and run by a nightly/dispatch CI job (`.github/workflows/autogluon-smoke.yml`). (5) Forecast CSV export already includes quantile columns. (6) Regenerated `uv.lock` for the `holidays` dep. (7) Confirmed no string-interpolated user code remains in the server. Python suite: 93 tests (+1 AG smoke, skipped without AutoGluon); vitest: 17 tests.
- 2026-05-29: Hardening + tooling batch — (1) Backtest predictors now train into a temp dir that is always cleaned up (no per-window artifact leaks) and can use a lighter `cfgBacktestPreset`. (2) Added probabilistic calibration metrics — pinball loss and empirical interval coverage (e.g. `coverage_80`). (3) Pre-training **data-quality gate** (`engine/data_quality.py`): hard-errors on fatal problems, warnings for missing/negative/constant/short series and duplicate timestamps. (4) Optional **user-supplied future covariates** via a second upstream dataset. (5) Replaced the Python-script string blocklist with **AST validation** and constrained Calculated Column `df.eval`. (6) `pipeline.py`: per-node timeout (`NODE_TIMEOUT`, model nodes exempt) and eviction of intermediate DataFrames once consumed. (7) **Model registry** (`engine/model_registry.py`) with opt-in retention (`MODEL_RETENTION`). (8) **CI** (`.github/workflows/ci.yml`: pytest + tsc + vitest) and a **vitest** suite for the server's pure filter logic (extracted to `server/filter-utils.ts`). (9) Set tsconfig `target: ES2020` and cast CSV parse results to fix typecheck under CI. Python suite: 93 tests; vitest: 10 tests.
- 2026-05-29: Forecasting overhaul — (1) **AutoGluon is now the sole forecasting engine**; the statistical fallback (and the brief statsmodels Holt-Winters experiment) were removed — the model node fails loudly if AutoGluon is missing. (2) **Fixed backtest data leakage**: the old holdout reused the full-data-trained model to "predict" points it had trained on, and preprocessing stats were fit on the whole series; the backtest now does leakage-free rolling-origin evaluation (driven by `backtestFolds`): for each window it trains a fresh predictor on data up to that window's origin (stats fit on the train slice) and scores against raw actuals, pooling results across windows. (3) Added shared metrics module (`engine/metrics.py`: MAPE/sMAPE/WAPE/RMSE/MAE/MASE). (4) Added optional deterministic calendar/holiday covariates (`cfgHolidayEnabled`/`cfgHolidayCountry`), recomputed for future dates and fed to AutoGluon as known covariates. (5) Fixed a pandas-3.0 bug where outlier-capping/fill wrote floats into int columns. (6) Removed the SQL/Python code-injection vector in the server's preview endpoints (now routed through stdin-driven `engine/transform_runner.py`, sandboxed). (7) Added a `pytest` suite and a frontend↔engine config-key contract guard.
- 2026-04-05: Sixteenth audit pass — fixed 2 bugs: (1) `feature_importance` exploration chart type had no config panel in FlowEditor — users could not select the feature name column (`groupColumn`) or importance value column (`valueColumn`), leaving the chart permanently in its empty placeholder state; (2) `forecast_actual`, `backtest_metrics`, and `feature_importance` chart types were missing from the `rechartsTypes` list in `generateReportHTML` — they fell into the `else` branch and showed "No preview available" instead of the correct recharts chart placeholder in exported HTML reports. Running total: 52 bugs fixed across 16 passes.
- 2026-04-05: Fifteenth audit pass (no new bugs found): deep read of model_handler.py, pipeline.py, data_handlers.py, code_handlers.py, FlowEditor.tsx, ExplorationCharts.tsx — all clean; only dead code found.
- 2026-04-05: Fourteenth audit pass — fixed 2 bugs: (1) `operation == 'calculated'` in `prep_handlers.py` should be `'calculate'` (frontend sends `'calculate'`) — Calculated Column feature was silently broken for all users; (2) `'outlier'` typo fixed to `'outliers'` in two `needsAllRows` checks in `FlowEditor.tsx` — Outlier Detection chart was capped at 500 rows instead of the full dataset, producing wrong results. Running total: 50 bugs fixed across 14 passes.
- 2026-04-05: Thirteenth audit pass — fixed 3 bugs: (1) `PRESET_MODELS` keys were `medium`/`high`/`best` but `PRESET_CARDS` emits `medium_quality`/`high_quality`/`best_quality` — `getModelsForPreset()` always fell back to the `fast` list so all non-fast presets showed wrong model checkboxes; (2) `sourceType='file'`/`'existing'` crashed Python data-source handler with "Unknown source type" — only `'upload'` was handled; fixed by normalising aliases before dispatch; (3) Forecast chart line was blank for AutoGluon quantile-only output — `r['0.5']` fallback existed in `totalForecast` but not `forecastChartData`; fixed. Running total: 48 bugs fixed across 13 passes.
- 2026-04-05: Twelfth audit pass — fixed 4 bugs: (1) Output panel upstream lookup only matched `'model_config'` — after template fix nodes use `'config'`; (2) Auto-detect frequency did one-hop lookup — now uses full-graph `getSourceDatasetId()`; (3) `getPreviewKey` only hashed direct-parent filters — now serialises full upstream transform chain; (4) `validatePipeline` checked wrong field names (`targetVar`/`timeCol` instead of `cfgTargetVar`/`cfgTimeCol`). Running total: 45 bugs fixed.
- 2026-04-04: Eleventh audit pass — fixed 3 bugs: model config node type mismatch in template, sync effects now check `'config'`, output panel lookup updated.
- 2026-04-04: Multiple earlier audit passes (1–10) — fixed 42 additional bugs covering SSE buffering, filter logic, handler type aliases, leaderboard fields, backtest metrics, forecast key detection, merge/pivot field names, null config crashes, and more.