import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const pipelines = pgTable("pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  nodes: jsonb("nodes").notNull().default('[]'),
  edges: jsonb("edges").notNull().default('[]'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  rows: integer("rows").notNull().default(0),
  cols: integer("cols").notNull().default(0),
  size: integer("size").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertPipelineSchema = createInsertSchema(pipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  uploadedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;

export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasets.$inferSelect;
