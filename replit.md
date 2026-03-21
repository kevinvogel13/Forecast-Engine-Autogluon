# Forecaster - Data Pipeline & Forecasting Application

## Overview

Forecaster is a visual data pipeline and forecasting application designed to allow users to upload CSV datasets, construct data transformation pipelines using a drag-and-drop editor, and execute forecasting models. It offers comprehensive exploratory data analysis, data validation tools, 16 distinct chart types for data visualization, and the capability to generate HTML reports. The application's backend leverages a Python engine for pipeline execution, adhering to 12-Factor app principles for flexible deployment across various environments like Replit, personal servers, or cloud platforms.

## User Preferences

- Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18 and TypeScript. It uses Wouter for routing, though currently only the pipeline editor route ("/") is active. State management is handled by TanStack React Query, and UI components are built with shadcn/ui (based on Radix UI primitives) and styled using Tailwind CSS. The visual pipeline editor utilizes @xyflow/react, while Monaco Editor is integrated for code editing within nodes. Recharts is used for rendering various chart types. Vite serves as the build tool.

### Backend

The backend is developed with Node.js and Express in TypeScript, providing a RESTful JSON API. Multer is used for handling multipart/form-data file uploads, and csv-parse facilitates CSV parsing.

### Database

PostgreSQL, hosted on Neon (for Replit deployment), serves as the database. Drizzle ORM is used for database interactions, with drizzle-kit managing migrations. Data validation is performed using drizzle-zod and Zod.

#### Database Schema

The database includes `users`, `pipelines`, and `datasets` tables.
- `users`: Stores user credentials (`id`, `username`, `password`).
- `pipelines`: Stores pipeline definitions (`id`, `name`, `description`, `nodes`, `edges`, `createdAt`, `updatedAt`).
- `datasets`: Stores metadata about uploaded datasets (`id`, `filename`, `filepath`, `rows`, `cols`, `size`, `columns`, `uploadedAt`).

### Pipeline Engine (Python)

The Python pipeline execution engine adheres to 12-Factor app principles, using environment variables for configuration and structured JSON logging to stdout. It operates statelessly and manages dependencies via `pyproject.toml`.

#### Execution Flow

The engine receives pipeline definitions via a POST request to `/api/pipelines/:id/execute`. It processes the pipeline by resolving the topological order of nodes and executing handlers for each node. Progress and results are emitted as structured JSON.

#### Node Types

The pipeline supports various node types, categorized and color-coded:
- **Source (Blue):** Data Source (CSV import), Data Preview.
- **Prep (Yellow):** Filter, Merge/Join, Sampling, Fill Missing Values, Date Gap Filler, Outlier Treatment, Column Transform, Remove Duplicates, Pivot/Unpivot.
- **Analysis (Emerald):** Python Script (sandboxed pandas transforms), SQL Transform (DuckDB queries), Validation (EDA dashboard), Exploration (modular chart builder), Report (HTML report generation).
- **Model (Violet):** Model Config (forecasting model configuration), Output (forecast results).

#### Exploration Chart Types (16 total)

The application provides a comprehensive set of 16 chart types for data exploration, including Time Series, Histogram, Box Plot, Bar Chart, Scatter Plot, Demand Classification (ADI x CV-squared), Pareto Chart, Data Table, Summary Statistics, Seasonal Plot, Data Completeness, Outlier Table, Forecast vs Actual, Backtest Metrics, Feature Importance, and Rich Text annotations.

#### Model Handling

The primary forecasting model uses AutoGluon TimeSeriesPredictor, with statistical models as a fallback. It includes features for data leakage prevention, permutation-based feature importance, and walk-forward cross-validation.

#### Python Script Sandboxing

To ensure security, the Python script execution environment is sandboxed. It restricts built-ins to a whitelist, blocks sensitive imports (e.g., `os`, `sys`, `subprocess`), and prevents patterns that could allow class hierarchy traversal.

## External Dependencies

### Python Packages

Key Python dependencies include `pandas`, `numpy`, `scikit-learn`, `scipy`, and `duckdb`. AutoGluon is an optional runtime dependency for forecasting models.

### Node.js Packages

