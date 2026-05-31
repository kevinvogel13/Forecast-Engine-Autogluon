import pino from "pino";

// Pretty-print in dev for readability, JSON in production for log shipping.
// LOG_LEVEL overrides the default (info in prod, debug in dev) without code
// changes — 12-factor friendly.
const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.password_hash",
    ],
    censor: "[REDACTED]",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
      }
    : undefined,
});
