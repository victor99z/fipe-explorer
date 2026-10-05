from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from backend.core.config import settings
from backend.core.database import db_session
from backend.repositories.query_builder import SqlQueryBuilder

class AnalyticsRepository:
    """Data Access Layer for market analytics, devaluation rankings, and vehicle price history."""

    @staticmethod
    def get_analytics(
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
        where_clauses, base_params, price_clauses, price_params = SqlQueryBuilder.build_filter_clauses(
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
            search=search
        )

        where_sql = " AND ".join(where_clauses)
        price_where_sql = " AND ".join(price_clauses) if price_clauses else "1=1"
        all_params = base_params + price_params

        query_base = SqlQueryBuilder.build_current_vehicles_cte(where_sql, price_where_sql)

        with db_session() as con:
            vehicles = con.execute(f"SELECT valor, variacao_pct FROM ({query_base})", all_params).fetchall()
            total_found = len(vehicles)

            if total_found == 0:
                return {
                    "total_encontrados": 0,
                    "precos": [],
                    "variacoes": [],
                    "top_desvalorizados": [],
                    "top_valorizados": [],
                    "serie_segmento_rows": [],
                    "comparativo_modelos": []
                }

            precos = [v[0] for v in vehicles if v[0] is not None]
            variacoes = [v[1] for v in vehicles if v[1] is not None]

            # Top 5 Most Devalued
            top_desv_query = f"""
                WITH v AS ({query_base})
                SELECT codigo_fipe, nome_marca, nome_modelo, ano_modelo, valor_inicial, valor, variacao_pct
                FROM v
                ORDER BY variacao_pct ASC
                LIMIT 5
            """
            top_desv_res = con.execute(top_desv_query, all_params).fetchall()

            # Top 5 Least Devalued / Most Appreciated
            top_val_query = f"""
                WITH v AS ({query_base})
                SELECT codigo_fipe, nome_marca, nome_modelo, ano_modelo, valor_inicial, valor, variacao_pct
                FROM v
                ORDER BY variacao_pct DESC
                LIMIT 5
            """
            top_val_res = con.execute(top_val_query, all_params).fetchall()

            # Segment series (monthly vs annual)
            if groupby == "ano":
                annual_query = f"""
                    WITH v AS ({query_base})
                    SELECT 
                        p.ano_referencia,
                        ROUND(AVG(p.valor_centavos / 100.0), 2) as preco_medio
                    FROM '{settings.PARQUET_FILE}' p
                    JOIN v ON p.codigo_fipe = v.codigo_fipe AND CAST(p.ano_modelo AS INT) = v.ano_modelo
                    GROUP BY p.ano_referencia
                    ORDER BY p.ano_referencia ASC
                """
                serie_segmento_rows = con.execute(annual_query, all_params).fetchall()
            else:
                monthly_query = f"""
                    WITH v AS ({query_base})
                    SELECT 
                        p.ano_referencia,
                        p.mes_referencia,
                        ROUND(AVG(p.valor_centavos / 100.0), 2) as preco_medio
                    FROM '{settings.PARQUET_FILE}' p
                    JOIN v ON p.codigo_fipe = v.codigo_fipe AND CAST(p.ano_modelo AS INT) = v.ano_modelo
                    GROUP BY p.ano_referencia, p.mes_referencia
                    ORDER BY p.ano_referencia ASC, p.mes_referencia ASC
                """
                serie_segmento_rows = con.execute(monthly_query, all_params).fetchall()

            # Model comparisons
            selected_models: List[Dict[str, Any]] = []
            if fipe_anos and isinstance(fipe_anos, str):
                pairs = [p.strip() for p in fipe_anos.split(",") if p.strip()]
                for pair in pairs[:3]:
                    if ":" in pair:
                        fipe_code, ano_str = pair.split(":", 1)
                        try:
                            ano_val = int(ano_str)
                            m_info = con.execute(f"""
                                SELECT nome_marca, nome_modelo,
                                       FIRST_VALUE(valor_centavos / 100.0) OVER (PARTITION BY codigo_fipe, ano_modelo ORDER BY ano_referencia ASC, mes_referencia ASC) as v_ini,
                                       LAST_VALUE(valor_centavos / 100.0) OVER (PARTITION BY codigo_fipe, ano_modelo ORDER BY ano_referencia ASC, mes_referencia ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as v_fim
                                FROM '{settings.PARQUET_FILE}'
                                WHERE codigo_fipe = ? AND CAST(ano_modelo AS INT) = ?
                                LIMIT 1
                            """, [fipe_code, ano_val]).fetchone()
                            if m_info:
                                v_ini = m_info[2] or 0
                                v_fim = m_info[3] or 0
                                var_pct = round(((v_fim - v_ini) / v_ini) * 100.0, 2) if v_ini > 0 else 0.0
                                selected_models.append({
                                    "codigo_fipe": fipe_code,
                                    "ano_modelo": ano_val,
                                    "nome_marca": m_info[0],
                                    "nome_modelo": m_info[1],
                                    "variacao_pct": var_pct
                                })
                        except ValueError:
                            pass

            if not selected_models:
                top_models_to_chart = top_desv_res[:2] + top_val_res[:2]
                seen = set()
                for m in top_models_to_chart:
                    key = f"{m[0]}_{m[3]}"
                    if key not in seen:
                        seen.add(key)
                        selected_models.append({
                            "codigo_fipe": m[0],
                            "nome_marca": m[1],
                            "nome_modelo": m[2],
                            "ano_modelo": int(m[3]),
                            "variacao_pct": m[6]
                        })
                selected_models = selected_models[:3]

            comparativo_modelos = []
            for m in selected_models[:4]:
                if groupby == "ano":
                    model_query = f"""
                        SELECT 
                            ano_referencia,
                            ROUND(AVG(valor_centavos / 100.0), 2) as valor
                        FROM '{settings.PARQUET_FILE}'
                        WHERE codigo_fipe = ? AND CAST(ano_modelo AS INT) = ?
                        GROUP BY ano_referencia
                        ORDER BY ano_referencia ASC
                    """
                    m_res = con.execute(model_query, [m['codigo_fipe'], m['ano_modelo']]).fetchall()
                    points = [{"periodo": str(int(r[0])), "valor": r[1]} for r in m_res]
                else:
                    model_query = f"""
                        SELECT 
                            ano_referencia,
                            mes_referencia,
                            ROUND(valor_centavos / 100.0, 2) as valor
                        FROM '{settings.PARQUET_FILE}'
                        WHERE codigo_fipe = ? AND CAST(ano_modelo AS INT) = ?
                        ORDER BY ano_referencia ASC, mes_referencia ASC
                    """
                    m_res = con.execute(model_query, [m['codigo_fipe'], m['ano_modelo']]).fetchall()
                    points = [{"periodo": f"{int(r[1]):02d}/{int(r[0])}", "valor": r[2]} for r in m_res]

                comparativo_modelos.append({
                    "codigo_fipe": m['codigo_fipe'],
                    "nome_modelo": f"{m['nome_marca']} {m['nome_modelo']} ({m['ano_modelo']})",
                    "variacao_pct": m['variacao_pct'],
                    "pontos": points
                })

        return {
            "total_encontrados": total_found,
            "precos": precos,
            "variacoes": variacoes,
            "top_desvalorizados": top_desv_res,
            "top_valorizados": top_val_res,
            "serie_segmento_rows": serie_segmento_rows,
            "comparativo_modelos": comparativo_modelos
        }

    @staticmethod
    def get_history(
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
    ) -> Tuple[Optional[Tuple], Optional[pd.DataFrame]]:
        where_clauses, params, _, _ = SqlQueryBuilder.build_filter_clauses(
            tipo_veiculo=tipo_veiculo,
            marca=marca,
            marcas=marcas,
            modelo=modelo,
            ano_modelo=ano_modelo,
            motorizacao=motorizacao,
            cambio=cambio,
            search=search_term,
            codigo_fipe=codigo_fipe,
            exclusive_search=True
        )

        where_sql = " AND ".join(where_clauses)

        with db_session() as con:
            meta = con.execute(f"""
                SELECT 
                    MIN(nome_marca), 
                    MIN(nome_modelo), 
                    MIN(codigo_fipe),
                    COUNT(*) as total_rows
                FROM '{settings.PARQUET_FILE}'
                WHERE {where_sql}
            """, params).fetchone()

            if not meta or meta[3] == 0:
                return None, None

            if groupby == "mes":
                query = f"""
                    SELECT 
                        ano_referencia,
                        mes_referencia,
                        AVG(valor_centavos) / 100.0 as valor,
                        MIN(valor_centavos) / 100.0 as valor_min,
                        MAX(valor_centavos) / 100.0 as valor_max,
                        COUNT(*) as count
                    FROM '{settings.PARQUET_FILE}'
                    WHERE {where_sql}
                    GROUP BY ano_referencia, mes_referencia
                    ORDER BY ano_referencia ASC, mes_referencia ASC
                """
            else:
                if metrica_ano == "fechamento":
                    query = f"""
                        WITH ranked AS (
                            SELECT 
                                ano_referencia,
                                mes_referencia,
                                valor_centavos,
                                ROW_NUMBER() OVER (PARTITION BY ano_referencia ORDER BY mes_referencia DESC) as rn
                            FROM '{settings.PARQUET_FILE}'
                            WHERE {where_sql}
                        )
                        SELECT 
                            ano_referencia,
                            12 as mes_referencia,
                            AVG(valor_centavos) / 100.0 as valor,
                            MIN(valor_centavos) / 100.0 as valor_min,
                            MAX(valor_centavos) / 100.0 as valor_max,
                            COUNT(*) as count
                        FROM ranked
                        WHERE rn = 1
                        GROUP BY ano_referencia
                        ORDER BY ano_referencia ASC
                    """
                elif metrica_ano == "max":
                    query = f"""
                        SELECT 
                            ano_referencia,
                            1 as mes_referencia,
                            MAX(valor_centavos) / 100.0 as valor,
                            MIN(valor_centavos) / 100.0 as valor_min,
                            MAX(valor_centavos) / 100.0 as valor_max,
                            COUNT(*) as count
                        FROM '{settings.PARQUET_FILE}'
                        WHERE {where_sql}
                        GROUP BY ano_referencia
                        ORDER BY ano_referencia ASC
                    """
                elif metrica_ano == "min":
                    query = f"""
                        SELECT 
                            ano_referencia,
                            1 as mes_referencia,
                            MIN(valor_centavos) / 100.0 as valor,
                            MIN(valor_centavos) / 100.0 as valor_min,
                            MAX(valor_centavos) / 100.0 as valor_max,
                            COUNT(*) as count
                        FROM '{settings.PARQUET_FILE}'
                        WHERE {where_sql}
                        GROUP BY ano_referencia
                        ORDER BY ano_referencia ASC
                    """
                else:  # media
                    query = f"""
                        SELECT 
                            ano_referencia,
                            1 as mes_referencia,
                            AVG(valor_centavos) / 100.0 as valor,
                            MIN(valor_centavos) / 100.0 as valor_min,
                            MAX(valor_centavos) / 100.0 as valor_max,
                            COUNT(*) as count
                        FROM '{settings.PARQUET_FILE}'
                        WHERE {where_sql}
                        GROUP BY ano_referencia
                        ORDER BY ano_referencia ASC
                    """

            df = con.execute(query, params).df()

        return meta, df
