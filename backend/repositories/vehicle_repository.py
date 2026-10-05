from typing import List, Dict, Any, Tuple
from backend.core.config import settings
from backend.core.database import db_session, IS_ENRICHED
from backend.repositories.query_builder import SqlQueryBuilder
from backend.domain.calculations import format_currency
from backend.domain.vehicle_rules import determine_transmission_label, infer_specs_from_name

class VehicleRepository:
    """Data Access Layer for paginated vehicle search and fast autocomplete suggestions."""

    @staticmethod
    def count_total_records() -> int:
        with db_session() as con:
            return con.execute(f"SELECT COUNT(*) FROM '{settings.PARQUET_FILE}'").fetchone()[0]

    @staticmethod
    def get_suggestions(q: str, tipo_veiculo: str = "carro") -> List[Dict[str, Any]]:
        q_clean = q.strip()[:80]
        if len(q_clean) < 2:
            return []

        terms = q_clean.lower().split()
        like_clauses = []
        params = [tipo_veiculo]
        for term in terms[:5]:
            like_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
            params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])

        where_sql = f"tipo_veiculo = ? AND " + " AND ".join(like_clauses)

        with db_session() as con:
            res = con.execute(f"""
                SELECT 
                    codigo_fipe, 
                    nome_marca, 
                    nome_modelo, 
                    LIST(DISTINCT CAST(ano_modelo AS INT) ORDER BY CAST(ano_modelo AS INT) DESC) FILTER (WHERE ano_modelo IS NOT NULL AND ano_modelo > 1900) as anos
                FROM '{settings.PARQUET_FILE}'
                WHERE {where_sql}
                GROUP BY codigo_fipe, nome_marca, nome_modelo
                ORDER BY nome_marca, nome_modelo
                LIMIT 15
            """, params).fetchall()

        items = []
        for row in res:
            items.append({
                "codigo_fipe": row[0],
                "nome_marca": row[1],
                "nome_modelo": row[2],
                "anos": row[3] if row[3] else []
            })
        return items

    @staticmethod
    def search_vehicles(
        tipo_veiculo: str = "carro",
        preco_min: float = None,
        preco_max: float = None,
        ano_min: int = None,
        ano_max: int = None,
        marca: str = None,
        marcas: str = None,
        combustivel: str = None,
        motorizacao: str = "todos",
        cambio: str = "todos",
        litragem: str = "todos",
        search: str = None,
        ordenacao: str = "preco_desc",
        page: int = 1,
        limit: int = 24
    ) -> Tuple[int, List[Dict[str, Any]]]:
        # Enforce bounds
        page = max(1, min(page, 1000))
        limit = max(1, min(limit, 100))

        # Build reusable clauses via query builder
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

        # Ordering map
        order_map = {
            "preco_desc": "valor DESC",
            "preco_asc": "valor ASC",
            "ano_desc": "ano_modelo DESC, valor DESC",
            "ano_asc": "ano_modelo ASC, valor DESC",
            "variacao_desc": "variacao_pct DESC",
            "variacao_asc": "variacao_pct ASC",
            "desvalorizacao_desc": "variacao_pct ASC",
            "desvalorizacao_asc": "variacao_pct DESC",
            "modelo_asc": "nome_modelo ASC"
        }
        order_sql = order_map.get(ordenacao, "valor DESC")

        query_base = SqlQueryBuilder.build_current_vehicles_cte(where_sql, price_where_sql)

        with db_session() as con:
            count_query = f"SELECT COUNT(*) FROM ({query_base}) sub"
            total = con.execute(count_query, all_params).fetchone()[0]

            offset = (page - 1) * limit
            data_query = f"{query_base} ORDER BY {order_sql} LIMIT {limit} OFFSET {offset}"
            res = con.execute(data_query, all_params).fetchall()

        items = []
        for row in res:
            mes_val = int(row[7]) if row[7] is not None else 1
            ano_val = int(row[8]) if row[8] is not None else 2026
            valor_ini = row[9]
            var_pct = row[10]
            nome_mod = row[2] or ""

            if IS_ENRICHED and len(row) >= 15:
                eng_size = row[11]
                is_turbo = bool(row[12])
                is_auto = bool(row[13])
                is_manual = bool(row[14])
            else:
                eng_size, is_turbo, is_auto, is_manual = infer_specs_from_name(nome_mod)

            tipo_cambio = determine_transmission_label(is_auto, is_manual)

            items.append({
                "codigo_fipe": row[0],
                "nome_marca": row[1],
                "nome_modelo": nome_mod,
                "ano_modelo": int(row[3]) if row[3] is not None else None,
                "nome_combustivel": row[4],
                "valor": row[5],
                "valor_formatado": row[6],
                "periodo_referencia": f"{mes_val:02d}/{ano_val}",
                "valor_inicial": valor_ini,
                "valor_inicial_formatado": format_currency(valor_ini) if valor_ini else None,
                "variacao_pct": var_pct,
                "litragem": eng_size,
                "is_turbo": is_turbo,
                "is_automatico": is_auto,
                "tipo_cambio": tipo_cambio
            })

        return total, items
