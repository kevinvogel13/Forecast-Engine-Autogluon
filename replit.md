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
  - `components/dashboard/` - EDA and validation widgets
  - `components/layout/` - Shell and navigation

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
- **Python Script**: Custom pandas transformations via Monaco editor
  - Shows input data preview when connected to upstream data source
  - Stats (rows/cols) update based on connected input
- **SQL Transform**: DuckDB SQL-based transformations
  - Shows input data preview when connected to upstream data source
  - Stats (rows/cols) update based on connected input
- **Validation (EDA)**: Legacy exploratory data analysis dashboard (deprecated - use Data Exploration nodes instead)
- **Data Exploration**: Modular visualization node with configurable chart types
  - Chart types: Time Series, Bar Chart, Histogram, Scatter Plot, Data Table, Summary Statistics, ADI/COV Analysis
  - Each node stores: chartType, xColumn, yColumn, groupColumn, aggregation, takeaway
  - Takeaway text field for user insights/annotations per chart
  - Fetches data through upstream transforms (Filter, Sampling, Python, SQL)
  - Component: `client/src/components/exploration/DataExploration.tsx`
- **Report**: Combines multiple Data Exploration nodes into downloadable HTML report
  - Collects upstream exploration nodes via edge traversal
  - Drag-and-drop section reordering via sectionOrder array
  - Stores: reportTitle, sectionOrder (array of exploration node IDs)
  - Generate Report button triggers `/api/reports/generate` endpoint
  - Downloads styled HTML file with all visualizations and takeaways
- **Model Config**: AutoGluon forecast model configuration
- **Output**: View forecast results

### Modular Visualization Architecture (January 2026)
- Replaced monolithic EDA Dashboard with modular Data Exploration nodes
- Users add 1-30+ exploration chart nodes after sampling/transforms
- Each exploration node renders a specific chart type with takeaway annotations
- Report node collects exploration nodes and generates combined HTML report
- Benefits: Flexibility, reusability, customizable report ordering

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