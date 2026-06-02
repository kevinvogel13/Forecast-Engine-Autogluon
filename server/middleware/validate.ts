import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

// Validates request parts against the supplied Zod schemas, replacing each
// part with the parsed value so the handler sees a typed, coerced object.
// Throws a `ZodError`, which the centralized error handler maps to a 400.
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
export { ZodError };
