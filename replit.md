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

The primary forecasting model uses AutoGluon TimeSeriesPredictor, with statistical models as a fallback. It includes features for data leakage prevention, permutation-based feature importance, and walk-forward cross-validation.

#### Python Script Sandboxing

The Python script execution environment is sandboxed to enhance security by restricting built-ins and blocking sensitive imports and class traversal patterns.

## External Dependencies

### Python Packages

Key Python dependencies include `pandas`, `numpy`, `scikit-learn`, `scipy`, and `duckdb`. AutoGluon is an optional runtime dependency for forecasting models.

### Node.js Packages

-   **Frontend:** `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `recharts`, `react-dropzone`, `framer-motion`, `sonner`.
-   **Backend/ORM:** `drizzle-orm`, `drizzle-kit`, `multer`, `csv-parse`.
-   **Replit-Specific:** `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.

## Recent Changes

- 2026-04-05: Sixteenth audit pass — fixed 2 bugs: (1) `feature_importance` exploration chart type had no config panel in FlowEditor — users could not select the feature name column (`groupColumn`) or importance value column (`valueColumn`), leaving the chart permanently in its empty placeholder state; (2) `forecast_actual`, `backtest_metrics`, and `feature_importance` chart types were missing from the `rechartsTypes` list in `generateReportHTML` — they fell into the `else` branch and showed "No preview available" instead of the correct recharts chart placeholder in exported HTML reports. Running total: 52 bugs fixed across 16 passes.
- 2026-04-05: Fifteenth audit pass (no new bugs found): deep read of model_handler.py, pipeline.py, data_handlers.py, code_handlers.py, FlowEditor.tsx, ExplorationCharts.tsx — all clean; only dead code found.
- 2026-04-05: Fourteenth audit pass — fixed 2 bugs: (1) `operation == 'calculated'` in `prep_handlers.py` should be `'calculate'` (frontend sends `'calculate'`) — Calculated Column feature was silently broken for all users; (2) `'outlier'` typo fixed to `'outliers'` in two `needsAllRows` checks in `FlowEditor.tsx` — Outlier Detection chart was capped at 500 rows instead of the full dataset, producing wrong results. Running total: 50 bugs fixed across 14 passes.
- 2026-04-05: Thirteenth audit pass — fixed 3 bugs: (1) `PRESET_MODELS` keys were `medium`/`high`/`best` but `PRESET_CARDS` emits `medium_quality`/`high_quality`/`best_quality` — `getModelsForPreset()` always fell back to the `fast` list so all non-fast presets showed wrong model checkboxes; (2) `sourceType='file'`/`'existing'` crashed Python data-source handler with "Unknown source type" — only `'upload'` was handled; fixed by normalising aliases before dispatch; (3) Forecast chart line was blank for AutoGluon quantile-only output — `r['0.5']` fallback existed in `totalForecast` but not `forecastChartData`; fixed. Running total: 48 bugs fixed across 13 passes.
- 2026-04-05: Twelfth audit pass — fixed 4 bugs: (1) Output panel upstream lookup only matched `'model_config'` — after template fix nodes use `'config'`; (2) Auto-detect frequency did one-hop lookup — now uses full-graph `getSourceDatasetId()`; (3) `getPreviewKey` only hashed direct-parent filters — now serialises full upstream transform chain; (4) `validatePipeline` checked wrong field names (`targetVar`/`timeCol` instead of `cfgTargetVar`/`cfgTimeCol`). Running total: 45 bugs fixed.
- 2026-04-04: Eleventh audit pass — fixed 3 bugs: model config node type mismatch in template, sync effects now check `'config'`, output panel lookup updated.
- 2026-04-04: Multiple earlier audit passes (1–10) — fixed 42 additional bugs covering SSE buffering, filter logic, handler type aliases, leaderboard fields, backtest metrics, forecast key detection, merge/pivot field names, null config crashes, and more.