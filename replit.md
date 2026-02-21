# Forecaster - Data Pipeline Application

## Overview

This is a visual data forecasting and pipeline builder application. Users can upload datasets, connect them through a drag-and-drop GUI to define data transformations and join logic, then run forecasting models on the processed data. The application provides exploratory data analysis (EDA), validation dashboards, and forecast result visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Visual Pipeline Editor**: @xyflow/react (React Flow) for drag-and-drop node-based pipeline design
- **Code Editor**: Monaco Editor for Python/SQL script editing within nodes
- **Charts**: Recharts for data visualization in dashboards
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (tsx for development)
- **API Style**: RESTful JSON API
- **File Uploads**: Multer for handling CSV/XLSX/JSON file uploads
- **Data Parsing**: csv-parse for CSV processing

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` defines all database tables
- **Tables**:
  - `users` - User authentication
  - `pipelines` - Stores pipeline configurations (nodes and edges as JSONB)
  - `datasets` - Metadata for uploaded files (filename, path, dimensions)
- **Migrations**: Managed via `drizzle-kit push`

### Key Design Patterns
- **Shared Types**: The `shared/` directory contains schema definitions used by both frontend and backend
- **API Client**: Centralized API functions in `client/src/lib/api.ts`
- **Custom Hooks**: React Query hooks in `client/src/hooks/` for data fetching (usePipelines, useDatasets)
- **Component Structure**: 
  - `components/ui/` - Base shadcn components
  - `components/pipeline/` - Flow editor and node components
  - `components/dashboard/` - Forecast results dashboard
  - `components/layout/` - Shell and navigation

### Palette Organization & Color Coding
Nodes are organized into 4 color-coded groups in the palette:
- **Source** (blue): Data Source
- **Prep** (yellow): Filter, Fill Missing, Remove Duplicates, Outlier Treatment, Sampling, Merge/Join, Aggregation, Column Transform, Date Gap Filler, Pivot/Unpivot, Python Script, SQL Transform
- **Analysis** (emerald): Data Preview, Exploration, Report
- **Model** (violet): Model Config, Output

### Pipeline Node Types
- **Data Source**: Import CSV files with automatic column detection
- **Data Preview**: View head of dataframe with configurable row count (5-100 rows)
- **Filter**: Filter rows with operators: eq, neq, gt, gte, lt, lte, contains, isin, notin, isnull, notnull
  - isin/notin support multi-select with auto-populated categorical values
  - Categorical columns (≤50 unique values) show dropdowns instead of text input
- **Merge / Join**: Join datasets on key columns (inner, left, right, full outer)
- **Sampling**: Stratified group sampling for meaningful time series analysis
  - Select a group column (e.g., DFU, SKU, Product)
  - Sample percentage slider (5-100% in 5% increments)
  - Random seed input for repeatable sampling (same seed = same groups selected)
  - Randomly samples X% of unique groups and returns ALL rows for each sampled group
  - Ensures each sampled group has complete time series data for CV/ADI calculation
  - Field names: `samplingColumn`, `samplePercent` (default: 100), `samplingSeed` (default: 42)
- **Fill Missing Values**: Handle NaN/null values in selected columns
  - Strategies: forward fill, backward fill, linear interpolation, mean, median, zero, constant
  - Optional constant value input when "constant" strategy is selected
  - Field names: `fillColumns` (array), `fillStrategy` (default: 'ffill'), `fillConstant`
- **Date Gap Filler**: Insert missing time periods to ensure continuous date series
  - Select date column, frequency (daily/weekly/monthly/quarterly), optional group column
  - Fill strategy for new rows: zero, forward fill, interpolation
  - Field names: `dateColumn`, `dateFrequency` (default: 'D'), `dateGroupColumn`, `gapFillStrategy` (default: 'zero')
- **Aggregation / Group By**: Group data and compute aggregate values
  - Multi-select group-by columns, value columns, aggregation function
  - Functions: sum, mean, median, min, max, count, first, last
  - Field names: `groupByColumns` (array), `aggValueColumns` (array), `aggFunction` (default: 'sum')
- **Outlier Treatment**: Detect and handle extreme values
  - Detection methods: IQR, Z-Score, Percentile with configurable threshold
  - Treatment actions: cap/floor (winsorize), replace with median/mean/null, remove rows
  - Field names: `outlierColumn`, `outlierMethod` (default: 'iqr'), `outlierThreshold`, `outlierAction` (default: 'cap')
- **Column Transform**: Column operations without code
  - Operations: rename, drop, type cast (numeric/integer/string/datetime/boolean), calculated column
  - Field names vary by operation: `colOperation`, `renameFrom`/`renameTo`, `dropColumns`, `castColumn`/`castType`, `calcColumnName`/`calcExpression`
- **Remove Duplicates**: Deduplicate rows by selected key columns
  - Keep strategy: first or last occurrence
  - Field names: `dedupColumns` (array), `dedupKeep` (default: 'first')
- **Pivot / Unpivot**: Reshape data between wide and long formats
  - Pivot (long→wide): index column, columns to spread, values, aggregation function
  - Unpivot (wide→long): ID columns, columns to melt, variable/value names
  - Field names: `pivotMode` (default: 'pivot'), `pivotIndex`, `pivotColumns`, `pivotValues`, `pivotAggFunc`, `unpivotIdColumns`, `unpivotValueColumns`, `unpivotVarName`, `unpivotValName`
- **Python Script**: Custom pandas transformations via Monaco editor
  - Shows input data preview when connected to upstream data source
  - Stats (rows/cols) update based on connected input
- **SQL Transform**: DuckDB SQL-based transformations
  - Shows input data preview when connected to upstream data source
  - Stats (rows/cols) update based on connected input
- **Validation (EDA)**: Exploratory data analysis dashboard with full transform support
  - Uses all upstream transforms (Filter, Sampling, Python, SQL) when connected downstream
  - For sampled data analysis, connect a Sampling node before the Validation node
  - Real-time data analysis based on actual dataset columns
  - Export Summary button downloads JSON analysis file
  - Widgets: GeneralStats, TimeSeriesView, CategoryDistribution, DataCompletenessChart, DemandPatternAnalysis, OutlierTable
- **Exploration**: Modular chart components for data exploration
  - Individual chart type selection with conditional column configuration
  - 13 chart types: Rich Text, Time Series, Histogram, Boxplot, Bar Chart, Scatter, Demand Classification (ADI×CV²), Pareto Analysis, Data Table, Summary Statistics, Seasonality, Data Quality, Outlier Detection
  - **Rich Text**: Formatted text component with toolbar (bold, italic, underline, headings, font sizes, 8 colors, bullet/numbered lists)
    - Uses contentEditable with document.execCommand for formatting
    - Content stored as HTML in `chartConfig.richTextContent`
    - Read-only rendering in report preview and HTML export
    - Editable in exploration config panel with live toolbar
  - Consistent teal/indigo color palette (PALETTE object in ExplorationCharts.tsx)
  - Each exploration node has a takeaway/notes textarea for user annotations
  - Chart preview rendered in the configuration panel when columns are selected
  - Emerald color theme
  - **Demand Classification (ADI×CV²)**: Rich quadrant dashboard
    - 4 quadrant cards (Smooth, Intermittent, Erratic, Lumpy) with muted background bar charts
    - Shows % of DFUs (count) and % of volume per quadrant
    - MAPE computation when forecast column is provided (optional)
    - Interactive ADI/CV² threshold sliders (drag to reclassify in real-time)
    - Scatter plot with dynamic reference lines
    - Config: idColumn, dateColumn, demandColumn, forecastColumn (optional)
- **Report**: Combines multiple exploration charts into an HTML report
  - Connect Exploration nodes to aggregate charts into report sections
  - Drag-to-reorder explorations in config panel and report preview dialog
  - Order persisted in `explorationOrder` array on report node data
  - Up/down arrow buttons and native HTML drag-and-drop for reordering
  - Report title configuration
  - Export HTML Report with filename dialog and standalone HTML generation
  - Export works without requiring preview dialog to be open (auto-loads data)
  - Violet color theme
- **Model Config**: AutoGluon forecast model configuration with planning workflow
  - Train/Load toggle: Train (build new model) or Load (use existing model)
  - Train mode: Training period date range (trainStart, trainEnd)
  - Load mode: Model path input (modelPath)
  - Forecast Horizon: Always visible, periods ahead (forecastHorizon, default: 12)
  - Backtesting toggle with walk-forward time series cross-validation
    - Number of folds (backtestFolds, default: 3)
    - Step size between folds (backtestStepSize)
    - Gap between train and test (backtestGap, default: 0)
  - Walk-Forward CV Visual Plan: Live bar chart showing proportional colored bars
    - Green (emerald) = Training, Yellow (amber) = Backtesting, Blue = Inference
    - One row per fold with expanding training window
    - Updates in real-time as user changes settings
  - Configure Pipeline button opens full-screen advanced settings dialog
  - Node data fields: modelMode, trainStart, trainEnd, modelPath, forecastHorizon, backtestEnabled, backtestFolds, backtestStepSize, backtestGap
- **Output**: View forecast results

### Data Flow & Preview
- Nodes trace back through edges to find source dataset ID using recursive edge traversal
- Preview and column values are fetched dynamically from connected data sources
- **Filtered Preview**: When a Data Preview node connects to a Filter node, it applies upstream filters
- API endpoints:
  - `GET /api/datasets/:id/preview` - Unfiltered dataset preview
  - `POST /api/datasets/:id/filtered-preview` - Preview with filters applied (accepts filters array in body)
  - `GET /api/datasets/:id/column/:column/values` - Unique values for a column (for filter dropdowns)

### Filter Node Technical Details
- Field names: `filterColumn`, `filterOp` (default: 'eq'), `filterValue`, `filterValues` (for isin/notin)
- Operators: eq, neq, gt, gte, lt, lte, contains, isin, notin, isnull, notnull
- Filter metadata updates when filter configuration changes via useEffect
- `getUpstreamFilters()` recursively collects all filter configurations from upstream nodes

### State Management Notes
- Node metadata uses `data.stats.rows` and `data.stats.cols` structure
- Preview fetch uses refs (nodesRef, edgesRef) to avoid dependency loops
- previewKey computed from upstream connections and filter states to trigger re-fetches only on meaningful changes

### Build Process
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: esbuild bundles server code, Vite builds client to `dist/public`
- Server serves static files from `dist/public` in production

## External Dependencies

### Database
- PostgreSQL (required, configured via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries

### File Storage
- Local filesystem (`uploads/` directory) for uploaded datasets

### Key NPM Packages
- `@xyflow/react` - Visual pipeline flow editor
- `@monaco-editor/react` - In-browser code editing
- `@tanstack/react-query` - Server state management
- `recharts` - Data visualization charts
- `react-dropzone` - File upload drag-and-drop
- `framer-motion` - UI animations
- `sonner` - Toast notifications
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `multer` - File upload handling
- `csv-parse` - CSV file parsing

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` - Error overlay in development
- `@replit/vite-plugin-cartographer` - Development tooling
- `@replit/vite-plugin-dev-banner` - Development banner