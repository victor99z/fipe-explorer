import os
from fastapi import APIRouter, Depends
from backend.core.config import settings
from backend.core.database import check_is_enriched, IS_ENRICHED
from backend.services.vehicle_service import VehicleService
from backend.api.deps import get_vehicle_service

router = APIRouter(tags=["Sistema"])

@router.get("/health")
def health_check(vehicle_service: VehicleService = Depends(get_vehicle_service)):
    # Reavalia o caminho caso o arquivo tenha sido baixado em background
    if not os.path.exists(settings.PARQUET_FILE):
        settings.PARQUET_FILE = settings.resolve_parquet_file()

    parquet_ready = os.path.exists(settings.PARQUET_FILE)
    if not parquet_ready:
        return {
            "status": "initializing",
            "ready": False,
            "message": "Dataset da Tabela FIPE ainda não disponível (em download/enriquecimento pelo updater)",
            "total_records": 0,
            "is_enriched": False
        }

    try:
        count = vehicle_service.get_total_records()
        enriched = check_is_enriched()
        return {
            "status": "ok",
            "ready": True,
            "total_records": count,
            "is_enriched": enriched
        }
    except Exception as e:
        return {
            "status": "initializing",
            "ready": False,
            "message": f"Dataset em inicialização: {str(e)}",
            "total_records": 0,
            "is_enriched": False
        }

@router.post("/internal/refresh", summary="Invalida caches em memória e recarrega dataset")
def refresh_dataset(vehicle_service: VehicleService = Depends(get_vehicle_service)):
    from backend.core.cache import cache_store
    cache_store.clear()
    settings.PARQUET_FILE = settings.resolve_parquet_file()
    enriched = check_is_enriched()
    count = vehicle_service.get_total_records() if os.path.exists(settings.PARQUET_FILE) else 0
    return {
        "status": "ok",
        "ready": os.path.exists(settings.PARQUET_FILE),
        "message": "Caches invalidados e dataset recarregado com sucesso",
        "total_records": count,
        "is_enriched": enriched,
        "parquet_file": settings.PARQUET_FILE
    }

