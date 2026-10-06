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
AUTOMATIC_PATTERN = r'(\baut\b|\bautom[aá]tic[oac]?s?\b|\bautoshift\b|\bcvt\b|\be-cvt\b|\becvt\b|tiptronic|dualogic|powershift|i-motion|dsg|g-tronic|steptronic|s-tronic|pdk|multitronic|geartronic|\b[a-z]?[0-9]{3}[a-z]*a\b|\b[1-8][0-9]{2}ia?\b)'
MANUAL_PATTERN = r'(\bmec\b|\bmanual\b)'

def enrich_dataset(input_file: str, output_file: str, threads: int = 4) -> dict:
    """
    Executa a pipeline DuckDB para enriquecer o arquivo Parquet bruto
    com colunas indexáveis pré-calculadas.
    """
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_file}")

    input_size_mb = os.path.getsize(input_file) / (1024 * 1024)
    print(f"[*] Iniciando enriquecimento: {input_file} ({input_size_mb:.2f} MB)")
    print(f"[*] Destino: {output_file}")

    con = duckdb.connect()
    con.execute(f"SET threads TO {threads};")
    con.execute("SET preserve_insertion_order = false;")

    t0 = time.time()
    total_rows = con.execute(f"SELECT COUNT(*) FROM read_parquet('{input_file}')").fetchone()[0]
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
        FROM read_parquet('{input_file}')
    ) TO '{output_file}' (FORMAT PARQUET, COMPRESSION ZSTD);
    """

    print("[*] Executando COPY com DuckDB...")
    t_copy = time.time()
    con.execute(query)
    elapsed = time.time() - t_copy
    output_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"[✓] Enriquecimento concluído em {elapsed:.2f}s! Tamanho final: {output_size_mb:.2f} MB")

    # Validação de integridade
    val_rows = con.execute(f"SELECT COUNT(*) FROM read_parquet('{output_file}')").fetchone()[0]
    assert val_rows == total_rows, f"Contagem divergente! Original: {total_rows}, Enriquecido: {val_rows}"

    stats = con.execute(f"""
        SELECT 
            COUNT(*) FILTER (WHERE is_turbo = true) as total_turbo,
            COUNT(*) FILTER (WHERE is_automatico = true) as total_automatico,
            COUNT(*) FILTER (WHERE is_manual = true) as total_manual,
            COUNT(DISTINCT litragem) as total_litragens
        FROM read_parquet('{output_file}')
    """).fetchone()

    total_time = time.time() - t0
    con.close()

    result = {
        "total_rows": total_rows,
        "output_size_mb": round(output_size_mb, 2),
        "elapsed_seconds": round(total_time, 2),
        "total_turbo": stats[0],
        "total_automatico": stats[1],
        "total_manual": stats[2],
        "total_litragens": stats[3]
    }

    print(f"    - Veículos Turbo: {stats[0]:,}")
    print(f"    - Veículos Automáticos: {stats[1]:,}")
    print(f"    - Veículos Manuais: {stats[2]:,}")
    print(f"    - Variações de Litragem: {stats[3]:,}")
    print(f"[✓] Validação concluída com sucesso em {total_time:.2f}s!")

    return result

def main():
    input_file = sys.argv[1] if len(sys.argv) > 1 else "data/fipex-prices.parquet"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "data/fipex-prices-enriched.parquet"

    if not os.path.exists(input_file):
        for candidate in [
            os.path.expanduser("~/Documents/workspace/fipe-dados/data/fipex-prices.parquet"),
            "/home/jub/Documents/workspace/fipe-dados/data/fipex-prices.parquet"
        ]:
            if os.path.exists(candidate):
                input_file = candidate
                break

    enrich_dataset(input_file, output_file)

if __name__ == "__main__":
    main()
