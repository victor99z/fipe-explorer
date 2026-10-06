import os
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from backend.core.config import settings
from backend.core.database import check_is_enriched, IS_ENRICHED
from backend.services.vehicle_service import VehicleService
from backend.api.deps import get_vehicle_service

router = APIRouter()

@router.get("/health", include_in_schema=False)
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

@router.post("/internal/refresh", include_in_schema=False)
def refresh_dataset(
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    vehicle_service: VehicleService = Depends(get_vehicle_service)
):
    # Proteção de acesso administrativo interno
    if settings.INTERNAL_API_KEY and x_internal_token != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado: endpoint de uso exclusivamente interno do sistema."
        )

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

