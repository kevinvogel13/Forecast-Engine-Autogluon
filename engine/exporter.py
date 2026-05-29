"""Export a pipeline as a self-contained, runnable Python project.

The in-app engine executes pipelines directly, but users often want to take a
pipeline *out* of the app — run it on Databricks, a scheduled job, or their own
cloud box — without depending on this repository or its web stack.

``build_export(pipeline, name)`` returns an ordered ``{relative_path: bytes}``
mapping describing a complete project folder:

    <slug>/
      README.md                  usage + Databricks instructions
      requirements.txt           runtime deps (pandas, autogluon, …)
      pipeline.json              the pipeline definition (data, not code)
      run.py                     CLI entrypoint: loads pipeline.json, runs it
      databricks_notebook.py     Databricks notebook-source version
      forecast_engine/           the engine, vendored & import-rewritten
        __init__.py
        … (every engine module, `engine.` → `forecast_engine.`)
      data/                      drop input CSVs here (placeholder)
        .gitkeep

The vendored engine is the *same* code the app runs, so exported results match
in-app results exactly — only the package name changes (``engine`` →
``forecast_engine``) so it stands alone. The server zips this mapping for
download.
"""
from __future__ import annotations

import json
import os
import re
from typing import Iterable

# Engine modules are vendored under this package name in the export so the
# output has no dependency on this repo's top-level ``engine`` package.
VENDOR_PKG = "forecast_engine"

_ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (name or "forecast_pipeline").lower()).strip("_")
    return slug or "forecast_pipeline"


def _rewrite_engine_imports(source: str) -> str:
    """Rewrite intra-engine imports so the vendored copy is self-contained.

    Handles both ``from engine...`` and ``import engine...`` forms. Word
    boundary + the two real prefixes keep this from touching unrelated text
    (e.g. the literal string 'engine' in a log message).
    """
    source = re.sub(r"\bfrom engine\b", f"from {VENDOR_PKG}", source)
    source = re.sub(r"\bimport engine\b", f"import {VENDOR_PKG}", source)
    return source


def _iter_engine_files() -> Iterable[tuple[str, str]]:
    """Yield (relative_path_under_package, source_text) for every engine .py,
    excluding caches and this exporter module itself (not needed at runtime)."""
    for root, dirs, files in os.walk(_ENGINE_DIR):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for fn in sorted(files):
            if not fn.endswith(".py"):
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, _ENGINE_DIR)
            if rel == "exporter.py":
                continue
            with open(full, "r", encoding="utf-8") as f:
                yield rel.replace(os.sep, "/"), f.read()


# ── Wrapper file templates ───────────────────────────────────────────────────

_REQUIREMENTS = """\
# Runtime dependencies for the exported forecast pipeline.
pandas>=2.0
numpy>=1.24
scipy>=1.10
scikit-learn>=1.3
duckdb>=0.9
holidays>=0.40
# AutoGluon is required for the model node. On Databricks, prefer a CPU build:
#   %pip install "autogluon.timeseries"
autogluon.timeseries>=1.0
"""

_RUN_PY = '''\
"""CLI entrypoint for the exported forecast pipeline.

Usage:
    python run.py [pipeline.json]

Reads the pipeline definition, executes it through the vendored engine, and
writes results to ./output/. Place input CSVs referenced by the Data Source
node(s) in ./data/ (or set STORAGE_PATH to wherever they live).
"""
import json
import os
import sys

from forecast_engine.pipeline import execute_pipeline


def main():
    pipeline_file = sys.argv[1] if len(sys.argv) > 1 else "pipeline.json"
    with open(pipeline_file, "r") as f:
        pipeline = json.load(f)

    # Default storage/model locations relative to this project; override via env.
    here = os.path.dirname(os.path.abspath(__file__))
    os.environ.setdefault("STORAGE_PATH", os.path.join(here, "data"))
    os.environ.setdefault("MODEL_PATH", os.path.join(here, "models"))

    result = execute_pipeline({"nodes": pipeline.get("nodes", []),
                               "edges": pipeline.get("edges", [])})

    out_dir = os.path.join(here, "output")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "result.json"), "w") as f:
        json.dump(result, f, indent=2, default=str)

    if not result.get("success"):
        print("Pipeline FAILED:", result.get("error"), file=sys.stderr)
        sys.exit(1)
    print("Pipeline complete. Results written to output/result.json")


if __name__ == "__main__":
    main()
'''

_DATABRICKS_HEADER = "# Databricks notebook source\n"
_DATABRICKS_CELL = "\n# COMMAND ----------\n\n"


