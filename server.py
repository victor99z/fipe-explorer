import os
import duckdb
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import pandas as pd

app = FastAPI(title="FIPE Parquet Explorer API", version="1.0.0")

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PARQUET_FILE = os.path.abspath("data/fipex-prices.parquet")

def get_db():
    # Use DuckDB in in-memory mode connected to read parquet
    con = duckdb.connect()
    # Optimize DuckDB settings if needed
    con.execute("SET threads TO 4;")
    return con

def format_currency(val: float) -> str:
    if val is None:
        return "R$ 0,00"
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

@app.get("/api/health")
def health():
    if not os.path.exists(PARQUET_FILE):
        raise HTTPException(status_code=500, detail="Parquet file not found")
    con = get_db()
    count = con.execute(f"SELECT COUNT(*) FROM '{PARQUET_FILE}'").fetchone()[0]
    con.close()
    return {"status": "ok", "total_records": count}

@app.get("/api/presets")
def get_presets():
    return [
        {
            "id": "up-tsi-2018",
            "title": "VW Up TSI 2018",
            "subtitle": "Compacto turbo valorizado pós-2020",
            "tipo_veiculo": "carro",
            "search_term": "up tsi",
            "ano_modelo": 2018,
            "badge": "Popular"
        },
        {
            "id": "civic-touring-2020",
            "title": "Honda Civic Touring 2020",
            "subtitle": "Sedã médio turbo de alta procura",
            "tipo_veiculo": "carro",
            "search_term": "civic touring",
            "ano_modelo": 2020,
            "badge": "Destaque"
        },
        {
            "id": "golf-gti-2015",
            "title": "VW Golf GTI 2.0 2015",
            "subtitle": "Esportivo lendário com super valorização",
            "tipo_veiculo": "carro",
            "search_term": "golf gti",
            "ano_modelo": 2015,
            "badge": "Esportivo"
        },
        {
            "id": "hilux-srx-2021",
            "title": "Toyota Hilux SRX 2021",
            "subtitle": "Picape diesel bruta",
            "tipo_veiculo": "carro",
            "search_term": "hilux srx",
            "ano_modelo": 2021,
            "badge": "Picape"
        },
        {
            "id": "uno-mille-2010",
            "title": "Fiat Uno Mille 2010",
            "subtitle": "Economia e resistência histórica",
            "tipo_veiculo": "carro",
            "search_term": "uno mille",
            "ano_modelo": 2010,
            "badge": "Popular"
        },
        {
            "id": "hornet-600-2012",
            "title": "Honda CB 600F Hornet 2012",
            "subtitle": "Moto 4 cilindros valorizada",
            "tipo_veiculo": "moto",
            "search_term": "hornet",
            "ano_modelo": 2012,
            "badge": "Moto"
        }
    ]

@app.get("/api/filters/brands")
def get_brands(tipo_veiculo: str = "carro"):
    con = get_db()
    res = con.execute(f"""
        SELECT DISTINCT nome_marca 
        FROM '{PARQUET_FILE}' 
        WHERE tipo_veiculo = ? 
        ORDER BY nome_marca
    """, [tipo_veiculo]).fetchall()
    con.close()
    return [row[0] for row in res if row[0]]

@app.get("/api/filters/models")
def get_models(tipo_veiculo: str = "carro", marca: Optional[str] = None, search: Optional[str] = None):
    con = get_db()
    where_clauses = ["tipo_veiculo = ?"]
    params = [tipo_veiculo]

    if marca:
        where_clauses.append("nome_marca = ?")
        params.append(marca)

    if search:
        where_clauses.append("lower(nome_modelo) LIKE ?")
        params.append(f"%{search.lower()}%")

    where_sql = " AND ".join(where_clauses)
    
    res = con.execute(f"""
        SELECT DISTINCT nome_modelo 
        FROM '{PARQUET_FILE}' 
        WHERE {where_sql}
        ORDER BY nome_modelo
        LIMIT 200
    """, params).fetchall()
    con.close()
    return [row[0] for row in res if row[0]]

