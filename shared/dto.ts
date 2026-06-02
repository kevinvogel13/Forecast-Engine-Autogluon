import { z } from "zod";

// Filter-condition primitive shared across endpoints.
const filterOperator = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "isin",
  "notin",
  "isnull",
  "notnull",
]);

const filterValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const filterCondition = z.object({
  column: z.string().min(1).max(256),
  operator: filterOperator.optional(),
  op: filterOperator.optional(),
  value: filterValue.optional(),
  values: filterValue.optional(),
  logic: z.enum(["AND", "OR"]).optional(),
});

// Single-condition filter or multi-condition compound. Routes branch on which
// shape is present (`data.conditions` vs flat `column`/`operator`/`value`).
const filterData = z.union([
  z.object({
    column: z.string().min(1).max(256),
    operator: filterOperator,
    value: filterValue.optional(),
  }),
  z.object({
    conditions: z.array(filterCondition).max(50),
  }),
]);

// User-supplied code/SQL. Hard length caps stop the Node process from holding
// arbitrarily large strings in memory, and (later) the sandbox enforces its
// own limit before running it.
const pythonCode = z.string().max(20_000);
const sqlQuery = z.string().max(10_000);

export const transformItem = z.discriminatedUnion("type", [
  z.object({ type: z.literal("filter"), data: filterData }),
  z.object({ type: z.literal("python"), data: pythonCode }),
  z.object({ type: z.literal("sql"), data: sqlQuery }),
  z.object({
    type: z.literal("sampling"),
    data: z.object({
      column: z.string().min(1).max(256),
      percent: z.number().min(5).max(100).optional(),
      seed: z.number().int().optional(),
    }),
  }),
]);

const transforms = z.array(transformItem).max(50).optional();

// Body shapes for the previously `any`-typed endpoints in server/routes.ts.

export const stratifiedSampleBody = z.object({
  groupColumn: z.string().min(1).max(256),
  samplePercent: z.number().min(5).max(100).default(100),
  seed: z.number().int().optional(),
  transforms,
});
export type StratifiedSampleBody = z.infer<typeof stratifiedSampleBody>;

export const filteredPreviewBody = z.object({
  filters: z.array(filterCondition).max(50).optional(),
});
export type FilteredPreviewBody = z.infer<typeof filteredPreviewBody>;

export const transformChainBody = z.object({
  transforms: z.array(transformItem).max(50),
});
export type TransformChainBody = z.infer<typeof transformChainBody>;

export const pythonTransformBody = z.object({
  filters: z.array(filterCondition).max(50).optional(),
  pythonCode: pythonCode.optional(),
});
export type PythonTransformBody = z.infer<typeof pythonTransformBody>;

export const sqlTransformBody = z.object({
  filters: z.array(filterCondition).max(50).optional(),
  sqlQuery: sqlQuery.optional(),
  pythonCode: pythonCode.optional(),
});
export type SqlTransformBody = z.infer<typeof sqlTransformBody>;

// Path-param helpers — accept a sane id shape on every `/api/.../:id` route
// so the handler never sees a `..`/`%2f`-laden value.
export const idParam = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

export const idAndColumnParam = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  column: z.string().min(1).max(256),
});
