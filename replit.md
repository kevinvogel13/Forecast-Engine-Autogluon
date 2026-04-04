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

- 2026-04-04: Modeling audit pass 4 — fixed 3 bugs: (1) `n_folds` crash in `run_statistical_forecast` on empty backtestFolds string — safe-parsed with fallback to 3, (2) Load mode returned sparse result with no leaderboard/feature_importance/backtest — expanded to match train mode parity (leaderboard, feature_importance, holdout backtest, ag_score_val, evaluate score), (3) Load mode info dict was missing horizon/freq/ag_score_val/ag_eval_metric.
- 2026-04-04: Modeling audit pass 3 — fixed 4 bugs: (1) `_build_excluded_models` returned lowercase snake_case keys instead of AutoGluon class names — added `_MODEL_KEY_TO_AG` mapping; model checkboxes now work, (2) leaderboard frontend used `model_name`/`score` fields — AutoGluon returns `model`/`score_val` — fixed field names + sort direction + added fit_time_marginal column, (3) `cfgTimeLimit` empty string crash — safe-parsed with fallback 600, (4) `forecastHorizon` empty string crash — both statistical and AutoGluon paths safe-parsed with fallback 12.
- 2026-04-04: Modeling audit pass 2 — fixed 5 bugs: (1) `backtest` rows never forwarded through SSE, (2) `_compute_backtest_metrics_from_predictions` replaced with `_holdout_backtest()` (true holdout: slice last horizon rows, predict, compare), (3) `backtestFolds` now passed as `num_val_windows` to AutoGluon fit, (4) `backtestStepSize` now passed as `val_step_size`, (5) `ag_score_val` from leaderboard surfaced in Output node panel as fallback metric.
- 2026-04-04: Modeling audit pass 1 — fixed 8 bugs: preset 'fast'→'fast_training' via PRESET_MAP; frequency string normalization via FREQ_MAP+FREQ_TO_AG; quantiles passed to predict(); known covariates future stub; backtest metrics path; `refit_full`, `excluded_model_types`, `num_gpus`/`num_cpus` wired.
- 2026-04-04: Pipeline editor — multi-condition filter builder (AND/OR, 14 operators), right-click context menu portal, Ctrl+K command palette, SVG chart export, ForecastResultsDashboard wired to live resultInfo, auto-detect frequency button, CI preset cards, model leaderboard table, per-series accuracy breakdown, full resultInfo SSE propagation.
- 2026-02-22: Hardened sandbox with restricted builtins whitelist. Improved DataSource file resolution.
- 2026-02-21: Added Feature Importance chart (16th). Express execution bridge. Frontend progress events.