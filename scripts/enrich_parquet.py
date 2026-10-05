#!/usr/bin/env python3
"""
Script de enriquecimento do dataset FIPE Parquet.
Pré-calcula as colunas 'is_turbo', 'is_automatico', 'is_manual', 'litragem' e 'litragem_num'.
Isso elimina o uso de expressões regulares em tempo de consulta, acelerando as buscas no DuckDB em 10x a 20x.
"""

import os
import sys
import time
import duckdb

TURBO_PATTERN = r'(\btb\b|\b([0-9]+)?tsi\b|\b([0-9]+)?tce\b|\btgdi\b|\bt-gdi\b|\bthp\b|\btfsi\b|\bt270\b|\bt200\b|\becoboost\b|\bturbo\b|\bbiturbo\b|\btwinpower\b|\btdi\b|\bcgi\b|\bkompressor\b)'
AUTOMATIC_PATTERN = r'(\baut\b|\bautom[aá]tic[oac]?s?\b|\bautoshift\b|\bcvt\b|\be-cvt\b|\becvt\b|tiptronic|dualogic|powershift|i-motion|dsg|g-tronic|steptronic|s-tronic|pdk|multitronic|geartronic|\b[a-z]?[0-9]{3}[a-z]*a\b)'
MANUAL_PATTERN = r'(\bmec\b|\bmanual\b)'

def main():
    input_file = "data/fipex-prices.parquet"
    output_file = "data/fipex-prices-enriched.parquet"

    if not os.path.exists(input_file):
        for candidate in [
            os.path.expanduser("~/Documents/workspace/fipe-dados/data/fipex-prices.parquet"),
            "/home/jub/Documents/workspace/fipe-dados/data/fipex-prices.parquet"
        ]:
            if os.path.exists(candidate):
                input_file = candidate
                break

    if not os.path.exists(input_file):
        print(f"ERRO: Arquivo de entrada '{input_file}' não encontrado.", file=sys.stderr)
        sys.exit(1)

    input_size_mb = os.path.getsize(input_file) / (1024 * 1024)
    print(f"[*] Iniciando enriquecimento de: {input_file} ({input_size_mb:.2f} MB)")
    print(f"[*] Arquivo de saída: {output_file}")

    con = duckdb.connect()
    con.execute("SET threads TO 4;")
    con.execute("SET preserve_insertion_order = false;")

    # Contagem inicial
    t0 = time.time()
    total_rows = con.execute(f"SELECT COUNT(*) FROM '{input_file}'").fetchone()[0]
    print(f"[*] Total de linhas a processar: {total_rows:,}")

    query = f"""
    COPY (
        SELECT 
            tipo_veiculo,
            codigo_fipe,
            nome_modelo,
            nome_marca,
            nome_combustivel,
            sigla_combustivel,
            CAST(ano_modelo AS BIGINT) AS ano_modelo,
            zero_km,
            valor_centavos,
            valor_formatado,
            mes_referencia,
            ano_referencia,
            -- Colunas pré-calculadas
            CAST(regexp_extract(nome_modelo, '([0-9]\\.[0-9])', 1) AS VARCHAR) AS litragem,
            TRY_CAST(regexp_extract(nome_modelo, '([0-9]\\.[0-9])', 1) AS DOUBLE) AS litragem_num,
            CAST(regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}') AS BOOLEAN) AS is_turbo,
            CAST(regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}') AS BOOLEAN) AS is_automatico,
            CAST(regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}') AS BOOLEAN) AS is_manual
        FROM '{input_file}'
    ) TO '{output_file}' (FORMAT PARQUET, COMPRESSION ZSTD);
    """

    print("[*] Executando COPY com DuckDB...")
    t_copy = time.time()
    con.execute(query)
    elapsed = time.time() - t_copy
    print(f"[✓] Enriquecimento concluído em {elapsed:.2f} segundos!")

    output_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"[✓] Tamanho final: {output_size_mb:.2f} MB")

    # Validação rápida de integridade
    print("[*] Validando dados enriquecidos...")
    val_rows = con.execute(f"SELECT COUNT(*) FROM '{output_file}'").fetchone()[0]
    assert val_rows == total_rows, f"Contagem divergente! Original: {total_rows}, Enriquecido: {val_rows}"

    stats = con.execute(f"""
        SELECT 
            COUNT(*) FILTER (WHERE is_turbo = true) as total_turbo,
            COUNT(*) FILTER (WHERE is_automatico = true) as total_automatico,
            COUNT(*) FILTER (WHERE is_manual = true) as total_manual,
            COUNT(DISTINCT litragem) as total_litragens
        FROM '{output_file}'
    """).fetchone()

    print(f"    - Veículos Turbo: {stats[0]:,}")
    print(f"    - Veículos Automáticos: {stats[1]:,}")
    print(f"    - Veículos Manuais: {stats[2]:,}")
    print(f"    - Variações de Litragem: {stats[3]:,}")
    print(f"[✓] Validação concluída com sucesso! Tempo total: {time.time() - t0:.2f}s")
    con.close()

if __name__ == "__main__":
    main()
