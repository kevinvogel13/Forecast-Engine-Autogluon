import { type User, type InsertUser, type Pipeline, type InsertPipeline, type Dataset, type InsertDataset } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "../db";
import { users, pipelines, datasets } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pipelines
  getPipelines(): Promise<Pipeline[]>;
  getPipeline(id: string): Promise<Pipeline | undefined>;
  createPipeline(pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(id: string, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined>;
  deletePipeline(id: string): Promise<boolean>;

  // Datasets
  getDatasets(): Promise<Dataset[]>;
  getDataset(id: string): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  deleteDataset(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Pipelines
  async getPipelines(): Promise<Pipeline[]> {
    return await db.select().from(pipelines).orderBy(desc(pipelines.updatedAt));
  }

  async getPipeline(id: string): Promise<Pipeline | undefined> {
    const result = await db.select().from(pipelines).where(eq(pipelines.id, id)).limit(1);
    return result[0];
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    const result = await db.insert(pipelines).values(pipeline).returning();
    return result[0];
  }

  async updatePipeline(id: string, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined> {
    const result = await db.update(pipelines)
      .set({ ...pipeline, updatedAt: new Date() })
      .where(eq(pipelines.id, id))
      .returning();
    return result[0];
  }

  async deletePipeline(id: string): Promise<boolean> {
    const result = await db.delete(pipelines).where(eq(pipelines.id, id)).returning();
    return result.length > 0;
  }

  // Datasets
  async getDatasets(): Promise<Dataset[]> {
    return await db.select().from(datasets).orderBy(desc(datasets.uploadedAt));
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    const result = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    return result[0];
  }

  async createDataset(dataset: InsertDataset): Promise<Dataset> {
    const result = await db.insert(datasets).values(dataset).returning();
    return result[0];
  }

  async deleteDataset(id: string): Promise<boolean> {
    const result = await db.delete(datasets).where(eq(datasets.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DbStorage();