@app.get("/api/filters/years")
def get_years(
    tipo_veiculo: str = "carro",
    marca: Optional[str] = None,
    modelo: Optional[str] = None,
    codigo_fipe: Optional[str] = None
):
    con = get_db()
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

    res = con.execute(f"""
        SELECT DISTINCT CAST(ano_modelo AS INT) as ano 
        FROM '{PARQUET_FILE}' 
        WHERE {where_sql} AND ano_modelo IS NOT NULL AND ano_modelo > 1900
        ORDER BY ano DESC
    """, params).fetchall()
    con.close()
    return [row[0] for row in res if row[0] is not None]

@app.get("/api/search/suggestions")
def get_search_suggestions(q: str, tipo_veiculo: str = "carro"):
    if len(q.strip()) < 2:
        return []
    
    con = get_db()
    terms = q.strip().lower().split()

    like_clauses = []
    params = [tipo_veiculo]
    for term in terms:
        like_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
        params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])

    where_sql = f"tipo_veiculo = ? AND " + " AND ".join(like_clauses)

    res = con.execute(f"""
        SELECT 
            codigo_fipe, 
            nome_marca, 
            nome_modelo, 
            LIST(DISTINCT CAST(ano_modelo AS INT) ORDER BY CAST(ano_modelo AS INT) DESC) FILTER (WHERE ano_modelo IS NOT NULL AND ano_modelo > 1900) as anos
        FROM '{PARQUET_FILE}'
        WHERE {where_sql}
        GROUP BY codigo_fipe, nome_marca, nome_modelo
        ORDER BY nome_marca, nome_modelo
        LIMIT 15
    """, params).fetchall()
    con.close()

    items = []
    for row in res:
        items.append({
            "codigo_fipe": row[0],
            "nome_marca": row[1],
            "nome_modelo": row[2],
            "anos": row[3] if row[3] else []
        })
    return items

TURBO_PATTERN = r'(\btb\b|tsi|tgdi|t-gdi|thp|tfsi|t270|t200|ecoboost|turbo|biturbo|twinpower|tdi|cgi|kompressor)'
AUTOMATIC_PATTERN = r'(\baut\b|\bcvt\b|tiptronic|dualogic|powershift|i-motion|dsg|g-tronic|steptronic|s-tronic|pdk)'
MANUAL_PATTERN = r'(\bmec\b|\bmanual\b)'

