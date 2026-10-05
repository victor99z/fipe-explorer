from fastapi import APIRouter
from backend.api.v1.endpoints import health, presets, filters, search, history

api_v1_router = APIRouter(prefix="/api")

api_v1_router.include_router(health.router)
api_v1_router.include_router(presets.router)
api_v1_router.include_router(filters.router)
api_v1_router.include_router(search.router)
api_v1_router.include_router(history.router)
