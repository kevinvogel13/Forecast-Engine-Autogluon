"""Tests for the storage adapter's path-traversal defense.

The previous `_resolve` short-circuited on `os.path.isabs(path)` and
returned absolute paths verbatim, letting any caller read arbitrary
files. These tests pin that behavior closed.
"""
from __future__ import annotations

import os
import pytest

from engine.adapters.storage import LocalStorageAdapter


@pytest.fixture
def adapter(tmp_path) -> LocalStorageAdapter:
    return LocalStorageAdapter(base_path=str(tmp_path))


def test_read_write_inside_root(adapter: LocalStorageAdapter) -> None:
    adapter.write_file("hello.txt", b"hi")
    assert adapter.read_file("hello.txt") == b"hi"


def test_nested_directory_creation(adapter: LocalStorageAdapter) -> None:
    adapter.write_file("a/b/c.txt", b"nested")
    assert adapter.read_file("a/b/c.txt") == b"nested"


@pytest.mark.parametrize(
    "bad",
    [
        "../etc/passwd",
        "../../etc/passwd",
        "/etc/passwd",
        "a/../../etc/passwd",
        "sub/../../etc/passwd",
    ],
)
def test_traversal_rejected(adapter: LocalStorageAdapter, bad: str) -> None:
    with pytest.raises(PermissionError):
        adapter.read_file(bad)


def test_empty_path_rejected(adapter: LocalStorageAdapter) -> None:
    with pytest.raises(PermissionError):
        adapter.read_file("")


def test_null_byte_rejected(adapter: LocalStorageAdapter) -> None:
    with pytest.raises(PermissionError):
        adapter.read_file("foo\x00.txt")


def test_file_exists_returns_false_for_traversal(adapter: LocalStorageAdapter) -> None:
    # Should not raise, just return False so callers can use it as a
    # cheap guard.
    assert adapter.file_exists("../etc/passwd") is False


def test_list_files_outside_root_returns_empty(adapter: LocalStorageAdapter) -> None:
    assert adapter.list_files("..") == []


def test_symlink_escape_blocked(adapter: LocalStorageAdapter, tmp_path) -> None:
    """A symlink inside the root that points outside it must be
    refused — `_resolve` uses `realpath`, which resolves the link."""
    outside = tmp_path.parent / "outside.txt"
    outside.write_text("secret")
    try:
        link = tmp_path / "shortcut"
        os.symlink(outside, link)
        with pytest.raises(PermissionError):
            adapter.read_file("shortcut")
    finally:
        if outside.exists():
            outside.unlink()
