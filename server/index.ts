import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { attachAuth, requireAuth } from "./auth";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./logger";

const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop so secure cookies and rate-limit IPs work
// behind a reverse proxy (Replit, fly.io, nginx, etc).
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Request id must come first so every downstream middleware (logger,
// error handler, route handlers) can see and emit it.
app.use(requestId);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as Request).id ?? "unknown",
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    autoLogging: {
      ignore: (req) => req.url === "/api/health" || req.url?.startsWith("/@") === true,
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(
  helmet({
    // Vite dev needs inline scripts and HMR websockets; CSP is enforced in
    // production where the static bundle is served instead.
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);

// In production, CORS_ORIGIN should be set explicitly (comma-separated list).
// In dev, allow any origin so localhost:5173 (vite) can hit localhost:5000.
const corsOriginEnv = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin:
      corsOriginEnv && corsOriginEnv.length > 0
        ? corsOriginEnv.split(",").map((s) => s.trim())
        : true,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

attachAuth(app);

(async () => {
  // attachAuth already registered /api/auth/* routes above, so they remain
  // reachable without a session. Everything else under /api requires auth.
  app.use("/api", requireAuth);

  await registerRoutes(httpServer, app);

  // Centralized error handler — must be registered after the routes so it
  // catches errors thrown by them (including ZodError from `validate()`).
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info({ port }, "server_listening");
    },
  );
})();
