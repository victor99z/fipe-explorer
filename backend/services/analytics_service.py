from typing import Dict, Any, Optional
from fastapi import HTTPException
from backend.repositories.analytics_repository import AnalyticsRepository
from backend.domain.calculations import (
    format_currency,
    calculate_percentage_variation,
    calculate_cagr,
    determine_trend
)

class AnalyticsService:
    """Service layer coordinating market analytics, devaluation rankings, and history computations."""

    def __init__(self, repository: Optional[AnalyticsRepository] = None):
        self.repo = repository or AnalyticsRepository()

    def get_analytics(
        self,
        tipo_veiculo: str = "carro",
        preco_min: Optional[float] = None,
        preco_max: Optional[float] = None,
        ano_min: Optional[int] = None,
        ano_max: Optional[int] = None,
        marca: Optional[str] = None,
        marcas: Optional[str] = None,
        combustivel: Optional[str] = None,
        motorizacao: Optional[str] = "todos",
        cambio: Optional[str] = "todos",
        litragem: Optional[str] = "todos",
        search: Optional[str] = None,
        groupby: str = "ano",
        fipe_anos: Optional[str] = None
    ) -> Dict[str, Any]:
        data = self.repo.get_analytics(
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

        total_found = data["total_encontrados"]
        if total_found == 0:
            return {
                "total_encontrados": 0,
                "metricas": {},
                "top_desvalorizados": [],
                "top_valorizados": [],
                "serie_mensal_segmento": [],
                "comparativo_modelos": []
            }

        precos = data["precos"]
        variacoes = data["variacoes"]
        preco_medio = sum(precos) / len(precos) if precos else 0.0
        variacao_media = sum(variacoes) / len(variacoes) if variacoes else 0.0

        metricas = {
            "total_modelos": total_found,
            "preco_medio": round(preco_medio, 2),
            "preco_medio_formatado": format_currency(preco_medio),
            "variacao_media_pct": round(variacao_media, 2),
            "maior_desvalorizacao_pct": min(variacoes) if variacoes else 0,
            "maior_valorizacao_pct": max(variacoes) if variacoes else 0
        }

        top_desvalorizados = []
        for r in data["top_desvalorizados"]:
            top_desvalorizados.append({
                "codigo_fipe": r[0],
                "nome_marca": r[1],
                "nome_modelo": r[2],
                "ano_modelo": int(r[3]),
                "valor_inicial": r[4],
                "valor_inicial_formatado": format_currency(r[4]),
                "valor_atual": r[5],
                "valor_atual_formatado": format_currency(r[5]),
                "variacao_pct": r[6]
            })

        top_valorizados = []
        for r in data["top_valorizados"]:
            top_valorizados.append({
                "codigo_fipe": r[0],
                "nome_marca": r[1],
                "nome_modelo": r[2],
                "ano_modelo": int(r[3]),
                "valor_inicial": r[4],
                "valor_inicial_formatado": format_currency(r[4]),
                "valor_atual": r[5],
                "valor_atual_formatado": format_currency(r[5]),
                "variacao_pct": r[6]
            })

        serie_segmento = []
        if groupby == "ano":
            for r in data["serie_segmento_rows"]:
                ano = int(r[0])
                serie_segmento.append({
                    "periodo": str(ano),
                    "ano": ano,
                    "valor": r[1],
                    "valor_formatado": format_currency(r[1])
                })
        else:
            for r in data["serie_segmento_rows"]:
                ano = int(r[0])
                mes = int(r[1])
                serie_segmento.append({
                    "periodo": f"{mes:02d}/{ano}",
                    "ano": ano,
                    "mes": mes,
                    "valor": r[2],
                    "valor_formatado": format_currency(r[2])
                })

        return {
            "total_encontrados": total_found,
            "metricas": metricas,
            "top_desvalorizados": top_desvalorizados,
            "top_valorizados": top_valorizados,
            "serie_mensal_segmento": serie_segmento,
            "comparativo_modelos": data["comparativo_modelos"]
        }

    def get_history(
        self,
        tipo_veiculo: str = "carro",
        codigo_fipe: Optional[str] = None,
        search_term: Optional[str] = None,
        marca: Optional[str] = None,
        marcas: Optional[str] = None,
        modelo: Optional[str] = None,
        ano_modelo: Optional[int] = None,
        motorizacao: Optional[str] = "todos",
        cambio: Optional[str] = "todos",
        groupby: str = "ano",
        metrica_ano: str = "media"
    ) -> Dict[str, Any]:
        meta, df = self.repo.get_history(
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

        if not meta or meta[3] == 0:
            raise HTTPException(status_code=404, detail="Nenhum dado encontrado para os filtros selecionados")

        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="Sem dados para este filtro")

        nome_marca_found = meta[0]
        nome_modelo_found = meta[1] if not search_term else f"Pesquisa: {search_term}"
        codigo_fipe_found = meta[2] if codigo_fipe else "Múltiplos / Agrupados"
        total_rows = meta[3]

        series = []
        initial_val = float(df.iloc[0]["valor"])
        prev_val = initial_val

        for _, row in df.iterrows():
            val = float(row["valor"])
            val_min = float(row["valor_min"])
            val_max = float(row["valor_max"])
            ano = int(row["ano_referencia"])
            mes = int(row["mes_referencia"])

            periodo = f"{mes:02d}/{ano}" if groupby == "mes" else str(ano)

            variacao_periodo_rs = val - prev_val
            variacao_periodo_pct = calculate_percentage_variation(prev_val, val)
            variacao_acumulada_rs = val - initial_val
            variacao_acumulada_pct = calculate_percentage_variation(initial_val, val)

            series.append({
                "periodo": periodo,
                "ano_referencia": ano,
                "mes_referencia": mes,
                "valor": round(val, 2),
                "valor_formatado": format_currency(val),
                "valor_min": round(val_min, 2),
                "valor_max": round(val_max, 2),
                "variacao_periodo_rs": round(variacao_periodo_rs, 2),
                "variacao_periodo_pct": round(variacao_periodo_pct, 2),
                "variacao_acumulada_rs": round(variacao_acumulada_rs, 2),
                "variacao_acumulada_pct": round(variacao_acumulada_pct, 2),
            })
            prev_val = val

        val_atual = series[-1]["valor"]
        val_min_idx = min(series, key=lambda x: x["valor"])
        val_max_idx = max(series, key=lambda x: x["valor"])

        var_total_rs = val_atual - initial_val
        var_total_pct = calculate_percentage_variation(initial_val, val_atual)
        tendencia = determine_trend(var_total_pct)
        cagr_pct = calculate_cagr(initial_val, val_atual, len(series))

        return {
            "info": {
                "tipo_veiculo": tipo_veiculo,
                "nome_marca": nome_marca_found,
                "nome_modelo": nome_modelo_found,
                "codigo_fipe": codigo_fipe_found,
                "ano_modelo": ano_modelo,
                "total_registros_brutos": total_rows,
                "periodo_inicial": series[0]["periodo"],
                "periodo_final": series[-1]["periodo"]
            },
            "summary": {
                "valor_inicial": round(initial_val, 2),
                "valor_inicial_formatado": format_currency(initial_val),
                "data_inicial": series[0]["periodo"],
                "periodo_inicial": series[0]["periodo"],
                "valor_atual": round(val_atual, 2),
                "valor_atual_formatado": format_currency(val_atual),
                "data_atual": series[-1]["periodo"],
                "periodo_atual": series[-1]["periodo"],
                "valor_minimo": round(val_min_idx["valor"], 2),
                "valor_minimo_formatado": format_currency(val_min_idx["valor"]),
                "data_minimo": val_min_idx["periodo"],
                "valor_maximo": round(val_max_idx["valor"], 2),
                "valor_maximo_formatado": format_currency(val_max_idx["valor"]),
                "data_maximo": val_max_idx["periodo"],
                "variacao_total_rs": round(var_total_rs, 2),
                "variacao_total_rs_formatada": format_currency(var_total_rs),
                "variacao_total_pct": round(var_total_pct, 2),
                "variacao_pct": round(var_total_pct, 2),
                "tendencia": tendencia,
                "cagr_pct": round(cagr_pct, 2)
            },
            "series": series
        }
