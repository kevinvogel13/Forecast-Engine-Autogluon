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

      const requestedLimit = parseInt(req.query.limit as string);
      const limit = isNaN(requestedLimit) || requestedLimit <= 0 ? 100 : requestedLimit;
      
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

  // Stratified sampling - sample X% of groups, return all rows for selected groups
  app.post("/api/datasets/:id/stratified-sample", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const { groupColumn, samplePercent, seed, transforms } = req.body as {
        groupColumn: string;
        samplePercent: number; // 5-100
        seed?: number;
        transforms?: Array<{ type: 'filter' | 'python' | 'sql'; data: any }>;
      };

      if (!groupColumn) {
        return res.status(400).json({ error: "groupColumn is required" });
      }

      const percent = Math.max(5, Math.min(100, samplePercent || 100));
      const sampSeed = seed ?? 42;

      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      let records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      }) as any[];

      // Apply any transforms first (filters, python, sql)
      for (const transform of transforms || []) {
        if (transform.type === 'filter') {
          const { column, operator, value } = transform.data;
          if (!column || !operator) continue;

          records = records.filter((row: any) => {
            const cellValue = row[column];
            switch (operator) {
              case 'eq': return String(cellValue) === String(value);
              case 'neq': return String(cellValue) !== String(value);
              case 'gt': return parseFloat(cellValue) > parseFloat(value);
              case 'gte': return parseFloat(cellValue) >= parseFloat(value);
              case 'lt': return parseFloat(cellValue) < parseFloat(value);
              case 'lte': return parseFloat(cellValue) <= parseFloat(value);
              case 'contains': return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'isin':
                const inValues = Array.isArray(value) ? value : [value];
                return inValues.map(String).includes(String(cellValue));
              case 'notin':
                const notInValues = Array.isArray(value) ? value : [value];
                return !notInValues.map(String).includes(String(cellValue));
              case 'isnull': return cellValue === null || cellValue === undefined || cellValue === '' || cellValue === 'null';
              case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== 'null';
              default: return true;
            }
          });
        } else if (transform.type === 'python') {
          const pythonCode = transform.data;
          if (!pythonCode || pythonCode.trim() === '') continue;
          
          const cleanedCode = pythonCode
            .split('\n')
            .map((line: string) => {
              if (line.trim().startsWith('return ')) {
                const returnValue = line.trim().substring(7).trim();
                return line.replace(/return\s+.+/, `result_df = ${returnValue}`);
              }
              return line;
            })
            .join('\n');

          const pythonScript = `
import sys
import json
import pandas as pd

try:
    input_data = json.loads(sys.stdin.read())
    input_df = pd.DataFrame(input_data)
    result_df = None
    
${cleanedCode.split('\n').map((line: string) => '    ' + line).join('\n')}
    
    if result_df is None:
        if 'df' in dir() and isinstance(df, pd.DataFrame):
            result_df = df
        else:
            result_df = input_df
    
    result = result_df.to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

          const inputJson = JSON.stringify(records);
          const pythonResult = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
            const python = spawn('python3', ['-c', pythonScript]);
            let stdout = '';
            let stderr = '';

            python.stdin.on('error', () => {});
            python.stdin.write(inputJson);
            python.stdin.end();

            python.stdout.on('data', (data) => { stdout += data.toString(); });
            python.stderr.on('data', (data) => { stderr += data.toString(); });

            python.on('close', (code) => {
              if (code !== 0) {
                resolve({ error: stderr || 'Python script failed' });
              } else {
                try {
                  const parsed = JSON.parse(stdout);
                  resolve({ data: parsed.error ? undefined : parsed, error: parsed.error });
                } catch (e) {
                  resolve({ error: 'Failed to parse Python output' });
                }
              }
            });

            python.on('error', (err) => {
              resolve({ error: `Failed to execute Python: ${err.message}` });
            });
          });

          if (pythonResult.error) {
            return res.status(400).json({ error: pythonResult.error });
          }
          records = pythonResult.data || records;
        } else if (transform.type === 'sql') {
          const sqlQuery = transform.data;
          if (!sqlQuery || sqlQuery.trim() === '') continue;
          
          const inputJson = JSON.stringify(records);
          
          const sqlScript = `
import sys
import json
import pandas as pd
import duckdb

try:
    input_data = json.loads(sys.stdin.read())
    input_table = pd.DataFrame(input_data)
    
    for col in input_table.columns:
        dtype_str = str(input_table[col].dtype)
        if dtype_str == 'object' or dtype_str == 'str' or dtype_str.startswith('string'):
            input_table[col] = input_table[col].astype(object)
    
    con = duckdb.connect()
    con.register('input_table', input_table)
    
    result_df = con.execute("""${sqlQuery.replace(/"/g, '\\"')}""").fetchdf()
    
    result = result_df.to_dict('records')
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

          const sqlResult = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
            const python = spawn('python3', ['-c', sqlScript]);
            let stdout = '';
            let stderr = '';

            python.stdin.on('error', () => {});
            python.stdin.write(inputJson);
            python.stdin.end();

            python.stdout.on('data', (data) => { stdout += data.toString(); });
            python.stderr.on('data', (data) => { stderr += data.toString(); });

            python.on('close', (code) => {
              if (code !== 0) {
                resolve({ error: stderr || 'SQL query failed' });
              } else {
                try {
                  const parsed = JSON.parse(stdout);
                  if (parsed.error) {
                    resolve({ error: parsed.error });
                  } else {
                    resolve({ data: parsed });
                  }
                } catch (e) {
                  resolve({ error: 'Failed to parse SQL output' });
                }
              }
            });

            python.on('error', (err) => {
              resolve({ error: `Failed to execute SQL: ${err.message}` });
            });
          });

          if (sqlResult.error) {
            return res.status(400).json({ error: sqlResult.error });
          }
          records = sqlResult.data || records;
        }
      }

      const totalRowsAfterTransforms = records.length;

      // Check if groupColumn exists
      if (records.length === 0 || !(groupColumn in records[0])) {
        return res.status(400).json({ error: `Column '${groupColumn}' not found in dataset` });
      }

      // Get unique group values
      const allGroups = [...new Set(records.map((r: any) => r[groupColumn]))] as string[];
      const totalGroups = allGroups.length;

      // Randomly sample X% of groups
      const numGroupsToSample = Math.max(1, Math.ceil((percent / 100) * totalGroups));
      
      // Seeded shuffle for reproducibility (simple mulberry32 PRNG)
      const seededRandom = (s: number) => {
        return () => {
          s = Math.imul(s ^ s >>> 15, s | 1);
          s ^= s + Math.imul(s ^ s >>> 7, s | 61);
          return ((s ^ s >>> 14) >>> 0) / 4294967296;
        };
      };
      const rng = seededRandom(sampSeed);
      const shuffled = [...allGroups].sort(() => rng() - 0.5);
      const selectedGroups = new Set(shuffled.slice(0, numGroupsToSample));

      // Filter records to only include selected groups
      const sampledRecords = records.filter((row: any) => selectedGroups.has(row[groupColumn]));

      const columns = sampledRecords.length > 0 ? Object.keys(sampledRecords[0]) : (records.length > 0 ? Object.keys(records[0]) : []);

      res.json({
        columns,
        rows: sampledRecords,
        totalRows: totalRowsAfterTransforms,
        sampledRows: sampledRecords.length,
        totalGroups,
        sampledGroups: numGroupsToSample,
        samplePercent: percent,
        groupColumn
      });
    } catch (error) {
      console.error("Error performing stratified sampling:", error);
      res.status(500).json({ error: "Failed to perform stratified sampling" });
    }
  });

  // Filtered data preview - applies filter transformations
  app.post("/api/datasets/:id/filtered-preview", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const requestedLimit = parseInt(req.query.limit as string);
      const limit = isNaN(requestedLimit) || requestedLimit <= 0 ? 100 : requestedLimit;
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

  // Unified transform endpoint - applies a chain of transforms (filters, python, sql) in order
  app.post("/api/datasets/:id/transform", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const requestedLimit = parseInt(req.query.limit as string);
      const limit = isNaN(requestedLimit) || requestedLimit <= 0 ? 100 : requestedLimit;
      const { transforms } = req.body as { 
        transforms: Array<{ type: 'filter' | 'python' | 'sql' | 'sampling'; data: any }>
      };

      const fileContent = await fs.readFile(dataset.filepath, 'utf-8');
      let records = parse(fileContent, { 
        columns: true, 
        skip_empty_lines: true 
      }) as any[];

      // Optimization: Apply sampling FIRST if present (before expensive Python/SQL transforms)
      // This significantly reduces data volume for downstream transforms
      const samplingTransform = (transforms || []).find((t: any) => t.type === 'sampling');
      if (samplingTransform) {
        const { column, percent, seed } = samplingTransform.data;
        if (column && records.length > 0 && column in records[0]) {
          const samplePercent = Math.max(5, Math.min(100, percent || 100));
          const sampSeed = seed ?? 42;
          
          const allGroups = [...new Set(records.map((r: any) => r[column]))] as string[];
          const totalGroups = allGroups.length;
          const numGroupsToSample = Math.max(1, Math.ceil((samplePercent / 100) * totalGroups));
          
          // Seeded shuffle (mulberry32 PRNG)
          const seededRandom = (s: number) => {
            return () => {
              s = Math.imul(s ^ s >>> 15, s | 1);
              s ^= s + Math.imul(s ^ s >>> 7, s | 61);
              return ((s ^ s >>> 14) >>> 0) / 4294967296;
            };
          };
          const rng = seededRandom(sampSeed);
          const shuffled = [...allGroups].sort(() => rng() - 0.5);
          const sampledGroups = new Set(shuffled.slice(0, numGroupsToSample));
          records = records.filter((r: any) => sampledGroups.has(r[column]));
        }
      }

      // Apply each transform in order (skip sampling since we applied it first)
      for (const transform of transforms || []) {
        if (transform.type === 'sampling') continue; // Already applied above
        if (transform.type === 'filter') {
          const { column, operator, value } = transform.data;
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
        } else if (transform.type === 'python') {
          const pythonCode = transform.data;
          if (!pythonCode || pythonCode.trim() === '') continue;
          
          const cleanedCode = pythonCode
            .split('\n')
            .map((line: string) => {
              if (line.trim().startsWith('return ')) {
                const returnValue = line.trim().substring(7).trim();
                return line.replace(/return\s+.+/, `result_df = ${returnValue}`);
              }
              return line;
            })
            .join('\n');

          const pythonScript = `
import sys
import json
import pandas as pd

try:
    input_data = json.loads(sys.stdin.read())
    input_df = pd.DataFrame(input_data)
    result_df = None
    
${cleanedCode.split('\n').map((line: string) => '    ' + line).join('\n')}
    
    if result_df is None:
        if 'df' in dir() and isinstance(df, pd.DataFrame):
            result_df = df
        else:
            result_df = input_df
    
    result = result_df.to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

          const inputJson = JSON.stringify(records);
          const pythonResult = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
            const python = spawn('python3', ['-c', pythonScript]);
            let stdout = '';
            let stderr = '';

            python.stdin.on('error', () => {});
            python.stdin.write(inputJson);
            python.stdin.end();

            python.stdout.on('data', (data) => { stdout += data.toString(); });
            python.stderr.on('data', (data) => { stderr += data.toString(); });

            python.on('close', (code) => {
              if (code !== 0) {
                resolve({ error: stderr || 'Python script failed' });
              } else {
                try {
                  const parsed = JSON.parse(stdout);
                  resolve({ data: parsed.error ? undefined : parsed, error: parsed.error });
                } catch (e) {
                  resolve({ error: 'Failed to parse Python output' });
                }
              }
            });

            python.on('error', (err) => {
              resolve({ error: `Failed to execute Python: ${err.message}` });
            });
          });

          if (pythonResult.error) {
            return res.status(400).json({ error: pythonResult.error });
          }
          records = pythonResult.data || records;
        } else if (transform.type === 'sql') {
          const sqlQuery = transform.data;
          if (!sqlQuery || sqlQuery.trim() === '') continue;
          
          const inputJson = JSON.stringify(records);
          
          const sqlScript = `
import sys
import json
import pandas as pd
import duckdb

try:
    input_data = json.loads(sys.stdin.read())
    input_table = pd.DataFrame(input_data)
    
    # Convert string/object columns to numpy object type (compatible with DuckDB)
    for col in input_table.columns:
        dtype_str = str(input_table[col].dtype)
        if dtype_str == 'object' or dtype_str == 'str' or dtype_str.startswith('string'):
            input_table[col] = input_table[col].astype(object)
    
    # Create a connection and register the DataFrame
    con = duckdb.connect()
    con.register('input_table', input_table)
    
    # Execute the SQL query
    result_df = con.execute("""${sqlQuery.replace(/"/g, '\\"')}""").fetchdf()
    
    result = result_df.to_dict('records')
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

          const sqlResult = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
            const python = spawn('python3', ['-c', sqlScript]);
            let stdout = '';
            let stderr = '';

            python.stdin.on('error', () => {});
            python.stdin.write(inputJson);
            python.stdin.end();

            python.stdout.on('data', (data) => { stdout += data.toString(); });
            python.stderr.on('data', (data) => { stderr += data.toString(); });

            python.on('close', (code) => {
              if (code !== 0) {
                resolve({ error: stderr || 'SQL query failed' });
              } else {
                try {
                  const parsed = JSON.parse(stdout);
                  if (parsed.error) {
                    resolve({ error: parsed.error });
                  } else {
                    resolve({ data: parsed });
                  }
                } catch (e) {
                  resolve({ error: 'Failed to parse SQL output' });
                }
              }
            });

            python.on('error', (err) => {
              resolve({ error: `Failed to execute SQL: ${err.message}` });
            });
          });

          if (sqlResult.error) {
            return res.status(400).json({ error: sqlResult.error });
          }
          records = sqlResult.data || records;
        } else if (transform.type === 'sampling') {
          const { column, percent, seed } = transform.data;
          if (!column || records.length === 0) continue;
          
          const samplePercent = Math.max(5, Math.min(100, percent || 100));
          const sampSeed = seed ?? 42;
          
          // Check if column exists
          if (!(column in records[0])) continue;
          
          // Get unique group values
          const allGroups = [...new Set(records.map((r: any) => r[column]))] as string[];
          const totalGroups = allGroups.length;
          
          // Randomly sample X% of groups
          const numGroupsToSample = Math.max(1, Math.ceil((samplePercent / 100) * totalGroups));
          
          // Seeded shuffle for reproducibility (simple mulberry32 PRNG)
          const seededRandom = (s: number) => {
            return () => {
              s = Math.imul(s ^ s >>> 15, s | 1);
              s ^= s + Math.imul(s ^ s >>> 7, s | 61);
              return ((s ^ s >>> 14) >>> 0) / 4294967296;
            };
          };
          const rng = seededRandom(sampSeed);
          const shuffled = [...allGroups].sort(() => rng() - 0.5);
          const selectedGroups = new Set(shuffled.slice(0, numGroupsToSample));
          
          // Filter records to only include selected groups
          records = records.filter((row: any) => selectedGroups.has(row[column]));
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
      console.error("Error executing transform:", error);
      res.status(500).json({ error: "Failed to execute transform" });
    }
  });

  // Python script execution endpoint - transforms data using Python code
  app.post("/api/datasets/:id/python-transform", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const requestedLimit = parseInt(req.query.limit as string);
      const limit = isNaN(requestedLimit) || requestedLimit <= 0 ? 100 : requestedLimit;
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
      // Remove 'return' statements from user code since we'll execute in module context
      const cleanedCode = pythonCode
        .split('\n')
        .map(line => {
          // Replace 'return df' or 'return input_df' with assignment to result_df
          if (line.trim().startsWith('return ')) {
            const returnValue = line.trim().substring(7).trim();
            return line.replace(/return\s+.+/, `result_df = ${returnValue}`);
          }
          return line;
        })
        .join('\n');

      const pythonScript = `
import sys
import json
import pandas as pd

try:
    input_data = json.loads(sys.stdin.read())
    input_df = pd.DataFrame(input_data)
    result_df = None
    
    # User's code
${cleanedCode.split('\n').map(line => '    ' + line).join('\n')}
    
    # If result_df was set, use that. Otherwise check for df, then input_df
    if result_df is None:
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

        python.stdin.on('error', () => {
          // Ignore EPIPE errors - they happen when Python exits early
        });
        
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

  // SQL script execution endpoint - transforms data using SQL (DuckDB)
  app.post("/api/datasets/:id/sql-transform", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const requestedLimit = parseInt(req.query.limit as string);
      const limit = isNaN(requestedLimit) || requestedLimit <= 0 ? 100 : requestedLimit;
      const { filters, sqlQuery, pythonCode } = req.body as { 
        filters?: Array<{ column: string; operator: string; value: any }>;
        sqlQuery?: string;
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

      // Apply Python transform first if present
      if (pythonCode && pythonCode.trim() !== '') {
        const cleanedCode = pythonCode
          .split('\n')
          .map(line => {
            if (line.trim().startsWith('return ')) {
              const returnValue = line.trim().substring(7).trim();
              return line.replace(/return\s+.+/, `result_df = ${returnValue}`);
            }
            return line;
          })
          .join('\n');

        const pythonScript = `
import sys
import json
import pandas as pd

try:
    input_data = json.loads(sys.stdin.read())
    input_df = pd.DataFrame(input_data)
    result_df = None
    
${cleanedCode.split('\n').map(line => '    ' + line).join('\n')}
    
    if result_df is None:
        if 'df' in dir() and isinstance(df, pd.DataFrame):
            result_df = df
        else:
            result_df = input_df
    
    result = result_df.to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

        const inputJson = JSON.stringify(records);
        const pythonResult = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
          const python = spawn('python3', ['-c', pythonScript]);
          let stdout = '';
          let stderr = '';

          python.stdin.on('error', () => {});
          python.stdin.write(inputJson);
          python.stdin.end();

          python.stdout.on('data', (data) => { stdout += data.toString(); });
          python.stderr.on('data', (data) => { stderr += data.toString(); });

          python.on('close', (code) => {
            if (code !== 0) {
              resolve({ error: stderr || 'Python script failed' });
            } else {
              try {
                const parsed = JSON.parse(stdout);
                resolve({ data: parsed.error ? undefined : parsed, error: parsed.error });
              } catch (e) {
                resolve({ error: 'Failed to parse Python output' });
              }
            }
          });

          python.on('error', (err) => {
            resolve({ error: `Failed to execute Python: ${err.message}` });
          });
        });

        if (pythonResult.error) {
          return res.status(400).json({ error: pythonResult.error });
        }
        records = pythonResult.data || records;
      }

      // If no SQL query, just return the data
      if (!sqlQuery || sqlQuery.trim() === '') {
        const columns = records.length > 0 ? Object.keys(records[0]) : (dataset.columns || []);
        const preview = records.slice(0, limit);
        return res.json({
          columns,
          rows: preview,
          totalRows: records.length,
          previewRows: preview.length
        });
      }

      // Execute SQL transformation using DuckDB via Python
      const inputJson = JSON.stringify(records);
      
      const sqlScript = `
import sys
import json
import pandas as pd
import duckdb

try:
    input_data = json.loads(sys.stdin.read())
    input_table = pd.DataFrame(input_data)
    
    # Convert string/object columns to numpy object type (compatible with DuckDB)
    for col in input_table.columns:
        dtype_str = str(input_table[col].dtype)
        if dtype_str == 'object' or dtype_str == 'str' or dtype_str.startswith('string'):
            input_table[col] = input_table[col].astype(object)
    
    # Create a connection and register the DataFrame
    con = duckdb.connect()
    con.register('input_table', input_table)
    
    # Execute the SQL query
    result_df = con.execute("""${sqlQuery.replace(/"/g, '\\"')}""").fetchdf()
    
    result = result_df.to_dict('records')
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

      const result = await new Promise<{ data?: any[]; error?: string }>((resolve) => {
        const python = spawn('python3', ['-c', sqlScript]);
        let stdout = '';
        let stderr = '';

        python.stdin.on('error', () => {});
        python.stdin.write(inputJson);
        python.stdin.end();

        python.stdout.on('data', (data) => { stdout += data.toString(); });
        python.stderr.on('data', (data) => { stderr += data.toString(); });

        python.on('close', (code) => {
          if (code !== 0) {
            resolve({ error: stderr || 'SQL query failed' });
          } else {
            try {
              const parsed = JSON.parse(stdout);
              if (parsed.error) {
                resolve({ error: parsed.error });
              } else {
                resolve({ data: parsed });
              }
            } catch (e) {
              resolve({ error: 'Failed to parse SQL output' });
            }
          }
        });

        python.on('error', (err) => {
          resolve({ error: `Failed to execute SQL: ${err.message}` });
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
      console.error("Error executing SQL transform:", error);
      res.status(500).json({ error: "Failed to execute SQL transform" });
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

  // Generate HTML report from exploration nodes
  app.post("/api/reports/generate", async (req, res) => {
    try {
      const { title, sections } = req.body;
      
      if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({ error: "Sections array required" });
      }

      const htmlSections = sections.map((section: any) => {
        const { nodeLabel, chartType, takeaway, chartHtml } = section;
        
        return `
          <div class="section">
            <h2>${nodeLabel || 'Visualization'}</h2>
            <div class="chart-type">${formatChartType(chartType)}</div>
            <div class="chart-container">
              ${chartHtml || '<div class="placeholder">Chart visualization</div>'}
            </div>
            ${takeaway ? `<div class="takeaway"><strong>Key Insight:</strong> ${takeaway}</div>` : ''}
          </div>
        `;
      }).join('\n');

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Data Exploration Report'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e5e7eb;
    }
    header h1 { font-size: 2.5rem; color: #111827; margin-bottom: 0.5rem; }
    header .date { color: #6b7280; font-size: 0.9rem; }
    .section {
      background: white;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 { font-size: 1.4rem; color: #374151; margin-bottom: 0.5rem; }
    .chart-type { 
      color: #6b7280; 
      font-size: 0.85rem; 
      text-transform: uppercase; 
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .chart-container {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 1.5rem;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .placeholder { color: #9ca3af; font-style: italic; }
    .takeaway {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 1rem;
      border-radius: 0 8px 8px 0;
      margin-top: 1rem;
    }
    footer {
      text-align: center;
      color: #9ca3af;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title || 'Data Exploration Report'}</h1>
      <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      })}</div>
    </header>
    ${htmlSections}
    <footer>
      <p>Generated by Forecaster Data Pipeline</p>
    </footer>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${(title || 'report').replace(/[^a-z0-9]/gi, '_')}.html"`);
      res.send(html);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  return httpServer;
}

function formatChartType(type: string): string {
  const labels: Record<string, string> = {
    timeseries: 'Time Series Chart',
    bar: 'Bar Chart',
    histogram: 'Histogram',
    scatter: 'Scatter Plot',
    table: 'Data Table',
    summary: 'Summary Statistics',
    adi_cov: 'ADI/COV Analysis'
  };
  return labels[type] || type;
}
