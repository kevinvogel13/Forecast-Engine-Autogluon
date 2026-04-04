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

/** Test one row against a single filter condition. */
function testRowCondition(cellValue: any, operator: string, value: any): boolean {
  switch (operator) {
    case 'eq': { const _nc = parseFloat(cellValue), _nv = parseFloat(value); return (!isNaN(_nc) && !isNaN(_nv)) ? _nc === _nv : String(cellValue) === String(value); }
    case 'neq': { const _nc2 = parseFloat(cellValue), _nv2 = parseFloat(value); return (!isNaN(_nc2) && !isNaN(_nv2)) ? _nc2 !== _nv2 : String(cellValue) !== String(value); }
    case 'gt': return parseFloat(cellValue) > parseFloat(value);
    case 'gte': return parseFloat(cellValue) >= parseFloat(value);
    case 'lt': return parseFloat(cellValue) < parseFloat(value);
    case 'lte': return parseFloat(cellValue) <= parseFloat(value);
    case 'contains': return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains': return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts_with': return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'ends_with': return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
    case 'isin': { const inVals = Array.isArray(value) ? value : [value]; return inVals.map(String).includes(String(cellValue)); }
    case 'notin': { const notInVals = Array.isArray(value) ? value : [value]; return !notInVals.map(String).includes(String(cellValue)); }
    case 'isnull': return cellValue === null || cellValue === undefined || cellValue === '' || cellValue === 'null';
    case 'notnull': return cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== 'null';
    default: return true;
  }
}

/**
 * Apply a filter transform to an array of records.
 * Supports two formats:
 *   - Single condition: { column, operator, value }
 *   - Multi-condition:  { conditions: [{ column, op, value, logic }] }
 */
