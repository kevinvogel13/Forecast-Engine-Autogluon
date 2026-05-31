# Multi-stage build for the forecast-engine app.
#
# Stage 1 ("web-build") compiles the React client and bundles the
# express server with esbuild. Output: /app/dist.
# Stage 2 ("runtime") is debian-slim with Node 20 and Python 3.11
# installed, the bundled app copied in, and python deps installed via
# pip from pyproject.toml.

# ── Stage 1: build the TS/React app ───────────────────────────────────
FROM node:20-bookworm-slim AS web-build
WORKDIR /app

# Install deps. Use a deterministic install (npm ci) and skip optional
# native modules we don't need in CI.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source and build.
COPY tsconfig.json drizzle.config.ts vite.config.ts vite-plugin-meta-images.ts postcss.config.js components.json ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY db ./db
COPY script ./script
RUN npm run build

# Drop dev deps so the final image only carries the runtime set.
RUN npm prune --omit=dev


# ── Stage 2: runtime ──────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Python 3.11 + minimal build tools for pip wheels that need them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# A non-root user. Uploads and the sandbox tmpdir live under /data,
# which the user owns so multer's writes and the sandbox's mkdtemp
# both work without sudo.
RUN useradd --system --create-home --shell /bin/bash --uid 1001 app \
 && mkdir -p /data/uploads /data/storage \
 && chown -R app:app /data /app

# Python deps. Install the engine itself + the small set the sandbox
# touches (pandas/numpy/duckdb/pyarrow). The heavy ML extras from
# pyproject are left out by default — add them to `[project] dependencies`
# if you need them and rebuild.
COPY pyproject.toml uv.lock ./
RUN pip install --break-system-packages --no-cache-dir \
      pandas duckdb pyarrow numpy scikit-learn scipy

# App bundle from stage 1.
COPY --from=web-build /app/dist ./dist
COPY --from=web-build /app/node_modules ./node_modules
COPY --from=web-build /app/package.json ./package.json
COPY engine ./engine

USER app
ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=/data/uploads \
    STORAGE_PATH=/data/uploads \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 5000

# Healthcheck pokes the root path; M9 introduces a dedicated /api/health
# that this can be re-pointed to.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.cjs"]