Frontend and backend rely on several key NPM packages:
- **Frontend:** `@xyflow/react` (visual editor), `@monaco-editor/react` (code editor), `@tanstack/react-query` (state management), `recharts` (charts), `react-dropzone` (file upload), `framer-motion` (animations), `sonner` (toast notifications).
- **Backend/ORM:** `drizzle-orm`, `drizzle-kit`, `multer` (file uploads), `csv-parse` (CSV parsing).
- **Replit-Specific:** `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.

## Project File Structure

```
client/src/
  App.tsx                             Root (only "/" route active, others exist but unwired)
  components/pipeline/FlowEditor.tsx  Main canvas, execution logic, save/load dialogs
  components/pipeline/NodePalette.tsx Draggable node types (left sidebar)
  components/pipeline/PipelineNode.tsx Node rendering with status indicators
  components/configuration/ConfigurationPanel.tsx  Right sidebar config forms
  components/exploration/ExplorationCharts.tsx      All 16 chart components
  components/dashboard/               EDA widgets (GeneralStats, TimeSeriesView, etc.)
  components/file-upload/FileDropzone.tsx           CSV drag-and-drop upload
  hooks/useDatasets.ts                React Query for datasets
  hooks/usePipelines.ts               React Query for pipelines
  lib/api.ts                          Centralized API client
  pages/pipeline.tsx                  Active pipeline editor page

server/
  index.ts                            Entry point, binds to port
  routes.ts                           All 18 REST API route handlers
  storage.ts                          IStorage interface + DbStorage implementation
  vite.ts                             Vite dev middleware
  static.ts                           Production static serving

shared/schema.ts                      Drizzle tables, Zod schemas, TypeScript types

engine/
  pipeline.py                         Entry: reads JSON, topological sort, runs handlers
  config.py                           Env var config + JSON logger setup
  adapters/storage.py                 StorageAdapter ABC + LocalStorageAdapter
  handlers/registry.py                @register decorator pattern
  handlers/data_handlers.py           data_source, data_preview, filter (3 handlers)
  handlers/prep_handlers.py           fill_missing, column_transform, remove_duplicates,
                                      merge, sampling, date_gap_filler, outlier_treatment, pivot (8)
  handlers/code_handlers.py           python_script (sandboxed), sql_transform (DuckDB) (2)
  handlers/model_handler.py           model_config (AutoGluon + statistical fallback) (1)
