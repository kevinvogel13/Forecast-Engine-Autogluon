import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPipelineSchema, insertDatasetSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { parse } from "csv-parse/sync";

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
