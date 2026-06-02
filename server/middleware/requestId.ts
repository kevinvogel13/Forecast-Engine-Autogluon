import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

// `pino-http` already declares `IncomingMessage.id` (as `ReqId`), so no
// module augmentation is needed here — assigning to `req.id` is enough.

// Assigns a short stable id to each request so that error responses,
// access logs, and the Python subprocess logs can be correlated. Honor an
// incoming `X-Request-Id` header (set by an upstream proxy / load balancer)
// when present so request ids survive across systems.
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[A-Za-z0-9_-]{1,128}$/.test(incoming) ? incoming : nanoid(12);
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
