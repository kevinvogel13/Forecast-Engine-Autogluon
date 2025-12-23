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