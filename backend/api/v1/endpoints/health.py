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
