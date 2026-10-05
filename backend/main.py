from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.core.rate_limit import RateLimitAndSecurityMiddleware
from backend.api.v1.router import api_v1_router

def create_app() -> FastAPI:
    """FastAPI application factory configuring security, middlewares, and routes."""
    app = FastAPI(
        title="FIPEX Explorer API",
        description="High-performance historical automotive price analytics powered by DuckDB & Parquet",
        version="2.0.0"
    )

    # Security & Rate Limiting
    app.add_middleware(RateLimitAndSecurityMiddleware)

    # CORS Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Root status endpoint
    @app.get("/", tags=["Sistema"], summary="Status e Metadados do Serviço")
    def root():
        return {
            "service": "FIPEX Explorer API",
            "status": "online",
            "protection": {
                "rate_limit_enabled": settings.RATE_LIMIT_ENABLED,
                "rate_limit_per_minute": settings.RATE_LIMIT_PER_MINUTE,
                "rate_limit_burst": settings.RATE_LIMIT_BURST,
                "max_concurrent_queries": settings.MAX_CONCURRENT_QUERIES,
                "max_duckdb_memory": settings.DUCKDB_MAX_MEMORY
            },
            "frontend": "http://localhost:3000",
            "endpoints": {
                "health": "/api/health",
                "presets": "/api/presets",
                "search": "/api/search/by-price",
                "history": "/api/history",
                "brands": "/api/filters/brands",
                "engine_sizes": "/api/filters/engine-sizes"
            }
        }

    # Mount API v1 router
    app.include_router(api_v1_router)

    return app

app = create_app()