function applyFilterTransform(records: any[], filterData: any): any[] {
  if (filterData.conditions && Array.isArray(filterData.conditions)) {
    return records.filter((row: any) => {
      let result: boolean | null = null;
      for (const cond of filterData.conditions) {
        if (!cond.column) continue;
        const pass = testRowCondition(row[cond.column], cond.op || cond.operator || 'eq', cond.values ?? cond.value);
        if (result === null) {
          result = pass;
        } else if (cond.logic === 'OR') {
          result = result || pass;
        } else {
          result = result && pass;
        }
      }
      return result !== false;
    });
  }
  const { column, operator, value } = filterData;
  if (!column || !operator) return records;
  return records.filter((row: any) => testRowCondition(row[column], operator, value));
}

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

  app.get("/api/datasets/:id/column/:column/date-range", async (req, res) => {
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

      const dates = records
        .map((r: any) => new Date(r[columnName]))
        .filter((d: Date) => !isNaN(d.getTime()))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      if (dates.length === 0) {
        return res.status(400).json({ error: "No valid dates found in column" });
      }

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      res.json({
        column: columnName,
        minDate: formatDate(dates[0]),
        maxDate: formatDate(dates[dates.length - 1]),
        count: dates.length
      });
    } catch (error) {
      console.error("Error fetching date range:", error);
      res.status(500).json({ error: "Failed to fetch date range" });
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
          records = applyFilterTransform(records, transform.data);
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
              case 'eq': {
                const _nc = parseFloat(cellValue), _nv = parseFloat(value);
                return (!isNaN(_nc) && !isNaN(_nv)) ? _nc === _nv : String(cellValue) === String(value);
              }
              case 'neq': {
                const _nc2 = parseFloat(cellValue), _nv2 = parseFloat(value);
                return (!isNaN(_nc2) && !isNaN(_nv2)) ? _nc2 !== _nv2 : String(cellValue) !== String(value);
              }
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
              case 'not_contains':
                return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'starts_with':
                return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
              case 'ends_with':
                return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
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

      // Apply each transform in pipeline order - order matters because
      // upstream transforms may create columns used by downstream transforms
      for (const transform of transforms || []) {
        if (transform.type === 'sampling') {
          const { column, percent, seed } = transform.data;
          if (column && records.length > 0 && column in records[0]) {
            const samplePercent = Math.max(5, Math.min(100, percent || 100));
            const sampSeed = seed ?? 42;
            
            const allGroups = [...new Set(records.map((r: any) => r[column]))] as string[];
            const totalGroups = allGroups.length;
            const numGroupsToSample = Math.max(1, Math.ceil((samplePercent / 100) * totalGroups));
            
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
          continue;
        }
        if (transform.type === 'filter') {
          records = applyFilterTransform(records, transform.data);
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
              case 'eq': {
                const _nc = parseFloat(cellValue), _nv = parseFloat(value);
                return (!isNaN(_nc) && !isNaN(_nv)) ? _nc === _nv : String(cellValue) === String(value);
              }
              case 'neq': {
                const _nc2 = parseFloat(cellValue), _nv2 = parseFloat(value);
                return (!isNaN(_nc2) && !isNaN(_nv2)) ? _nc2 !== _nv2 : String(cellValue) !== String(value);
              }
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
              case 'not_contains':
                return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'starts_with':
                return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
              case 'ends_with':
                return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
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
              case 'eq': {
                const _nc = parseFloat(cellValue), _nv = parseFloat(value);
                return (!isNaN(_nc) && !isNaN(_nv)) ? _nc === _nv : String(cellValue) === String(value);
              }
              case 'neq': {
                const _nc2 = parseFloat(cellValue), _nv2 = parseFloat(value);
                return (!isNaN(_nc2) && !isNaN(_nv2)) ? _nc2 !== _nv2 : String(cellValue) !== String(value);
              }
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
              case 'not_contains':
                return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              case 'starts_with':
                return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
              case 'ends_with':
                return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
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

  // Pipeline execution route — streams progress via Server-Sent Events
  app.post("/api/pipelines/:id/execute", async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (data: any) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      };

      const pipelineData = { nodes: pipeline.nodes || [], edges: pipeline.edges || [] };
      const tmpFile = path.join(process.cwd(), 'uploads', `pipeline_exec_${Date.now()}.json`);
      await fs.writeFile(tmpFile, JSON.stringify(pipelineData));

      const env = {
        ...process.env,
        STORAGE_PATH: path.join(process.cwd(), 'uploads'),
        MODEL_PATH: path.join(process.cwd(), 'models'),
        STORAGE_TYPE: 'local',
        LOG_LEVEL: 'INFO',
      };

      const python = spawn('python3', ['-m', 'engine.pipeline', tmpFile], {
        cwd: process.cwd(),
        env,
      });

      let stdout = '';
      let stderr = '';
      // Line buffer: accumulates partial lines across stdout chunks so that
      // large JSON objects (e.g. model forecast payloads) spanning multiple
      // data events are never split and silently dropped.
      let lineBuffer = '';

      python.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        lineBuffer += text;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? ''; // keep the last (possibly incomplete) fragment
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'progress') sendEvent(parsed);
          } catch (_) {}
        }
      });

      python.stderr.on('data', (data) => { stderr += data.toString(); });

      const timeout = setTimeout(() => {
        python.kill();
        sendEvent({ type: 'result', success: false, error: 'Pipeline execution timed out after 30 minutes' });
        res.end();
      }, 30 * 60 * 1000);

      python.on('close', (code) => {
        clearTimeout(timeout);
        fs.unlink(tmpFile).catch(() => {});

        if (code !== 0 && !stdout.includes('"type": "result"')) {
          sendEvent({ type: 'result', success: false, error: stderr || `Process exited with code ${code}` });
          res.end();
          return;
        }

        const allLines = stdout.split('\n').filter((l: string) => l.trim());
        for (let i = allLines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(allLines[i]);
            if (parsed.type === 'result') {
              sendEvent(parsed);
              res.end();
              return;
            }
          } catch (_) {}
        }

        sendEvent({ type: 'result', success: false, error: 'No result received from pipeline engine' });
        res.end();
      });

      python.on('error', (err) => {
        clearTimeout(timeout);
        fs.unlink(tmpFile).catch(() => {});
        sendEvent({ type: 'result', success: false, error: err.message });
        res.end();
      });

      req.on('close', () => { clearTimeout(timeout); python.kill(); });

    } catch (error: any) {
      console.error("Error executing pipeline:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Failed to execute pipeline" });
      }
    }
  });

  return httpServer;
}
