import type { Express, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { UPLOAD_DIR } from "../upload";
import { logger } from "../logger";

/** Liveness + readiness in one. Composed checks: DB SELECT 1, write-probe
 * the upload dir. Returns 200 only when both pass; 503 otherwise. This is
 * what the Docker HEALTHCHECK and external load balancers should poll. */
export function registerHealthRoute(app: Express): void {
  app.get("/api/health", async (_req: Request, res: Response) => {
    const checks = await Promise.all([checkDb(), checkStorage()]);
    const [dbCheck, storageCheck] = checks;
    const healthy = checks.every((c) => c.ok);
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      db: dbCheck,
      storage: storageCheck,
      uptime_s: Math.round(process.uptime()),
    });
  });
}

interface Check {
  ok: boolean;
  detail?: string;
}

async function checkDb(): Promise<Check> {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "health_db_failed");
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkStorage(): Promise<Check> {
  // Write a tiny probe file under UPLOAD_DIR/.health and remove it. If
  // the directory is unmounted or read-only, this exposes it.
  const probe = path.join(UPLOAD_DIR, ".health", `probe-${process.pid}`);
  try {
    await fs.mkdir(path.dirname(probe), { recursive: true });
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe).catch(() => {});
    return { ok: true };
  } catch (err) {
    logger.error({ err, probe }, "health_storage_failed");
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
