from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class RankedVehicleItem(BaseModel):
    codigo_fipe: str
    nome_marca: str
    nome_modelo: str
    ano_modelo: int
    valor_inicial: float
    valor_inicial_formatado: str
    valor_atual: float
    valor_atual_formatado: str
    variacao_pct: float

class SegmentPoint(BaseModel):
    periodo: str
    ano_referencia: int
    mes_referencia: int
    valor_medio: float
    valor_medio_formatado: str
    total_veiculos: int

class ModelComparisonPoint(BaseModel):
    periodo: str
    valor: float

class ModelComparisonItem(BaseModel):
    codigo_fipe: str
    nome_modelo: str
    variacao_pct: float
    pontos: List[Dict[str, Any]]

class AnalyticsResponse(BaseModel):
    total_encontrados: int
    metricas: Dict[str, Any]
    top_desvalorizados: List[RankedVehicleItem]
    top_valorizados: List[RankedVehicleItem]
    serie_mensal_segmento: List[Dict[str, Any]]
    comparativo_modelos: List[Dict[str, Any]]
