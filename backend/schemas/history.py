from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class HistoryPoint(BaseModel):
    periodo: str
    ano_referencia: int
    mes_referencia: int
    valor: float
    valor_formatado: str
    valor_min: float
    valor_max: float
    variacao_periodo_rs: float
    variacao_periodo_pct: float
    variacao_acumulada_rs: float
    variacao_acumulada_pct: float

class HistorySummary(BaseModel):
    valor_inicial: float
    valor_inicial_formatado: str
    data_inicial: str
    periodo_inicial: str
    valor_atual: float
    valor_atual_formatado: str
    data_atual: str
    periodo_atual: str
    valor_minimo: float
    valor_minimo_formatado: str
    data_minimo: str
    valor_maximo: float
    valor_maximo_formatado: str
    data_maximo: str
    variacao_total_rs: float
    variacao_total_rs_formatada: str
    variacao_total_pct: float
    variacao_pct: float
    tendencia: str
    cagr_pct: float

class HistoryInfo(BaseModel):
    tipo_veiculo: str
    nome_marca: str
    nome_modelo: str
    codigo_fipe: str
    ano_modelo: Optional[int] = None
    total_registros_brutos: int
    periodo_inicial: str
    periodo_final: str

class HistoryResponse(BaseModel):
    info: HistoryInfo
    summary: HistorySummary
    series: List[HistoryPoint]
