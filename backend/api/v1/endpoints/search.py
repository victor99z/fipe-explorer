from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Depends
from backend.services.vehicle_service import VehicleService
from backend.services.analytics_service import AnalyticsService
from backend.api.deps import get_vehicle_service, get_analytics_service

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/by-price")
def search_by_price(
    tipo_veiculo: str = "carro",
    preco_min: Optional[float] = Query(None, description="Preço mínimo em R$"),
    preco_max: Optional[float] = Query(None, description="Preço máximo em R$"),
    ano_min: Optional[int] = Query(None, description="Ano modelo mínimo"),
    ano_max: Optional[int] = Query(None, description="Ano modelo máximo"),
    marca: Optional[str] = None,
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    combustivel: Optional[str] = None,
    motorizacao: Optional[str] = Query("todos", description="todos, turbo, aspirado"),
    cambio: Optional[str] = Query("todos", description="todos, automatico, manual"),
    litragem: Optional[str] = Query("todos", description="todos, 1.0, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 2.0+"),
    search: Optional[str] = None,
    ordenacao: str = Query("preco_desc", description="preco_asc, preco_desc, ano_asc, ano_desc, desvalorizacao_asc, desvalorizacao_desc, modelo_asc"),
    page: int = Query(1, ge=1, le=1000, description="Página atual"),
    limit: int = Query(24, ge=1, le=100, description="Itens por página"),
    service: VehicleService = Depends(get_vehicle_service)
):
    return service.search_vehicles(
        tipo_veiculo=tipo_veiculo,
        preco_min=preco_min,
        preco_max=preco_max,
        ano_min=ano_min,
        ano_max=ano_max,
        marca=marca,
        marcas=marcas,
        combustivel=combustivel,
        motorizacao=motorizacao,
        cambio=cambio,
        litragem=litragem,
        search=search,
        ordenacao=ordenacao,
        page=page,
        limit=limit
    )

@router.get("/suggestions", response_model=List[Dict[str, Any]])
def get_suggestions(
    q: str = Query(..., min_length=2, description="Termo para autocomplete"),
    tipo_veiculo: str = Query("carro", description="carro, moto ou caminhao"),
    service: VehicleService = Depends(get_vehicle_service)
):
    return service.get_suggestions(q=q, tipo_veiculo=tipo_veiculo)

@router.get("/analytics")
def search_analytics(
    tipo_veiculo: str = "carro",
    preco_min: Optional[float] = Query(None, description="Preço mínimo em R$"),
    preco_max: Optional[float] = Query(None, description="Preço máximo em R$"),
    ano_min: Optional[int] = Query(None, description="Ano modelo mínimo"),
    ano_max: Optional[int] = Query(None, description="Ano modelo máximo"),
    marca: Optional[str] = None,
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    combustivel: Optional[str] = None,
    motorizacao: Optional[str] = Query("todos", description="todos, turbo, aspirado"),
    cambio: Optional[str] = Query("todos", description="todos, automatico, manual"),
    litragem: Optional[str] = Query("todos", description="todos, 1.0, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 2.0+"),
    groupby: str = Query("mes", description="groupby: mes ou ano"),
    fipe_anos: Optional[str] = Query(None, description="codigo_fipe:ano_modelo separados por virgula (max 3)"),
    search: Optional[str] = None,
    service: AnalyticsService = Depends(get_analytics_service)
):
    return service.get_analytics(
        tipo_veiculo=tipo_veiculo,
        preco_min=preco_min,
        preco_max=preco_max,
        ano_min=ano_min,
        ano_max=ano_max,
        marca=marca,
        marcas=marcas,
        combustivel=combustivel,
        motorizacao=motorizacao,
        cambio=cambio,
        litragem=litragem,
        search=search,
        groupby=groupby,
        fipe_anos=fipe_anos
    )
