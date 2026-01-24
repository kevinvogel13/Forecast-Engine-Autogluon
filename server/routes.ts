import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPipelineSchema, insertDatasetSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { parse } from "csv-parse/sync";
import { spawn } from "child_process";

const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Pipeline routes
  app.get("/api/pipelines", async (req, res) => {
    try {
      const pipelines = await storage.getPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/pipelines/:id", async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      res.status(500).json({ error: "Failed to fetch pipeline" });
    }
  });

  app.post("/api/pipelines", async (req, res) => {
    try {
      const validated = insertPipelineSchema.parse(req.body);
      const pipeline = await storage.createPipeline(validated);
      res.status(201).json(pipeline);
    } catch (error) {
      console.error("Error creating pipeline:", error);
      res.status(400).json({ error: "Failed to create pipeline" });
    }
  });

  app.patch("/api/pipelines/:id", async (req, res) => {
    try {
      const pipeline = await storage.updatePipeline(req.params.id, req.body);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error updating pipeline:", error);
      res.status(400).json({ error: "Failed to update pipeline" });
    }
  });

  app.delete("/api/pipelines/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePipeline(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });

  // Dataset routes
  app.get("/api/datasets", async (req, res) => {
    try {
      const datasets = await storage.getDatasets();
      res.json(datasets);
    } catch (error) {
      console.error("Error fetching datasets:", error);
      res.status(500).json({ error: "Failed to fetch datasets" });
    }
  });

  app.get("/api/datasets/:id", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error) {
      console.error("Error fetching dataset:", error);
      res.status(500).json({ error: "Failed to fetch dataset" });
    }
  });

  app.post("/api/datasets/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = await fs.readFile(req.file.path, 'utf-8');
      const records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      });

      const rows = records.length;
      const columns = records.length > 0 ? Object.keys(records[0]) : [];
      const cols = columns.length;

      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const finalPath = path.join(uploadsDir, req.file.originalname);
      await fs.rename(req.file.path, finalPath);

      const dataset = await storage.createDataset({
        filename: req.file.originalname,
        filepath: finalPath,
        rows,
        cols,
        columns,
        size: req.file.size
      });

      res.status(201).json(dataset);
    } catch (error) {
      console.error("Error uploading dataset:", error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: "Failed to upload dataset" });
    }
  });

  app.delete("/api/datasets/:id", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      await fs.unlink(dataset.filepath).catch(() => {});
      
      const deleted = await storage.deleteDataset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting dataset:", error);
      res.status(500).json({ error: "Failed to delete dataset" });
    }
  });

  // Get data preview (first N rows)
  app.get("/api/datasets/:id/preview", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      
      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      const records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      });

      const preview = records.slice(0, limit);
      const columns = records.length > 0 ? Object.keys(records[0]) : [];

      res.json({
        columns,
        rows: preview,
        totalRows: records.length,
        previewRows: preview.length
      });
    } catch (error) {
      console.error("Error fetching dataset preview:", error);
      res.status(500).json({ error: "Failed to fetch dataset preview" });
    }
  });

  // Get unique values for a column (for filter dropdowns)
  app.get("/api/datasets/:id/column/:column/values", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const columnName = req.params.column;
      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      const records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      });

      if (records.length === 0 || !(columnName in records[0])) {
        return res.status(404).json({ error: "Column not found" });
      }

      // Get unique values
      const uniqueValues = [...new Set(records.map((r: any) => r[columnName]))];
      
      // Determine if categorical (fewer than 50 unique values and not all numeric)
      const isCategorical = uniqueValues.length <= 50;
      const isNumeric = uniqueValues.every((v: any) => !isNaN(parseFloat(v)) && isFinite(v));

      res.json({
        column: columnName,
        uniqueValues: uniqueValues.slice(0, 100), // Limit to 100 values
        totalUnique: uniqueValues.length,
        isCategorical,
        isNumeric
      });
    } catch (error) {
      console.error("Error fetching column values:", error);
      res.status(500).json({ error: "Failed to fetch column values" });
    }
  });

  // Filtered data preview - applies filter transformations
  app.post("/api/datasets/:id/filtered-preview", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const { filters } = req.body as { filters?: Array<{ column: string; operator: string; value: any }> };
      
      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      let records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      }) as any[];

      // Apply filters
      if (filters && filters.length > 0) {
        for (const filter of filters) {
          const { column, operator, value } = filter;
          if (!column || !operator) continue;

          records = records.filter((row: any) => {
            const cellValue = row[column];
            
            switch (operator) {
              case 'eq':
                return String(cellValue) === String(value);
              case 'neq':
                return String(cellValue) !== String(value);
              case 'gt':
                return parseFloat(cellValue) > parseFloat(value);
              case 'gte':
                return parseFloat(cellValue) >= parseFloat(value);
              case 'lt':
                return parseFloat(cellValue) < parseFloat(value);
              case 'lte':
                return parseFloat(cellValue) <= parseFloat(value);
              case 'contains':
                return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'isin':
                const inValues = Array.isArray(value) ? value : [value];
                return inValues.map(String).includes(String(cellValue));
              case 'notin':
                const notInValues = Array.isArray(value) ? value : [value];
                return !notInValues.map(String).includes(String(cellValue));
              case 'isnull':
                return cellValue === null || cellValue === undefined || cellValue === '' || cellValue === 'null';
              case 'notnull':
                return cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== 'null';
              default:
                return true;
            }
          });
        }
      }

      const columns = records.length > 0 ? Object.keys(records[0]) : (dataset.columns || []);
      const preview = records.slice(0, limit);

      res.json({
        columns,
        rows: preview,
        totalRows: records.length,
        previewRows: preview.length
      });
    } catch (error) {
      console.error("Error fetching filtered preview:", error);
      res.status(500).json({ error: "Failed to fetch filtered preview" });
    }
  });

  // Python script execution endpoint - transforms data using Python code
  app.post("/api/datasets/:id/python-transform", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const { filters, pythonCode } = req.body as { 
        filters?: Array<{ column: string; operator: string; value: any }>;
        pythonCode?: string;
      };

      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      let records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      }) as any[];

      // Apply filters first
      if (filters && filters.length > 0) {
        for (const filter of filters) {
          const { column, operator, value } = filter;
          if (!column || !operator) continue;

          records = records.filter((row: any) => {
            const cellValue = row[column];
            
            switch (operator) {
              case 'eq':
                return String(cellValue) === String(value);
              case 'neq':
                return String(cellValue) !== String(value);
              case 'gt':
                return parseFloat(cellValue) > parseFloat(value);
              case 'gte':
                return parseFloat(cellValue) >= parseFloat(value);
              case 'lt':
                return parseFloat(cellValue) < parseFloat(value);
              case 'lte':
                return parseFloat(cellValue) <= parseFloat(value);
              case 'contains':
                return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'isin':
                const inValues = Array.isArray(value) ? value : [value];
                return inValues.map(String).includes(String(cellValue));
              case 'notin':
                const notInValues = Array.isArray(value) ? value : [value];
                return !notInValues.map(String).includes(String(cellValue));
              case 'isnull':
                return cellValue === null || cellValue === undefined || cellValue === '' || cellValue === 'null';
              case 'notnull':
                return cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== 'null';
              default:
                return true;
            }
          });
        }
      }

      // If no Python code, just return filtered data
      if (!pythonCode || pythonCode.trim() === '') {
        const columns = records.length > 0 ? Object.keys(records[0]) : (dataset.columns || []);
        const preview = records.slice(0, limit);
        return res.json({
          columns,
          rows: preview,
          totalRows: records.length,
          previewRows: preview.length
        });
      }

      // Execute Python transformation
      const inputJson = JSON.stringify(records);
      
      // Create a Python script that runs the user's code
      const pythonScript = `
import sys
import json
import pandas as pd

try:
    input_data = json.loads(sys.stdin.read())
    input_df = pd.DataFrame(input_data)
    
    # User's code
${pythonCode.split('\n').map(line => '    ' + line).join('\n')}
    
    # If the code returns df, use that. Otherwise assume it modified input_df
    if 'df' in dir() and isinstance(df, pd.DataFrame):
        result_df = df
    else:
        result_df = input_df
    
    # Convert to JSON
    result = result_df.to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

      const result = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
        const python = spawn('python3', ['-c', pythonScript]);
        let stdout = '';
        let stderr = '';

        python.stdin.write(inputJson);
        python.stdin.end();

        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        python.on('close', (code) => {
          if (code !== 0) {
            resolve({ error: stderr || 'Python script failed' });
          } else {
            try {
              const parsed = JSON.parse(stdout);
              if (parsed.error) {
                resolve({ error: parsed.error });
              } else {
                resolve({ data: parsed });
              }
            } catch (e) {
              resolve({ error: 'Failed to parse Python output' });
            }
          }
        });

        python.on('error', (err) => {
          resolve({ error: `Failed to execute Python: ${err.message}` });
        });
      });

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const transformedRecords = result.data || [];
      const columns = transformedRecords.length > 0 ? Object.keys(transformedRecords[0]) : [];
      const preview = transformedRecords.slice(0, limit);

      res.json({
        columns,
        rows: preview,
        totalRows: transformedRecords.length,
        previewRows: preview.length
      });
    } catch (error) {
      console.error("Error executing Python transform:", error);
      res.status(500).json({ error: "Failed to execute Python transform" });
    }
  });

  // Pipeline execution route
  app.post("/api/pipelines/:id/execute", async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }

      // For MVP, return mock execution results
      // In production, this would execute the actual pipeline
      res.json({
        status: "completed",
        message: "Pipeline executed successfully",
        results: {
          predictions: [],
          metrics: {
            mae: 0,
            rmse: 0,
            mape: 0
          }
        }
      });
    } catch (error) {
      console.error("Error executing pipeline:", error);
      res.status(500).json({ error: "Failed to execute pipeline" });
    }
  });

  return httpServer;
}
