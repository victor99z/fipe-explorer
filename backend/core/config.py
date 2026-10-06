import os
from typing import List

class Settings:
    PROJECT_NAME: str = "FIPE Parquet Explorer API"
    VERSION: str = "1.0.0"

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # Parquet Storage Path
    PARQUET_FILE: str = os.getenv("PARQUET_FILE", "data/fipex-prices-enriched.parquet")

    # DuckDB Resource Jail
    DUCKDB_MAX_MEMORY: str = os.getenv("DUCKDB_MAX_MEMORY", "1GB")
    MAX_DUCKDB_MEMORY: str = os.getenv("MAX_DUCKDB_MEMORY", "1GB")
    DUCKDB_THREADS: int = int(os.getenv("DUCKDB_THREADS", "2"))
    MAX_CONCURRENT_QUERIES: int = int(os.getenv("MAX_CONCURRENT_QUERIES", "6"))
    QUERY_TIMEOUT_SECONDS: float = float(os.getenv("QUERY_TIMEOUT_SECONDS", "5.0"))

    # Rate Limiting (DDoS Shield)
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "90"))
    RATE_LIMIT_BURST: int = int(os.getenv("RATE_LIMIT_BURST", "25"))

    # Caching
    CACHE_DEFAULT_TTL: float = float(os.getenv("CACHE_DEFAULT_TTL", "300.0"))

    # Internal Administrative Secret
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "fipex-internal-secret-token")

    def resolve_parquet_file(self) -> str:
        """Finds the enriched or base parquet file from known paths."""
        candidates: List[str] = [
            os.path.abspath(self.PARQUET_FILE),
            os.path.abspath("data/fipex-prices-enriched.parquet"),
            os.path.abspath("data/fipex-prices.parquet"),
            os.path.expanduser("~/Documents/workspace/fipe-dados/data/fipex-prices-enriched.parquet"),
            os.path.expanduser("~/Documents/workspace/fipe-dados/data/fipex-prices.parquet"),
            "/home/jub/Documents/workspace/fipe-dados/data/fipex-prices-enriched.parquet",
            "/home/jub/Documents/workspace/fipe-dados/data/fipex-prices.parquet"
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                return candidate
        return os.path.abspath(self.PARQUET_FILE)

settings = Settings()
settings.PARQUET_FILE = settings.resolve_parquet_file()
