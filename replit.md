# Forecaster - Data Pipeline Application

## Overview

Forecaster is a visual data pipeline and forecasting application. It enables users to upload datasets, construct data transformation pipelines using a drag-and-drop interface, and apply forecasting models. The application provides tools for exploratory data analysis, data validation, and visualization of forecast results, aiming to simplify the process of preparing data and generating predictions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Visual Editor**: @xyflow/react for drag-and-drop pipeline building
- **Code Editor**: Monaco Editor for Python/SQL
- **Charts**: Recharts for data visualization
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API Style**: RESTful JSON API
- **File Uploads**: Multer
- **Data Parsing**: csv-parse

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Defined in `shared/schema.ts` for database tables like `users`, `pipelines`, and `datasets`.
- **Migrations**: Managed by `drizzle-kit`.

### Key Design Patterns
- **Shared Types**: `shared/` directory for common type definitions.
- **API Client**: Centralized API call functions.
- **Custom Hooks**: React Query hooks for data fetching.
- **Component Structure**: Organized by function (UI, pipeline, dashboard, layout).

### Palette Organization & Color Coding
Nodes are categorized and color-coded:
- **Source** (blue)
- **Prep** (yellow)
- **Analysis** (emerald)
- **Model** (violet)

### Pipeline Node Types
- **Data Source**: Import CSV files.
- **Data Preview**: View data head.
- **Filter**: Apply row-level filters.
- **Merge / Join**: Combine datasets.
- **Sampling**: Stratified group sampling for time series.
- **Fill Missing Values**: Handle nulls with various strategies.
- **Date Gap Filler**: Ensure continuous date series.
- **Outlier Treatment**: Detect and handle outliers.
- **Column Transform**: Perform column operations (rename, drop, type cast, calculated columns).
- **Remove Duplicates**: Deduplicate rows.
- **Pivot / Unpivot**: Reshape data.
- **Python Script**: Custom pandas transformations.
- **SQL Transform**: DuckDB SQL-based transformations.
- **Validation (EDA)**: Exploratory data analysis dashboard with widgets like GeneralStats, TimeSeriesView, etc.
- **Exploration**: Modular chart components (e.g., Rich Text, Time Series, Demand Classification (ADI×CV²), Forecast vs Actual, Backtest Metrics). Features a consistent teal/indigo palette. 15 chart types total.
- **Report**: Combines multiple exploration charts into an HTML report.
- **Model Config**: AutoGluon forecast model configuration, including training/loading, data frequency, forecast horizon, backtesting with walk-forward cross-validation, feature engineering, and data preprocessing within folds. All config state persists to node data (save/load with pipeline). Per-column preprocessing: cfgFillConfigs (Record per column with strategy/constant), cfgOutlierConfigs (Record per column with method/threshold/action).
- **Output**: View forecast results.

### Data Flow & Preview
- Nodes recursively trace upstream connections to identify data sources.
- Previews and column values are dynamically fetched.
- Specific API endpoints support unfiltered, filtered, and column-specific data retrieval.

### Filter Node Technical Details
- Supports various operators and dynamic metadata updates.

### Build Process
- **Development**: Vite for frontend, tsx for backend.
- **Production**: esbuild for server, Vite for client, serving static files.

## External Dependencies

### Database
- PostgreSQL
- Drizzle ORM

### File Storage
- Local filesystem (`uploads/` directory)

### Key NPM Packages
- `@xyflow/react`
- `@monaco-editor/react`
- `@tanstack/react-query`
- `recharts`
- `react-dropzone`
- `framer-motion`
- `sonner`
- `drizzle-orm` / `drizzle-kit`
- `multer`
- `csv-parse`

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`