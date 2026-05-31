import os
from abc import ABC, abstractmethod
from typing import Optional
from engine.config import get_config


class StorageAdapter(ABC):
    @abstractmethod
    def read_file(self, path: str) -> bytes:
        pass

    @abstractmethod
    def write_file(self, path: str, data: bytes) -> str:
        pass

    @abstractmethod
    def file_exists(self, path: str) -> bool:
        pass

    @abstractmethod
    def list_files(self, directory: str) -> list[str]:
        pass

    @abstractmethod
    def get_full_path(self, relative_path: str) -> str:
        pass


class LocalStorageAdapter(StorageAdapter):
    def __init__(self, base_path: Optional[str] = None):
        cfg = get_config()
        self.base_path = os.path.realpath(base_path or cfg['STORAGE_PATH'])
        os.makedirs(self.base_path, exist_ok=True)

    def _resolve(self, path: str) -> str:
        """Join `path` onto `base_path` and verify the canonical result is
        still inside `base_path`. Rejects `..` traversal and absolute paths
        that escape the storage root. The previous implementation short-
        circuited on `os.path.isabs(path)` and returned the absolute path
        verbatim, letting any caller read arbitrary files (CVE-class bug).
        """
        if not path:
            raise PermissionError("Empty path")
        if path.startswith('\x00') or '\x00' in path:
            raise PermissionError("Null byte in path")
        # Resolve relative to base_path. realpath collapses .. and follows
        # symlinks so we compare apples to apples.
        candidate = os.path.realpath(os.path.join(self.base_path, path))
        base_with_sep = self.base_path.rstrip(os.sep) + os.sep
        if candidate != self.base_path and not candidate.startswith(base_with_sep):
            raise PermissionError(f"Path escapes storage root: {path!r}")
        return candidate

    def read_file(self, path: str) -> bytes:
        full_path = self._resolve(path)
        with open(full_path, 'rb') as f:
            return f.read()

    def write_file(self, path: str, data: bytes) -> str:
        full_path = self._resolve(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'wb') as f:
            f.write(data)
        return full_path

    def file_exists(self, path: str) -> bool:
        try:
            return os.path.exists(self._resolve(path))
        except PermissionError:
            return False

    def list_files(self, directory: str) -> list[str]:
        try:
            full_path = self._resolve(directory) if directory else self.base_path
        except PermissionError:
            return []
        if not os.path.isdir(full_path):
            return []
        return os.listdir(full_path)

    def get_full_path(self, relative_path: str) -> str:
        return self._resolve(relative_path)


def create_storage_adapter() -> StorageAdapter:
    cfg = get_config()
    storage_type = cfg['STORAGE_TYPE']
    if storage_type == 'local':
        return LocalStorageAdapter()
    raise ValueError(f"Unsupported storage type: {storage_type}")
