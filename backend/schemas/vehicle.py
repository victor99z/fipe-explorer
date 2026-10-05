from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class VehicleItem(BaseModel):
    codigo_fipe: str
    nome_marca: str
    nome_modelo: str
    ano_modelo: Optional[int] = None
    nome_combustivel: Optional[str] = None
    valor: float
    valor_formatado: str
    periodo_referencia: str
    valor_inicial: Optional[float] = None
    valor_inicial_formatado: Optional[str] = None
    variacao_pct: Optional[float] = None
    litragem: Optional[str] = None
    is_turbo: bool = False
    is_automatico: bool = False
    tipo_cambio: str = "Manual/Indefinido"

class VehicleSearchResponse(BaseModel):
    total_encontrados: int
    page: int
    total_paginas: int
    resumo_faixa: Dict[str, Any]
    resultados: List[VehicleItem]
