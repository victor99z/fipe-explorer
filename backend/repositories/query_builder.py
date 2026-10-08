import re
from typing import Tuple, List, Any, Optional
from backend.core.config import settings
from backend.core.constants import TURBO_PATTERN, AUTOMATIC_PATTERN, MANUAL_PATTERN
from backend.core.database import IS_ENRICHED

class SqlQueryBuilder:
    """
    Centralized, DRY SQL clause builder for FIPE queries.
    Prevents duplicate logic across search, analytics, and history endpoints.
    """
    @staticmethod
    def build_filter_clauses(
        tipo_veiculo: str = "carro",
        preco_min: Optional[float] = None,
        preco_max: Optional[float] = None,
        ano_min: Optional[int] = None,
        ano_max: Optional[int] = None,
        ano_modelo: Optional[int] = None,
        marca: Optional[str] = None,
        marcas: Optional[str] = None,
        combustivel: Optional[str] = None,
        motorizacao: Optional[str] = "todos",
        cambio: Optional[str] = "todos",
        litragem: Optional[str] = "todos",
        search: Optional[str] = None,
        codigo_fipe: Optional[str] = None,
        modelo: Optional[str] = None,
        exclusive_search: bool = False
    ) -> Tuple[List[str], List[Any], List[str], List[Any]]:
        """
        Builds parameterized WHERE clauses.
        Returns: (where_clauses, base_params, price_clauses, price_params)
        """
        where_clauses: List[str] = ["tipo_veiculo = ?"]
        params: List[Any] = [tipo_veiculo]

        price_clauses: List[str] = []
        price_params: List[Any] = []

        if exclusive_search:
            if codigo_fipe:
                where_clauses.append("codigo_fipe = ?")
                params.append(codigo_fipe)
            elif search:
                clean_search = search.strip()[:80]
                terms = clean_search.lower().split()
                for term in terms[:5]:
                    where_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
                    params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])
            else:
                if marcas and isinstance(marcas, str):
                    brand_list = [b.strip() for b in marcas.split(",") if b.strip()]
                    if brand_list:
                        placeholders = ", ".join(["?"] * len(brand_list))
                        where_clauses.append(f"nome_marca IN ({placeholders})")
                        params.extend(brand_list)
                elif marca and isinstance(marca, str):
                    where_clauses.append("nome_marca = ?")
                    params.append(marca)

                if modelo:
                    where_clauses.append("nome_modelo = ?")
                    params.append(modelo)
        else:
            # Exact vehicle identifiers
            if codigo_fipe:
                where_clauses.append("codigo_fipe = ?")
                params.append(codigo_fipe)

            if modelo:
                where_clauses.append("nome_modelo = ?")
                params.append(modelo)

            # Brand(s)
            if marcas and isinstance(marcas, str):
                brand_list = [b.strip() for b in marcas.split(",") if b.strip()]
                if brand_list:
                    placeholders = ", ".join(["?"] * len(brand_list))
                    where_clauses.append(f"nome_marca IN ({placeholders})")
                    params.extend(brand_list)
            elif marca and isinstance(marca, str):
                where_clauses.append("nome_marca = ?")
                params.append(marca)

            # Free-text multi-word search
            if search:
                clean_search = search.strip()[:80]
                terms = clean_search.lower().split()
                for term in terms[:5]:
                    where_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
                    params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])

        # Price bounds (applied to latest price)
        if preco_min is not None:
            price_clauses.append("valor >= ?")
            price_params.append(float(preco_min))

        if preco_max is not None:
            price_clauses.append("valor <= ?")
            price_params.append(float(preco_max))

        # Model Year bounds
        if ano_modelo is not None:
            where_clauses.append("ano_modelo = ?")
            params.append(float(ano_modelo))
        else:
            if ano_min is not None:
                where_clauses.append("ano_modelo >= ?")
                params.append(float(ano_min))
            if ano_max is not None:
                where_clauses.append("ano_modelo <= ?")
                params.append(float(ano_max))

        # Fuel
        if combustivel and combustivel.strip() and combustivel.strip().lower() not in ("todos", "todas", "all"):
            clean_comb = combustivel.strip().lower()
            tokens = [t.strip() for t in clean_comb.split(",") if t.strip()]
            fuel_subclauses = []
            siglas = set()
            name_patterns = []

            for token in tokens:
                if token in ("hibrido_eletrico", "eletrificado", "eletrificados", "hibridos_eletricos", "eletrificado_hibrido"):
                    siglas.add("h")
                    siglas.add("l")
                    name_patterns.append("%híbrido%")
                    name_patterns.append("%elétrico%")
                elif token in ("flex_gasolina", "gasolina_flex"):
                    siglas.add("f")
                    siglas.add("g")
                    name_patterns.append("%flex%")
                    name_patterns.append("%gasolina%")
                elif token in ("hibrido", "híbrido"):
                    siglas.add("h")
                    name_patterns.append("%híbrido%")
                elif token in ("eletrico", "elétrico"):
                    siglas.add("l")
                    name_patterns.append("%elétrico%")
                elif token == "flex":
                    siglas.add("f")
                    name_patterns.append("%flex%")
                elif token == "gasolina":
                    siglas.add("g")
                    name_patterns.append("%gasolina%")
                elif token == "diesel":
                    siglas.add("d")
                    name_patterns.append("%diesel%")
                elif token in ("alcool", "álcool", "etanol"):
                    siglas.add("e")
                    name_patterns.append("%álcool%")
                elif token in ("gnv", "gas", "gás", "gás natural"):
                    siglas.add("n")
                    name_patterns.append("%gás%")
                else:
                    name_patterns.append(f"%{token}%")

            if siglas:
                placeholders = ", ".join(["?"] * len(siglas))
                fuel_subclauses.append(f"sigla_combustivel IN ({placeholders})")
                params.extend(sorted(list(siglas)))
            for pat in name_patterns:
                fuel_subclauses.append("lower(nome_combustivel) LIKE ?")
                params.append(pat)

            if fuel_subclauses:
                where_clauses.append(f"({' OR '.join(fuel_subclauses)})")

        # Motorization (Turbo vs Aspirated)
        if motorizacao == "turbo":
            where_clauses.append("is_turbo = true" if IS_ENRICHED else f"regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")
        elif motorizacao == "aspirado":
            where_clauses.append("is_turbo = false" if IS_ENRICHED else f"NOT regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")

        # Transmission (Automatic vs Manual)
        if cambio == "automatico":
            where_clauses.append("is_automatico = true" if IS_ENRICHED else f"regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}')")
        elif cambio == "manual":
            where_clauses.append("is_manual = true" if IS_ENRICHED else f"regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}')")

        # Engine Displacement (litragem)
        if litragem and litragem != "todos":
            if litragem == "2.0+":
                where_clauses.append("litragem_num >= 2.0" if IS_ENRICHED else "TRY_CAST(regexp_extract(nome_modelo, '([0-9]\\.[0-9])', 1) AS DOUBLE) >= 2.0")
            else:
                if IS_ENRICHED:
                    where_clauses.append("litragem = ?")
                    params.append(litragem)
                else:
                    escaped_lit = re.escape(litragem)
                    where_clauses.append(f"regexp_matches(nome_modelo, '\\b{escaped_lit}\\b')")

        return where_clauses, params, price_clauses, price_params

    @staticmethod
    def build_current_vehicles_cte(where_sql: str, price_where_sql: str) -> str:
        """Constructs reusable base CTE extracting each unique vehicle's latest and initial price."""
        enriched_cols = ""
        enriched_sel_cols = ""
        if IS_ENRICHED:
            enriched_cols = ", litragem, is_turbo, is_automatico, is_manual"
            enriched_sel_cols = ", litragem, is_turbo, is_automatico, is_manual"

        return f"""
            WITH latest_prices AS (
                SELECT 
                    codigo_fipe,
                    nome_marca,
                    nome_modelo,
                    CAST(ano_modelo AS INT) as ano_modelo,
                    nome_combustivel,
                    { 'litragem, is_turbo, is_automatico, is_manual,' if IS_ENRICHED else '' }
                    valor_centavos / 100.0 as valor,
                    valor_formatado,
                    ano_referencia,
                    mes_referencia,
                    FIRST_VALUE(valor_centavos / 100.0) OVER (
                        PARTITION BY codigo_fipe, ano_modelo 
                        ORDER BY ano_referencia ASC, mes_referencia ASC
                    ) as valor_inicial,
                    ROW_NUMBER() OVER (
                        PARTITION BY codigo_fipe, ano_modelo 
                        ORDER BY ano_referencia DESC, mes_referencia DESC
                    ) as rn
                FROM '{settings.PARQUET_FILE}'
                WHERE {where_sql} AND ano_modelo IS NOT NULL AND ano_modelo > 1900
            ),
            current_vehicles AS (
                SELECT 
                    codigo_fipe,
                    nome_marca,
                    nome_modelo,
                    ano_modelo,
                    nome_combustivel,
                    { 'litragem, is_turbo, is_automatico, is_manual,' if IS_ENRICHED else '' }
                    valor,
                    valor_formatado,
                    mes_referencia,
                    ano_referencia,
                    valor_inicial,
                    ROUND(CASE WHEN valor_inicial > 0 THEN ((valor - valor_inicial) / valor_inicial) * 100.0 ELSE 0.0 END, 2) as variacao_pct
                FROM latest_prices
                WHERE rn = 1
            )
            SELECT 
                codigo_fipe,
                nome_marca,
                nome_modelo,
                ano_modelo,
                nome_combustivel,
                valor,
                valor_formatado,
                mes_referencia,
                ano_referencia,
                valor_inicial,
                variacao_pct
                {enriched_sel_cols}
            FROM current_vehicles
            WHERE {price_where_sql}
        """