```

## API Reference

### Pipeline Endpoints
- `GET /api/pipelines` — List all
- `GET /api/pipelines/:id` — Get by ID
- `POST /api/pipelines` — Create (body: name, description, nodes, edges)
- `PATCH /api/pipelines/:id` — Update fields
- `DELETE /api/pipelines/:id` — Delete
- `POST /api/pipelines/:id/execute` — Execute via Python engine

### Dataset Endpoints
- `GET /api/datasets` — List all
- `GET /api/datasets/:id` — Get metadata
- `POST /api/datasets/upload` — Upload CSV (multipart, field: file)
- `DELETE /api/datasets/:id` — Delete dataset + file
- `GET /api/datasets/:id/preview` — Row preview (?rows=N)
- `GET /api/datasets/:id/column/:column/values` — Unique column values
- `GET /api/datasets/:id/column/:column/date-range` — Date min/max
- `POST /api/datasets/:id/stratified-sample` — Group sampling
- `POST /api/datasets/:id/filtered-preview` — Filtered preview
- `POST /api/datasets/:id/transform` — Column transforms
- `POST /api/datasets/:id/python-transform` — Python pandas transform
- `POST /api/datasets/:id/sql-transform` — DuckDB SQL transform

## Engine Environment Variables

- `STORAGE_TYPE` (default: local) — Storage backend (future: s3, gcs)
- `STORAGE_PATH` (default: ./uploads) — File storage base path
- `MODEL_PATH` (default: ./models) — Model artifacts path
- `DATABASE_URL` — PostgreSQL connection string
- `LOG_LEVEL` (default: INFO) — DEBUG/INFO/WARNING/ERROR
- `MAX_ROWS_PREVIEW` (default: 1000) — Max preview rows
- `MAX_EXECUTION_TIME` (default: 3600) — Timeout in seconds

## Engine Handler Details

14 handlers registered via `@register(node_type)` decorator. Engine status values: running, completed, error, skipped. Frontend maps to: processing, success, error.

### Storage Adapter
Abstract `StorageAdapter` ABC with: read_file, write_file, file_exists, list_files, get_full_path. `LocalStorageAdapter` resolves paths relative to STORAGE_PATH. Designed for swap to S3/GCS without handler changes.

### Model Config Handler
- AutoGluon TimeSeriesPredictor (optional, not in pyproject.toml, used when installed)
- Statistical model fallback when AutoGluon unavailable
- Per-column preprocessing within train/test folds (prevents data leakage)
- cfgFillConfigs: Record per column with strategy + constant value
- cfgOutlierConfigs: Record per column with method/threshold/action
- Permutation-based feature importance via scikit-learn
- Walk-forward cross-validation for backtesting

### Python Script Security
- Builtins restricted to safe whitelist (no open, eval, exec, compile, __import__, getattr)
- Blocked imports: os, sys, subprocess, shutil, pathlib, socket, http, urllib, requests, importlib, ctypes, signal
- Blocked class traversal: __subclasses__, __bases__, __class__
- User code gets: df, pd, np, input_data, result
- Defense-in-depth only; containerized execution needed for untrusted code

## Build Process

- Development: Vite (HMR) + tsx (watch)
- Production: Vite build to dist/public/, esbuild to dist/index.js

## Recent Changes

- 2026-03-21: Completed session of 8 pipeline & model improvements: (1) multi-condition filter builder (AND/OR logic chains, 14 operators, up to 6 conditions per filter node — backend `filterConditions` array replaces legacy single-filter), (2) right-click node context menu (Duplicate/Rename/Disconnect All/Delete via portal), (3) Ctrl+K/Cmd+K command palette (fuzzy search over all node types + actions: Run, Auto Layout, Save), (4) chart SVG export button in exploration preview panel (wired to `chartPreviewRef`), (5) ForecastResultsDashboard fully wired to real execution data (`resultsModelInfo` passed from model node's `resultInfo`), (6) "View Results" button populates results from model node's resultInfo before opening dialog, (7) AutoGluon covariates wiring (static features + known covariates) in `model_handler.py`, (8) Multi-series time series chart in ExplorationCharts grouped by `groupColumn`.
- 2026-03-21: Added 8 modeling improvements: (1) confidence interval presets (80/90/95/99% CI radio cards replacing raw quantile checkboxes), (2) visual training preset cards (Fast/Medium/High/Best with time estimates), (3) auto-detect frequency button (infers D/W/M/Q/Y from connected dataset's time column), (4) live metrics card in Output node panel (MAPE/RMSE/MAE after backtest run), (5) forecast CSV export button in Output panel, (6) model leaderboard table in Model Config panel (AutoGluon ranked models), (7) per-series accuracy breakdown in Output panel (worst-performing series highlighted), (8) full resultInfo persisted on node data + propagated through SSE events (leaderboard, feature importance, forecast rows, per-series metrics). Python engine now includes leaderboard/feature_importance/per_series_metrics/forecast in SSE resultInfo payload.
- 2026-03-21: Added 8 pipeline editor improvements: (1) node palette search filter, (2) Ctrl+C/V copy-paste nodes with history, (3) auto-layout button (topological sort, left-to-right columns), (4) pre-run validation dialog (errors/warnings, "Run Anyway"/"Fix Issues"), (5) Comment/sticky-note node type under Canvas category (editable amber note, no connectors), (6) dataset column profiling in Data Source config panel (type + null count per column, auto-fetches on selection), (7) execution history panel with per-node result summary, (8) inline data preview tooltip on node hover (500ms delay, first 5 rows). Python engine now emits `preview_rows` in SSE resultInfo for completed DataFrame nodes.
- 2026-02-22: Hardened sandbox with restricted builtins whitelist. Improved DataSource file resolution.
- 2026-02-21: Added Feature Importance chart (16th). Express execution bridge. Frontend progress events.
- 2026-02-21: Built Python engine with 14 handlers, 12-Factor config, storage adapter, handler registry.