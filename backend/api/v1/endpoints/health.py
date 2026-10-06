import os
from fastapi import APIRouter, HTTPException, Depends
from backend.core.config import settings
from backend.core.database import IS_ENRICHED
from backend.services.vehicle_service import VehicleService
from backend.api.deps import get_vehicle_service

router = APIRouter(tags=["Sistema"])

@router.get("/health")
def health_check(vehicle_service: VehicleService = Depends(get_vehicle_service)):
    if not os.path.exists(settings.PARQUET_FILE):
        raise HTTPException(status_code=500, detail="Parquet file not found")

    count = vehicle_service.get_total_records()
    return {
        "status": "ok",
        "total_records": count,
        "is_enriched": IS_ENRICHED
    }

@router.post("/internal/refresh", summary="Invalida caches em memória e recarrega dataset")
def refresh_dataset(vehicle_service: VehicleService = Depends(get_vehicle_service)):
    from backend.core.cache import cache_store
    cache_store.clear()
    settings.PARQUET_FILE = settings.resolve_parquet_file()
    count = vehicle_service.get_total_records()
    return {
        "status": "ok",
        "message": "Caches invalidados e dataset recarregado com sucesso",
        "total_records": count,
        "parquet_file": settings.PARQUET_FILE
    }

