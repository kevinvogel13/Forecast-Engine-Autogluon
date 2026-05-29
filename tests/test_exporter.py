"""Tests for the self-contained pipeline code exporter."""
import re

import pytest

from engine.exporter import build_export, slugify, prune_to_forecast, VENDOR_PKG


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


# ── Pruning: export only the forecast-producing lineage ──────────────────────

def _ids(pruned):
    return {n["id"] for n in pruned["nodes"]}


def test_prune_drops_eda_nodes_and_their_branches():
    # src -> filter -> model ; src -> exploration ; src -> prep_for_eda -> report
    pipeline = {
        "nodes": [
            {"id": "src", "data": {"type": "data_source"}},
            {"id": "flt", "data": {"type": "filter"}},
            {"id": "cfg", "data": {"type": "config"}},
            {"id": "out", "data": {"type": "output"}},
            {"id": "eda", "data": {"type": "exploration"}},
            {"id": "prep_eda", "data": {"type": "fillMissing"}},
            {"id": "rpt", "data": {"type": "report"}},
            {"id": "note", "data": {"type": "comment"}},
        ],
        "edges": [
            {"source": "src", "target": "flt"},
            {"source": "flt", "target": "cfg"},
            {"source": "cfg", "target": "out"},
            {"source": "src", "target": "eda"},
            {"source": "src", "target": "prep_eda"},
            {"source": "prep_eda", "target": "rpt"},
        ],
    }
    pruned = prune_to_forecast(pipeline)
    # keep the data->prep->model->output lineage
    assert _ids(pruned) == {"src", "flt", "cfg", "out"}
    # edges only between kept nodes
    assert all(e["source"] in _ids(pruned) and e["target"] in _ids(pruned) for e in pruned["edges"])


def test_prune_keeps_prep_shared_with_model():
    # A prep node that feeds BOTH the model and an EDA node must be kept.
    pipeline = {
        "nodes": [
            {"id": "src", "data": {"type": "input"}},
            {"id": "prep", "data": {"type": "outlierTreatment"}},
            {"id": "cfg", "data": {"type": "model_config"}},
            {"id": "val", "data": {"type": "validation"}},
        ],
        "edges": [
            {"source": "src", "target": "prep"},
            {"source": "prep", "target": "cfg"},
            {"source": "prep", "target": "val"},
        ],
    }
    pruned = prune_to_forecast(pipeline)
    assert _ids(pruned) == {"src", "prep", "cfg"}


def test_prune_noop_without_model():
    pipeline = {
        "nodes": [{"id": "src", "data": {"type": "input"}}, {"id": "eda", "data": {"type": "exploration"}}],
        "edges": [{"source": "src", "target": "eda"}],
    }
    pruned = prune_to_forecast(pipeline)
    assert _ids(pruned) == {"src", "eda"}  # unchanged: nothing forecasting-specific to isolate


def test_export_excludes_eda_from_pipeline_json():
    import json
    pipeline = {
        "nodes": [
            {"id": "src", "data": {"type": "data_source"}},
            {"id": "cfg", "data": {"type": "config"}},
            {"id": "eda", "data": {"type": "exploration"}},
        ],
        "edges": [{"source": "src", "target": "cfg"}, {"source": "src", "target": "eda"}],
    }
    files = {f.split("/", 1)[1]: c for f, c in build_export(pipeline, "x")}
    pj = json.loads(files["pipeline.json"].decode())
    types = {(n["data"]["type"]) for n in pj["nodes"]}
    assert "exploration" not in types
    assert types == {"data_source", "config"}
