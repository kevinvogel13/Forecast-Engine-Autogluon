import path from "path";
import fs from "fs/promises";
import multer from "multer";
import type { Request } from "express";
import { HttpError } from "./middleware/errorHandler";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const ALLOWED_MIME = new Set([
  "text/csv",
  "application/vnd.ms-excel", // browsers sometimes report CSV as this
  "application/csv",
  "text/plain",
  "application/json",
  "application/octet-stream", // some browsers fall back here for CSV
]);
const ALLOWED_EXT = new Set([".csv", ".tsv", ".json", ".txt"]);

const MAX_UPLOAD_BYTES = parseInt(
  process.env.MAX_UPLOAD_BYTES ?? String(50 * 1024 * 1024),
  10,
);

// Multer puts uploads in a temp dir first; the route handler moves the file
// into its final per-user/per-dataset location once it knows the id. Storing
// here would race with the destination directory not existing yet.
const tmpStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const tmp = path.join(UPLOAD_DIR, ".tmp");
    try {
      await fs.mkdir(tmp, { recursive: true });
      cb(null, tmp);
    } catch (err) {
      cb(err as Error, tmp);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME.has(file.mimetype);
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return cb(
      new HttpError(
        415,
        `Unsupported file type: ${file.mimetype || ext || "unknown"}. Allowed: CSV, TSV, JSON, TXT.`,
      ),
    );
  }
  cb(null, true);
}

export const upload = multer({
  storage: tmpStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter,
});

// Move a multer temp upload into its final per-user/per-dataset directory.
// Always join against `UPLOAD_DIR` and verify the canonical destination is
// still inside it so a crafted `originalname` (e.g. `../../etc/passwd`) can
// never escape the upload root.
export async function moveToFinalLocation(
  tempPath: string,
  userId: string,
  datasetId: string,
  originalName: string,
): Promise<{ absolutePath: string; relativePath: string }> {
  assertSafeIdSegment(userId, "userId");
  assertSafeIdSegment(datasetId, "datasetId");
  const safeBasename = path.basename(originalName).replace(/[^A-Za-z0-9._-]/g, "_");
  const destDir = path.join(UPLOAD_DIR, userId, datasetId);
  const destAbs = path.join(destDir, safeBasename);
  const resolved = path.resolve(destAbs);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    throw new HttpError(400, "Resolved upload path escapes the upload directory");
  }
  await fs.mkdir(destDir, { recursive: true });
  await fs.rename(tempPath, resolved);
  return { absolutePath: resolved, relativePath: path.relative(UPLOAD_DIR, resolved) };
}

function assertSafeIdSegment(id: string, label: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new HttpError(400, `Invalid ${label}: ${id}`);
  }
}

export async function deleteUploadFile(relativePath: string): Promise<void> {
  // Trust nothing about a path coming back from the DB — re-resolve and verify
  // it points inside UPLOAD_DIR before unlinking.
  const abs = path.resolve(UPLOAD_DIR, relativePath);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return;
  await fs.unlink(abs).catch(() => {});
}

export function resolveUploadPath(relativePath: string): string {
  const abs = path.resolve(UPLOAD_DIR, relativePath);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) {
    throw new HttpError(400, "Path escapes the upload directory");
  }
  return abs;
}