@app.get("/api/search/by-price")
def search_by_price(
    tipo_veiculo: str = "carro",
    preco_min: Optional[float] = Query(None, description="Preço mínimo em R$"),
    preco_max: Optional[float] = Query(None, description="Preço máximo em R$"),
    ano_min: Optional[int] = Query(None, description="Ano modelo mínimo"),
    ano_max: Optional[int] = Query(None, description="Ano modelo máximo"),
    marca: Optional[str] = None,
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    combustivel: Optional[str] = None,
    motorizacao: Optional[str] = Query("todos", description="todos, turbo, aspirado"),
    cambio: Optional[str] = Query("todos", description="todos, automatico, manual"),
    search: Optional[str] = None,
    ordenacao: str = "preco_desc",
    page: int = 1,
    limit: int = 24
):
    con = get_db()
    where_clauses = ["tipo_veiculo = ?"]
    params = [tipo_veiculo]

    price_clauses = []
    price_params = []

    if preco_min is not None:
        price_clauses.append("valor >= ?")
        price_params.append(float(preco_min))
    
    if preco_max is not None:
        price_clauses.append("valor <= ?")
        price_params.append(float(preco_max))

    if ano_min is not None:
        where_clauses.append("ano_modelo >= ?")
        params.append(float(ano_min))

    if ano_max is not None:
        where_clauses.append("ano_modelo <= ?")
        params.append(float(ano_max))

    # Single or Multiple Brands
    if marcas and isinstance(marcas, str):
        brand_list = [b.strip() for b in marcas.split(",") if b.strip()]
        if brand_list:
            placeholders = ", ".join(["?"] * len(brand_list))
            where_clauses.append(f"nome_marca IN ({placeholders})")
            params.extend(brand_list)
    elif marca and isinstance(marca, str):
        where_clauses.append("nome_marca = ?")
        params.append(marca)

    if combustivel:
        where_clauses.append("lower(nome_combustivel) LIKE ?")
        params.append(f"%{combustivel.lower()}%")

    # Motorização (Turbo vs Aspirado)
    if motorizacao == "turbo":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")
    elif motorizacao == "aspirado":
        where_clauses.append(f"NOT regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")

    # Câmbio (Automático vs Manual)
    if cambio == "automatico":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}')")
    elif cambio == "manual":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}')")

    if search:
        terms = search.strip().lower().split()
        for term in terms:
            where_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
            params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])

    where_sql = " AND ".join(where_clauses)
    price_where_sql = " AND ".join(price_clauses) if price_clauses else "1=1"
    all_params = params + price_params

    order_sql = "valor DESC"
    if ordenacao == "preco_asc":
        order_sql = "valor ASC"
    elif ordenacao == "desvalorizacao_desc":
        order_sql = "variacao_pct ASC"
    elif ordenacao == "desvalorizacao_asc":
        order_sql = "variacao_pct DESC"
    elif ordenacao == "ano_desc":
        order_sql = "ano_modelo DESC, valor DESC"
    elif ordenacao == "ano_asc":
        order_sql = "ano_modelo ASC, valor DESC"
    elif ordenacao == "modelo_asc":
        order_sql = "nome_modelo ASC"

    # CTE to get latest price for each vehicle version using fast ARGMAX/ARGMIN aggregates
    query_base = f"""
        WITH vehicle_summary AS (
            SELECT 
                codigo_fipe,
                FIRST(nome_marca) as nome_marca,
                FIRST(nome_modelo) as nome_modelo,
                CAST(ano_modelo AS INT) as ano_modelo,
                FIRST(nome_combustivel) as nome_combustivel,
                ARGMAX(valor_centavos / 100.0, ano_referencia * 100 + mes_referencia) as valor,
                ARGMIN(valor_centavos / 100.0, ano_referencia * 100 + mes_referencia) as valor_inicial,
                ARGMAX(ano_referencia, ano_referencia * 100 + mes_referencia) as ano_referencia,
                ARGMAX(mes_referencia, ano_referencia * 100 + mes_referencia) as mes_referencia
            FROM '{PARQUET_FILE}'
            WHERE {where_sql} AND ano_modelo IS NOT NULL AND ano_modelo > 1900
            GROUP BY codigo_fipe, CAST(ano_modelo AS INT)
        ),
        current_vehicles AS (
            SELECT 
                codigo_fipe,
                nome_marca,
                nome_modelo,
                ano_modelo,
                nome_combustivel,
                valor,
                mes_referencia,
                ano_referencia,
                valor_inicial,
                ROUND(CASE WHEN valor_inicial > 0 THEN ((valor - valor_inicial) / valor_inicial) * 100.0 ELSE 0.0 END, 2) as variacao_pct
            FROM vehicle_summary
        )
        SELECT 
            codigo_fipe,
            nome_marca,
            nome_modelo,
            ano_modelo,
            nome_combustivel,
            valor,
            '' as valor_formatado,
            mes_referencia,
            ano_referencia,
            valor_inicial,
            variacao_pct
        FROM current_vehicles
        WHERE {price_where_sql}
    """

    # Count total matching rows
    count_query = f"SELECT COUNT(*) FROM ({query_base}) sub"
    total = con.execute(count_query, all_params).fetchone()[0]

    offset = (page - 1) * limit
    data_query = f"{query_base} ORDER BY {order_sql} LIMIT {limit} OFFSET {offset}"
    res = con.execute(data_query, all_params).fetchall()
    con.close()

    items = []
    for row in res:
        mes_val = int(row[7]) if row[7] is not None else 1
        ano_val = int(row[8]) if row[8] is not None else 2026
        valor_ini = row[9]
        var_pct = row[10]
        items.append({
            "codigo_fipe": row[0],
            "nome_marca": row[1],
            "nome_modelo": row[2],
            "ano_modelo": int(row[3]) if row[3] is not None else None,
            "nome_combustivel": row[4],
            "valor": row[5],
            "valor_formatado": format_currency(row[5]),
            "periodo_referencia": f"{mes_val:02d}/{ano_val}",
            "valor_inicial": valor_ini,
            "valor_inicial_formatado": format_currency(valor_ini) if valor_ini else None,
            "variacao_pct": var_pct
        })

    import math
    total_pages = math.ceil(total / limit) if limit > 0 else 1

    return {
        "total_encontrados": total,
        "page": page,
        "total_paginas": total_pages,
        "resumo_faixa": {
            "preco_min": preco_min,
            "preco_max": preco_max,
            "ano_min": ano_min,
            "ano_max": ano_max,
            "motorizacao": motorizacao,
            "cambio": cambio
        },
        "resultados": items
    }

