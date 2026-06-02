import { type User, type InsertUser, type Pipeline, type InsertPipeline, type Dataset, type InsertDataset } from "@shared/schema";
import { db } from "../db";
import { users, pipelines, datasets } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";

// Every pipeline/dataset query is scoped by userId so that one user cannot
// read, update, or delete another user's rows. The route layer pulls the id
// from the authenticated session (req.user.id) and passes it in here.
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pipelines
  getPipelines(userId: string): Promise<Pipeline[]>;
  getPipeline(userId: string, id: string): Promise<Pipeline | undefined>;
  createPipeline(userId: string, pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(userId: string, id: string, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined>;
  deletePipeline(userId: string, id: string): Promise<boolean>;

  // Datasets
  getDatasets(userId: string): Promise<Dataset[]>;
  getDataset(userId: string, id: string): Promise<Dataset | undefined>;
  createDataset(userId: string, dataset: InsertDataset): Promise<Dataset>;
  deleteDataset(userId: string, id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({ ...insertUser, email: insertUser.email.toLowerCase() })
      .returning();
    return result[0];
  }

  // Pipelines
  async getPipelines(userId: string): Promise<Pipeline[]> {
    return await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.userId, userId))
      .orderBy(desc(pipelines.updatedAt));
  }

  async getPipeline(userId: string, id: string): Promise<Pipeline | undefined> {
    const result = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createPipeline(userId: string, pipeline: InsertPipeline): Promise<Pipeline> {
    const result = await db.insert(pipelines).values({ ...pipeline, userId }).returning();
    return result[0];
  }

  async updatePipeline(
    userId: string,
    id: string,
    pipeline: Partial<InsertPipeline>,
  ): Promise<Pipeline | undefined> {
    const result = await db
      .update(pipelines)
      .set({ ...pipeline, updatedAt: new Date() })
      .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)))
      .returning();
    return result[0];
  }

  async deletePipeline(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Datasets
  async getDatasets(userId: string): Promise<Dataset[]> {
    return await db
      .select()
      .from(datasets)
      .where(eq(datasets.userId, userId))
      .orderBy(desc(datasets.uploadedAt));
  }

  async getDataset(userId: string, id: string): Promise<Dataset | undefined> {
    const result = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createDataset(userId: string, dataset: InsertDataset): Promise<Dataset> {
    const result = await db.insert(datasets).values({ ...dataset, userId }).returning();
    return result[0];
  }

  async deleteDataset(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DbStorage();