def _databricks_notebook(slug: str) -> str:
    """A Databricks notebook-source .py: importable as a notebook, runs as a script."""
    cells = [
        _DATABRICKS_HEADER + (
            "# MAGIC %md\n"
            f"# MAGIC # {slug} — forecast pipeline\n"
            "# MAGIC Self-contained export. Run cells top to bottom. "
            "Upload input CSVs to the `data/` folder (or a DBFS/volume path) "
            "and set `STORAGE_PATH` accordingly."
        ),
        "# MAGIC %pip install \"autogluon.timeseries\" duckdb holidays\n"
        "# MAGIC %restart_python",
        "import json, os\n"
        "from forecast_engine.pipeline import execute_pipeline\n\n"
        "# Point STORAGE_PATH at the folder containing your input CSV(s).\n"
        "os.environ.setdefault('STORAGE_PATH', os.path.join(os.getcwd(), 'data'))\n"
        "os.environ.setdefault('MODEL_PATH', os.path.join(os.getcwd(), 'models'))",
        "with open('pipeline.json') as f:\n"
        "    pipeline = json.load(f)\n\n"
        "result = execute_pipeline({'nodes': pipeline['nodes'], 'edges': pipeline['edges']})\n"
        "assert result.get('success'), result.get('error')\n"
        "print('Pipeline complete')",
        "# Inspect results — forecast rows, backtest metrics, leaderboard, etc.\n"
        "for node_id, info in result['results'].items():\n"
        "    label = info.get('label', node_id)\n"
        "    keys = [k for k in info.keys() if k not in ('preview',)]\n"
        "    print(f'{label}: {keys}')",
    ]
    return _DATABRICKS_CELL.join(cells) + "\n"


def _readme(name: str, slug: str, pipeline: dict) -> str:
    n_nodes = len(pipeline.get("nodes", []))
    node_types = sorted({(n.get("data") or {}).get("type", "?") for n in pipeline.get("nodes", [])})
    return f"""\
# {name}

Self-contained export of a forecasting pipeline built with the visual editor.
It runs **without this app or repository** — the engine is vendored under
`{VENDOR_PKG}/` and your pipeline is saved as data in `pipeline.json`
({n_nodes} nodes: {", ".join(node_types)}).

## Layout

```
{slug}/
  README.md
  requirements.txt        runtime dependencies
  pipeline.json           your pipeline definition (data, not code)
  run.py                  CLI: python run.py
  databricks_notebook.py  import into Databricks as a notebook
  {VENDOR_PKG}/           the forecasting engine (self-contained)
  data/                   put your input CSV(s) here
```

## Run locally

```bash
pip install -r requirements.txt
# copy the CSV(s) your Data Source node references into ./data/
python run.py
# results -> output/result.json
```

## Run on Databricks

1. Upload this folder (or import `databricks_notebook.py` as a notebook).
2. Upload your input CSV(s) to `data/` (or a DBFS/Unity Catalog volume) and set
   the `STORAGE_PATH` env var to that location.
3. Run the notebook top to bottom. The first cell installs AutoGluon.

## Notes

- The model node requires `autogluon.timeseries`. On Databricks use a CPU
  cluster and `%pip install "autogluon.timeseries"`.
- Results match what the app produces — it's the same engine code.
"""


def build_export(pipeline: dict, name: str = "forecast_pipeline") -> "list[tuple[str, bytes]]":
    """Return an ordered list of (relative_path, content_bytes) for the project.

    A list (not a dict) so the zip preserves a sensible, deterministic order.
    """
    slug = slugify(name)
    files: list[tuple[str, bytes]] = []

    def add(path: str, text: str):
        files.append((f"{slug}/{path}", text.encode("utf-8")))

    # Wrapper / project scaffolding
    add("README.md", _readme(name, slug, pipeline))
    add("requirements.txt", _REQUIREMENTS)
    add("run.py", _RUN_PY)
    add("databricks_notebook.py", _databricks_notebook(slug))
    add("data/.gitkeep", "")
    add("pipeline.json", json.dumps({
        "name": name,
        "nodes": pipeline.get("nodes", []),
        "edges": pipeline.get("edges", []),
    }, indent=2))

    # Vendored engine, import-rewritten to forecast_engine.*
    for rel, source in _iter_engine_files():
        add(f"{VENDOR_PKG}/{rel}", _rewrite_engine_imports(source))

    return files


def build_zip_bytes(pipeline: dict, name: str = "forecast_pipeline") -> bytes:
    """Build the export and return it as a .zip archive (bytes)."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in build_export(pipeline, name):
            zf.writestr(path, content)
    return buf.getvalue()


def _main():
    """CLI: read a pipeline JSON from stdin, write the zip to stdout.

    Used by the server's export endpoint so zipping stays in Python (where the
    exporter and engine sources live) rather than adding a Node zip dependency.
    """
    import sys

    payload = json.loads(sys.stdin.read() or "{}")
    pipeline = {"nodes": payload.get("nodes", []), "edges": payload.get("edges", [])}
    name = payload.get("name", "forecast_pipeline")
    sys.stdout.buffer.write(build_zip_bytes(pipeline, name))


if __name__ == "__main__":
    _main()
