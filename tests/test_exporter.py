"""Tests for the self-contained pipeline code exporter."""
import re

import pytest

from engine.exporter import build_export, slugify, VENDOR_PKG


PIPELINE = {
    "nodes": [
        {"id": "src", "data": {"type": "data_source", "label": "Source", "filepath": "sales.csv"}},
        {"id": "cfg", "data": {"type": "model_config", "label": "Model",
                               "cfgTargetVar": "sales", "cfgTimeCol": "date"}},
    ],
    "edges": [{"source": "src", "target": "cfg"}],
}


def _as_dict(name="My Forecast"):
    return {f.split("/", 1)[1]: content for f, content in build_export(PIPELINE, name)}


def test_slugify():
    assert slugify("My Forecast!") == "my_forecast"
    assert slugify("") == "forecast_pipeline"
    assert slugify("a -- b") == "a_b"


def test_export_contains_expected_layout():
    files = _as_dict()
    for expected in ("README.md", "requirements.txt", "run.py",
                     "databricks_notebook.py", "pipeline.json",
                     "data/.gitkeep", f"{VENDOR_PKG}/pipeline.py",
                     f"{VENDOR_PKG}/handlers/model_handler.py",
                     f"{VENDOR_PKG}/__init__.py"):
        assert expected in files, f"missing {expected}"


def test_top_level_dir_is_slug():
    paths = [f for f, _ in build_export(PIPELINE, "My Forecast")]
    assert all(p.startswith("my_forecast/") for p in paths)


def test_pipeline_json_roundtrips():
    import json
    files = _as_dict()
    pj = json.loads(files["pipeline.json"].decode())
    assert pj["name"] == "My Forecast"
    assert len(pj["nodes"]) == 2
    assert pj["edges"][0]["source"] == "src"


def test_vendored_engine_has_no_bare_engine_imports():
    # The whole point: the export must not depend on this repo's `engine` pkg.
    files = _as_dict()
    pat = re.compile(r"\b(from|import) engine\b")
    for path, content in files.items():
        if path.startswith(f"{VENDOR_PKG}/") and path.endswith(".py"):
            text = content.decode()
            assert not pat.search(text), f"{path} still imports the bare engine package"


def test_vendored_imports_rewritten_to_forecast_engine():
    files = _as_dict()
    reg = files[f"{VENDOR_PKG}/handlers/registry.py"].decode()
    assert f"import {VENDOR_PKG}.handlers.data_handlers" in reg
    model = files[f"{VENDOR_PKG}/handlers/model_handler.py"].decode()
    assert f"from {VENDOR_PKG} import metrics" in model


def test_vendored_modules_compile():
    # Every vendored module must be syntactically valid after rewriting.
    import ast
    files = _as_dict()
    for path, content in files.items():
        if path.startswith(f"{VENDOR_PKG}/") and path.endswith(".py"):
            ast.parse(content.decode(), filename=path)


def test_exporter_module_itself_not_vendored():
    files = _as_dict()
    assert f"{VENDOR_PKG}/exporter.py" not in files


def test_databricks_notebook_has_source_header():
    files = _as_dict()
    nb = files["databricks_notebook.py"].decode()
    assert nb.startswith("# Databricks notebook source")
    assert "# COMMAND ----------" in nb
