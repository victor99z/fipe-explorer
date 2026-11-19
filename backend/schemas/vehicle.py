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
    consumo_urbano_gasolina: Optional[float] = None
    consumo_rodoviario_gasolina: Optional[float] = None
    consumo_urbano_etanol: Optional[float] = None
    consumo_rodoviario_etanol: Optional[float] = None
    consumo_urbano_eletrico: Optional[float] = None
    consumo_rodoviario_eletrico: Optional[float] = None
    eficiencia_mj_km: Optional[float] = None
    autonomia_km: Optional[int] = None
    nota_pbe: Optional[str] = None
    match_consumo: Optional[str] = None

class VehicleSearchResponse(BaseModel):
    total_encontrados: int
    page: int
    total_paginas: int
    resumo_faixa: Dict[str, Any]
    resultados: List[VehicleItem]

class FipeMatchRequestItem(BaseModel):
    id: str
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    fuel: Optional[str] = None
    transmission: Optional[str] = None
    title: Optional[str] = None

class FipeMatchBatchRequest(BaseModel):
    items: List[FipeMatchRequestItem]

class FipeMatchResult(BaseModel):
    codigo_fipe: str
    nome_marca: str
    nome_modelo: str
    ano_modelo: int
    nome_combustivel: Optional[str] = None
    valor: float
    valor_formatado: str
    periodo_referencia: str
    confidence: float

class FipeMatchBatchResponse(BaseModel):
    dataset_available: bool
    matches: Dict[str, FipeMatchResult]