@app.get("/api/search/analytics")
def search_analytics(
    tipo_veiculo: str = "carro",
    preco_min: Optional[float] = Query(None, description="Preço mínimo em R$"),
    preco_max: Optional[float] = Query(None, description="Preço máximo em R$"),
    ano_min: Optional[int] = Query(None, description="Ano modelo mínimo"),
    ano_max: Optional[int] = Query(None, description="Ano modelo máximo"),
    marca: Optional[str] = None,
    marcas: Optional[str] = Query(None, description="Marcas separadas por vírgula"),
    combustivel: Optional[str] = None,
    motorizacao: Optional[str] = Query("todos", description="todos, turbo, aspirado"),
    cambio: Optional[str] = Query("todos", description="todos, automatico, manual"),
    groupby: str = Query("mes", description="groupby: mes ou ano"),
    fipe_anos: Optional[str] = Query(None, description="codigo_fipe:ano_modelo separados por virgula (max 3)"),
    search: Optional[str] = None
):
    con = get_db()
    where_clauses = ["tipo_veiculo = ?"]
    params = [tipo_veiculo]

    price_clauses = []
    price_params = []

    if preco_min is not None:
        price_clauses.append("valor >= ?")
        price_params.append(float(preco_min))
    
    if preco_max is not None:
        price_clauses.append("valor <= ?")
        price_params.append(float(preco_max))

    if ano_min is not None:
        where_clauses.append("ano_modelo >= ?")
        params.append(float(ano_min))

    if ano_max is not None:
        where_clauses.append("ano_modelo <= ?")
        params.append(float(ano_max))

    if marcas and isinstance(marcas, str):
        brand_list = [b.strip() for b in marcas.split(",") if b.strip()]
        if brand_list:
            placeholders = ", ".join(["?"] * len(brand_list))
            where_clauses.append(f"nome_marca IN ({placeholders})")
            params.extend(brand_list)
    elif marca and isinstance(marca, str):
        where_clauses.append("nome_marca = ?")
        params.append(marca)

    if combustivel:
        where_clauses.append("lower(nome_combustivel) LIKE ?")
        params.append(f"%{combustivel.lower()}%")

    if motorizacao == "turbo":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")
    elif motorizacao == "aspirado":
        where_clauses.append(f"NOT regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")

    if cambio == "automatico":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}')")
    elif cambio == "manual":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}')")

    if search:
        terms = search.strip().lower().split()
        for term in terms:
            where_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
            params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])

    where_sql = " AND ".join(where_clauses)
    price_where_sql = " AND ".join(price_clauses) if price_clauses else "1=1"
    all_params = params + price_params

    # Base CTE of current matching vehicles
    query_base = f"""
        WITH latest_prices AS (
            SELECT 
                codigo_fipe,
                nome_marca,
                nome_modelo,
                CAST(ano_modelo AS INT) as ano_modelo,
                nome_combustivel,
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
            FROM '{PARQUET_FILE}'
            WHERE {where_sql} AND ano_modelo IS NOT NULL AND ano_modelo > 1900
        ),
        current_vehicles AS (
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
                ROUND(CASE WHEN valor_inicial > 0 THEN ((valor - valor_inicial) / valor_inicial) * 100.0 ELSE 0.0 END, 2) as variacao_pct
            FROM latest_prices
            WHERE rn = 1
        )
        SELECT 
            codigo_fipe,
            nome_marca,
            nome_modelo,
            ano_modelo,
            valor,
            valor_inicial,
            variacao_pct
        FROM current_vehicles
        WHERE {price_where_sql}
    """

    vehicles = con.execute(query_base, all_params).fetchall()
    total_found = len(vehicles)

    if total_found == 0:
        con.close()
        return {
            "total_encontrados": 0,
            "metricas": {},
            "top_desvalorizados": [],
            "top_valorizados": [],
            "serie_mensal_segmento": [],
            "comparativo_modelos": []
        }

    # Top 5 Most Devalued
    top_desv_query = f"WITH v AS ({query_base}) SELECT codigo_fipe, nome_marca, nome_modelo, ano_modelo, valor_inicial, valor, variacao_pct FROM v ORDER BY variacao_pct ASC LIMIT 5"
    top_desv_res = con.execute(top_desv_query, all_params).fetchall()

    top_desvalorizados = []
    for r in top_desv_res:
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

    # Top 5 Least Devalued / Most Appreciated
    top_val_query = f"WITH v AS ({query_base}) SELECT codigo_fipe, nome_marca, nome_modelo, ano_modelo, valor_inicial, valor, variacao_pct FROM v ORDER BY variacao_pct DESC LIMIT 5"
    top_val_res = con.execute(top_val_query, all_params).fetchall()

    top_valorizados = []
    for r in top_val_res:
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

    # Metric stats
    precos = [v[4] for v in vehicles]
    variacoes = [v[6] for v in vehicles]
    preco_medio = sum(precos) / len(precos) if precos else 0
    variacao_media = sum(variacoes) / len(variacoes) if variacoes else 0

    metricas = {
        "total_modelos": total_found,
        "preco_medio": round(preco_medio, 2),
        "preco_medio_formatado": format_currency(preco_medio),
        "variacao_media_pct": round(variacao_media, 2),
        "maior_desvalorizacao_pct": min(variacoes) if variacoes else 0,
        "maior_valorizacao_pct": max(variacoes) if variacoes else 0
    }

    # Timeline aggregation (monthly vs annual)
    if groupby == "ano":
        annual_query = f"""
            WITH v AS ({query_base})
            SELECT 
                p.ano_referencia,
                ROUND(AVG(p.valor_centavos / 100.0), 2) as preco_medio
            FROM '{PARQUET_FILE}' p
            JOIN v ON p.codigo_fipe = v.codigo_fipe AND CAST(p.ano_modelo AS INT) = v.ano_modelo
            GROUP BY p.ano_referencia
            ORDER BY p.ano_referencia ASC
        """
        annual_res = con.execute(annual_query, all_params).fetchall()
        serie_segmento = []
        for r in annual_res:
            ano = int(r[0])
            serie_segmento.append({
                "periodo": str(ano),
                "ano": ano,
                "valor": r[1],
                "valor_formatado": format_currency(r[1])
            })
    else:
        monthly_query = f"""
            WITH v AS ({query_base})
            SELECT 
                p.ano_referencia,
                p.mes_referencia,
                ROUND(AVG(p.valor_centavos / 100.0), 2) as preco_medio
            FROM '{PARQUET_FILE}' p
            JOIN v ON p.codigo_fipe = v.codigo_fipe AND CAST(p.ano_modelo AS INT) = v.ano_modelo
            GROUP BY p.ano_referencia, p.mes_referencia
            ORDER BY p.ano_referencia ASC, p.mes_referencia ASC
        """
        monthly_res = con.execute(monthly_query, all_params).fetchall()
        serie_segmento = []
        for r in monthly_res:
            ano = int(r[0])
            mes = int(r[1])
            serie_segmento.append({
                "periodo": f"{mes:02d}/{ano}",
                "ano": ano,
                "mes": mes,
                "valor": r[2],
                "valor_formatado": format_currency(r[2])
            })

    # Parse custom selected models to chart if provided
    selected_models = []
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
                        FROM '{PARQUET_FILE}'
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
        top_models_to_chart = top_desvalorizados[:2] + top_valorizados[:2]
        seen = set()
        for m in top_models_to_chart:
            key = f"{m['codigo_fipe']}_{m['ano_modelo']}"
            if key not in seen:
                seen.add(key)
                selected_models.append(m)
        selected_models = selected_models[:3]

    comparativo_modelos = []
    for m in selected_models[:4]:
        if groupby == "ano":
            model_query = f"""
                SELECT 
                    ano_referencia,
                    ROUND(AVG(valor_centavos / 100.0), 2) as valor
                FROM '{PARQUET_FILE}'
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
                FROM '{PARQUET_FILE}'
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

    con.close()
    return {
        "total_encontrados": total_found,
        "metricas": metricas,
        "top_desvalorizados": top_desvalorizados,
        "top_valorizados": top_valorizados,
        "serie_mensal_segmento": serie_segmento,
        "comparativo_modelos": comparativo_modelos
    }

@app.get("/api/history")
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
    metrica_ano: str = "media" # 'media', 'fechamento', 'max', 'min'
):
    con = get_db()
    where_clauses = ["tipo_veiculo = ?"]
    params = [tipo_veiculo]

    if codigo_fipe:
        where_clauses.append("codigo_fipe = ?")
        params.append(codigo_fipe)
    elif search_term:
        terms = search_term.strip().lower().split()
        for term in terms:
            where_clauses.append("(lower(nome_modelo) LIKE ? OR lower(nome_marca) LIKE ? OR codigo_fipe LIKE ?)")
            params.extend([f"%{term}%", f"%{term}%", f"%{term}%"])
    else:
        if marcas:
            brand_list = [b.strip() for b in marcas.split(",") if b.strip()]
            if brand_list:
                placeholders = ", ".join(["?"] * len(brand_list))
                where_clauses.append(f"nome_marca IN ({placeholders})")
                params.extend(brand_list)
        elif marca:
            where_clauses.append("nome_marca = ?")
            params.append(marca)

        if modelo:
            where_clauses.append("nome_modelo = ?")
            params.append(modelo)

    if ano_modelo is not None:
        where_clauses.append("ano_modelo = ?")
        params.append(float(ano_modelo))

    # Motorização (Turbo vs Aspirado)
    if motorizacao == "turbo":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")
    elif motorizacao == "aspirado":
        where_clauses.append(f"NOT regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}')")

    # Câmbio (Automático vs Manual)
    if cambio == "automatico":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}')")
    elif cambio == "manual":
        where_clauses.append(f"regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}')")

    where_sql = " AND ".join(where_clauses)

    # First get metadata for info header
    meta = con.execute(f"""
        SELECT 
            MIN(nome_marca), 
            MIN(nome_modelo), 
            MIN(codigo_fipe),
            COUNT(*) as total_rows
        FROM '{PARQUET_FILE}'
        WHERE {where_sql}
    """, params).fetchone()

    if not meta or meta[3] == 0:
        con.close()
        raise HTTPException(status_code=404, detail="Nenhum dado encontrado para os filtros selecionados")

    nome_marca_found = meta[0]
    nome_modelo_found = meta[1] if not search_term else f"Pesquisa: {search_term}"
    codigo_fipe_found = meta[2] if codigo_fipe else "Múltiplos / Agrupados"
    total_rows = meta[3]

    if groupby == "mes":
        # Group by month (ano_referencia, mes_referencia)
        query = f"""
            SELECT 
                ano_referencia,
                mes_referencia,
                AVG(valor_centavos) / 100.0 as valor,
                MIN(valor_centavos) / 100.0 as valor_min,
                MAX(valor_centavos) / 100.0 as valor_max,
                COUNT(*) as count
            FROM '{PARQUET_FILE}'
            WHERE {where_sql}
            GROUP BY ano_referencia, mes_referencia
            ORDER BY ano_referencia ASC, mes_referencia ASC
        """
        df = con.execute(query, params).df()
    else:
        # Group by year
        if metrica_ano == "fechamento":
            # Pick latest month of each year
            query = f"""
                WITH ranked AS (
                    SELECT 
                        ano_referencia,
                        mes_referencia,
                        valor_centavos,
                        ROW_NUMBER() OVER (PARTITION BY ano_referencia ORDER BY mes_referencia DESC) as rn
                    FROM '{PARQUET_FILE}'
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
                FROM '{PARQUET_FILE}'
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
                FROM '{PARQUET_FILE}'
                WHERE {where_sql}
                GROUP BY ano_referencia
                ORDER BY ano_referencia ASC
            """
        else: # media
            query = f"""
                SELECT 
                    ano_referencia,
                    1 as mes_referencia,
                    AVG(valor_centavos) / 100.0 as valor,
                    MIN(valor_centavos) / 100.0 as valor_min,
                    MAX(valor_centavos) / 100.0 as valor_max,
                    COUNT(*) as count
                FROM '{PARQUET_FILE}'
                WHERE {where_sql}
                GROUP BY ano_referencia
                ORDER BY ano_referencia ASC
            """
        df = con.execute(query, params).df()

    con.close()

    if df.empty:
        raise HTTPException(status_code=404, detail="Sem dados para este filtro")

    series = []
    initial_val = float(df.iloc[0]["valor"])
    prev_val = initial_val

    for idx, row in df.iterrows():
        val = float(row["valor"])
        val_min = float(row["valor_min"])
        val_max = float(row["valor_max"])
        ano = int(row["ano_referencia"])
        mes = int(row["mes_referencia"])

        if groupby == "mes":
            periodo = f"{mes:02d}/{ano}"
        else:
            periodo = str(ano)

        variacao_periodo_rs = val - prev_val
        variacao_periodo_pct = ((val - prev_val) / prev_val * 100) if prev_val > 0 else 0
        variacao_acumulada_rs = val - initial_val
        variacao_acumulada_pct = ((val - initial_val) / initial_val * 100) if initial_val > 0 else 0

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

    # Calculate overall summary KPIs
    val_atual = series[-1]["valor"]
    val_min_idx = min(series, key=lambda x: x["valor"])
    val_max_idx = max(series, key=lambda x: x["valor"])

    var_total_rs = val_atual - initial_val
    var_total_pct = ((val_atual - initial_val) / initial_val * 100) if initial_val > 0 else 0

    if var_total_pct > 1.5:
        tendencia = "valorizou"
    elif var_total_pct < -1.5:
        tendencia = "desvalorizou"
    else:
        tendencia = "estavel"

    num_periods = len(series)
    if num_periods > 1 and initial_val > 0 and val_atual > 0:
        cagr_pct = (((val_atual / initial_val) ** (1 / (num_periods - 1))) - 1) * 100
    else:
        cagr_pct = 0.0

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
            "valor_atual": round(val_atual, 2),
            "valor_atual_formatado": format_currency(val_atual),
            "data_atual": series[-1]["periodo"],
            "valor_minimo": round(val_min_idx["valor"], 2),
            "valor_minimo_formatado": format_currency(val_min_idx["valor"]),
            "data_minimo": val_min_idx["periodo"],
            "valor_maximo": round(val_max_idx["valor"], 2),
            "valor_maximo_formatado": format_currency(val_max_idx["valor"]),
            "data_maximo": val_max_idx["periodo"],
            "variacao_total_rs": round(var_total_rs, 2),
            "variacao_total_rs_formatada": format_currency(var_total_rs),
            "variacao_total_pct": round(var_total_pct, 2),
            "tendencia": tendencia,
            "cagr_pct": round(cagr_pct, 2)
        },
        "series": series
    }

# Mount static frontend files if built
frontend_dist = os.path.abspath("frontend/dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
