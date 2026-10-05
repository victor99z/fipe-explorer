import time
import threading
from typing import Optional, Dict, Tuple, Any
from backend.core.config import settings

class TTLCache:
    """Thread-safe In-Memory Key-Value store with TTL and capacity bounds."""
    def __init__(self, default_ttl: float = settings.CACHE_DEFAULT_TTL, maxsize: int = 1500):
        self.default_ttl = default_ttl
        self.maxsize = maxsize
        self._store: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._store:
                val, expires_at = self._store[key]
                if time.time() < expires_at:
                    return val
                del self._store[key]
            return None

    def set(self, key: str, value: Any, ttl: Optional[float] = None, ttl_seconds: Optional[float] = None) -> None:
        with self._lock:
            now = time.time()
            if len(self._store) >= self.maxsize:
                # Evict expired items first
                expired = [k for k, (_, exp) in self._store.items() if exp <= now]
                for k in expired:
                    del self._store[k]
                # If still at capacity, evict oldest 15%
                if len(self._store) >= self.maxsize:
                    to_remove = list(self._store.keys())[:int(self.maxsize * 0.15) + 1]
                    for k in to_remove:
                        del self._store[k]
            duration = ttl_seconds if ttl_seconds is not None else (ttl if ttl is not None else self.default_ttl)
            exp = now + duration
            self._store[key] = (value, exp)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

cache_store = TTLCache()
