import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logger } from "../logger";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

// Single source of truth for how errors leave the API. Always emits
// `{ error, requestId }` so the client can quote a stable id when reporting
// bugs. Zod failures become 400s with a `details` field describing each
// invalid path; `HttpError` instances pass through their own status; anything
// else is a 500 with a generic message (no stack traces leaked).
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // `req.id` is typed as `ReqId` (string | object | undefined) by pino-http;
  // coerce to string for the JSON response.
  const requestId = typeof req.id === "string" ? req.id : req.id != null ? String(req.id) : undefined;

  if (err instanceof ZodError) {
    const friendly = fromZodError(err, { prefix: null });
    logger.warn({ err: friendly.message, requestId, path: req.path }, "validation_failed");
    res.status(400).json({
      error: friendly.message,
      details: err.flatten(),
      requestId,
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ err: err.message, status: err.status, requestId, path: req.path }, "http_error");
    } else {
      logger.warn({ err: err.message, status: err.status, requestId, path: req.path }, "http_error");
    }
    res.status(err.status).json({ error: err.message, details: err.details, requestId });
    return;
  }

  // Unknown error — log the full thing server-side, return a generic message.
  logger.error({ err, requestId, path: req.path }, "unhandled_error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal Server Error", requestId });
}
