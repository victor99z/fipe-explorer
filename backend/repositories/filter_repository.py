from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.database import db_session, IS_ENRICHED
from backend.core.constants import ENGINE_PATTERN

class FilterRepository:
    """Data Access Layer for filter metadata (brands, models, years, displacements)."""

    @staticmethod
    def get_brands(tipo_veiculo: str = "carro") -> List[str]:
        with db_session() as con:
            res = con.execute(f"""
                SELECT DISTINCT nome_marca 
                FROM '{settings.PARQUET_FILE}' 
                WHERE tipo_veiculo = ? 
                ORDER BY nome_marca
            """, [tipo_veiculo]).fetchall()
        return [row[0] for row in res if row[0]]

    @staticmethod
    def get_models(tipo_veiculo: str = "carro", marca: Optional[str] = None, search: Optional[str] = None) -> List[str]:
        where_clauses = ["tipo_veiculo = ?"]
        params = [tipo_veiculo]

        if marca:
            where_clauses.append("nome_marca = ?")
            params.append(marca)

        if search:
            clean_search = search.strip()[:80]
            where_clauses.append("lower(nome_modelo) LIKE ?")
            params.append(f"%{clean_search.lower()}%")

        where_sql = " AND ".join(where_clauses)

        with db_session() as con:
            res = con.execute(f"""
                SELECT DISTINCT nome_modelo 
                FROM '{settings.PARQUET_FILE}' 
                WHERE {where_sql}
                ORDER BY nome_modelo
                LIMIT 200
            """, params).fetchall()
        return [row[0] for row in res if row[0]]

    @staticmethod
    def get_years(
        tipo_veiculo: str = "carro",
        marca: Optional[str] = None,
        modelo: Optional[str] = None,
        codigo_fipe: Optional[str] = None
    ) -> List[int]:
        where_clauses = ["tipo_veiculo = ?"]
        params = [tipo_veiculo]

        if codigo_fipe:
            where_clauses.append("codigo_fipe = ?")
            params.append(codigo_fipe)
        elif marca and modelo:
            where_clauses.append("nome_marca = ?")
            params.append(marca)
            where_clauses.append("nome_modelo = ?")
            params.append(modelo)

        where_sql = " AND ".join(where_clauses)

        with db_session() as con:
            res = con.execute(f"""
                SELECT DISTINCT CAST(ano_modelo AS INT) as ano 
                FROM '{settings.PARQUET_FILE}' 
                WHERE {where_sql} AND ano_modelo IS NOT NULL AND ano_modelo > 1900
                ORDER BY ano DESC
            """, params).fetchall()
        return [row[0] for row in res if row[0] is not None]

    @staticmethod
    def get_engine_sizes(tipo_veiculo: str = "carro") -> List[Dict[str, Any]]:
        with db_session() as con:
            if IS_ENRICHED:
                res = con.execute(f"""
                    SELECT 
                        litragem,
                        COUNT(DISTINCT codigo_fipe) as total_modelos
                    FROM '{settings.PARQUET_FILE}'
                    WHERE tipo_veiculo = ? 
                      AND litragem IS NOT NULL AND litragem != ''
                    GROUP BY litragem
                    ORDER BY MIN(litragem_num) ASC
                """, [tipo_veiculo]).fetchall()
            else:
                res = con.execute(f"""
                    SELECT 
                        regexp_extract(nome_modelo, '([0-9]\\.[0-9])', 1) as litragem,
                        COUNT(DISTINCT codigo_fipe) as total_modelos
                    FROM '{settings.PARQUET_FILE}'
                    WHERE tipo_veiculo = ? 
                      AND regexp_matches(nome_modelo, '([0-9]\\.[0-9])')
                    GROUP BY litragem
                    HAVING litragem IS NOT NULL AND litragem != ''
                    ORDER BY TRY_CAST(litragem AS DOUBLE) ASC
                """, [tipo_veiculo]).fetchall()
        return [{"litragem": row[0], "total_modelos": row[1]} for row in res if row[0]]
