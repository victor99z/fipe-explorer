from typing import Optional, List
from fastapi import APIRouter, Query, Depends
from backend.services.filter_service import FilterService
from backend.api.deps import get_filter_service

router = APIRouter(prefix="/filters", tags=["Filters"])

@router.get("/brands", response_model=List[str])
def get_brands(
    tipo_veiculo: str = Query("carro", description="carro, moto ou caminhao"),
    service: FilterService = Depends(get_filter_service)
):
    return service.get_brands(tipo_veiculo=tipo_veiculo)

@router.get("/models", response_model=List[str])
def get_models(
    tipo_veiculo: str = Query("carro", description="carro, moto ou caminhao"),
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    service: FilterService = Depends(get_filter_service)
):
    return service.get_models(tipo_veiculo=tipo_veiculo, marcas=marcas)

@router.get("/years", response_model=List[int])
def get_years(
    tipo_veiculo: str = Query("carro", description="carro, moto ou caminhao"),
    codigo_fipe: Optional[str] = Query(None, description="Código FIPE específico"),
    marca: Optional[str] = Query(None, description="Marca do veículo"),
    modelo: Optional[str] = Query(None, description="Modelo do veículo"),
    service: FilterService = Depends(get_filter_service)
):
    return service.get_years(
        tipo_veiculo=tipo_veiculo,
        codigo_fipe=codigo_fipe,
        marca=marca,
        modelo=modelo
    )

@router.get("/engine-sizes", response_model=List[str])
def get_engine_sizes(
    tipo_veiculo: str = Query("carro", description="carro, moto ou caminhao"),
    service: FilterService = Depends(get_filter_service)
):
    return service.get_engine_sizes(tipo_veiculo=tipo_veiculo)
