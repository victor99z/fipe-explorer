from typing import Optional
from fastapi import APIRouter, Query, Depends
from backend.services.analytics_service import AnalyticsService
from backend.api.deps import get_analytics_service

router = APIRouter(tags=["History"])

@router.get("/history")
def get_history(
    tipo_veiculo: str = "carro",
    codigo_fipe: Optional[str] = None,
    search_term: Optional[str] = None,
    marca: Optional[str] = None,
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    modelo: Optional[str] = None,
    ano_modelo: Optional[int] = None,
    motorizacao: Optional[str] = Query("todos", description="todos, turbo, aspirado"),
    cambio: Optional[str] = Query("todos", description="todos, automatico, manual"),
    groupby: str = "ano",  # 'ano' or 'mes'
    metrica_ano: str = "media",  # 'media', 'fechamento', 'max', 'min'
    service: AnalyticsService = Depends(get_analytics_service)
):
    return service.get_history(
        tipo_veiculo=tipo_veiculo,
        codigo_fipe=codigo_fipe,
        search_term=search_term,
        marca=marca,
        marcas=marcas,
        modelo=modelo,
        ano_modelo=ano_modelo,
        motorizacao=motorizacao,
        cambio=cambio,
        groupby=groupby,
        metrica_ano=metrica_ano
    )
