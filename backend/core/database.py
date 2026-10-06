import os
import threading
import duckdb
from fastapi import HTTPException
from backend.core.config import settings

# Concurrency semaphore for DuckDB query throttling
DB_SEMAPHORE = threading.BoundedSemaphore(settings.MAX_CONCURRENT_QUERIES)

# Detect if the parquet file has precomputed columns (is_turbo, is_automatico, litragem)
IS_ENRICHED = False

def check_is_enriched() -> bool:
    global IS_ENRICHED
    if not os.path.exists(settings.PARQUET_FILE):
        settings.PARQUET_FILE = settings.resolve_parquet_file()
    if os.path.exists(settings.PARQUET_FILE):
        try:
            _chk = duckdb.connect()
            _cols = [c[0] for c in _chk.execute(f"DESCRIBE SELECT * FROM '{settings.PARQUET_FILE}' LIMIT 1").fetchall()]
            IS_ENRICHED = "is_turbo" in _cols and "is_automatico" in _cols and "litragem" in _cols
            _chk.close()
        except Exception as _e:
            print(f"Aviso ao verificar colunas do parquet: {_e}")
    return IS_ENRICHED

if os.path.exists(settings.PARQUET_FILE):
    check_is_enriched()

class SafeDuckDBConnection:
    """
    DuckDB connection wrapper that:
    1. Bounds concurrency via DB_SEMAPHORE with timeout.
    2. Enforces max memory limit to avoid host OOM crashes.
    3. Caps worker threads to avoid CPU starvation.
    4. Guarantees connection and semaphore cleanup on close, exit, or GC deallocation.
    """
    def __init__(self, timeout: float = settings.QUERY_TIMEOUT_SECONDS):
        self._closed = True
        self._con = None
        if not os.path.exists(settings.PARQUET_FILE):
            settings.PARQUET_FILE = settings.resolve_parquet_file()
            if not os.path.exists(settings.PARQUET_FILE):
                raise HTTPException(
                    status_code=503,
                    detail="O dataset da Tabela FIPE está sendo baixado e inicializado pela primeira vez. Por favor, aguarde alguns instantes e atualize a página."
                )
        acquired = DB_SEMAPHORE.acquire(timeout=timeout)
        if not acquired:
            raise HTTPException(
                status_code=503,
                detail="Servidor com alta demanda no momento. Por favor, tente novamente em instantes."
            )
        self._con = duckdb.connect()
        self._con.execute(f"SET max_memory = '{settings.DUCKDB_MAX_MEMORY}';")
        self._con.execute(f"SET threads TO {settings.DUCKDB_THREADS};")
        self._closed = False

    def close(self):
        if not self._closed:
            self._closed = True
            if self._con is not None:
                try:
                    self._con.close()
                except Exception:
                    pass
            DB_SEMAPHORE.release()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        self.close()

    def __getattr__(self, name):
        if "_con" in self.__dict__ and self._con is not None:
            return getattr(self._con, name)
        raise AttributeError(name)

def get_db(timeout: float = settings.QUERY_TIMEOUT_SECONDS) -> SafeDuckDBConnection:
    return SafeDuckDBConnection(timeout=timeout)

def db_session(timeout: float = settings.QUERY_TIMEOUT_SECONDS) -> SafeDuckDBConnection:
    return SafeDuckDBConnection(timeout=timeout)
