import os
import shutil
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
        self.base_path = base_path or cfg['STORAGE_PATH']
        os.makedirs(self.base_path, exist_ok=True)
    
    def _resolve(self, path: str) -> str:
        if os.path.isabs(path):
            return path
        return os.path.join(self.base_path, path)
    
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
        return os.path.exists(self._resolve(path))
    
    def list_files(self, directory: str) -> list[str]:
        full_path = self._resolve(directory)
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
