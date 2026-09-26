import pandas as pd

PARQUET_FILE = "data/fipex-prices.parquet"


def main():
    df = pd.read_parquet(PARQUET_FILE)

    filtrado = df[
        (df["tipo_veiculo"] == "carro") &
        (df["nome_combustivel"].isin(["Gasolina", "Flex"])) &
        (df["ano_modelo"] > 2020)
    ]

    ultimo_mes = (
        filtrado
        .sort_values(["ano_referencia", "mes_referencia"], ascending=False)
        .drop_duplicates(subset=["codigo_fipe", "ano_modelo"])
        .query("valor_centavos <= 15_000_000")
        .sort_values("valor_centavos")
    )

    turbo = ultimo_mes[
        ultimo_mes["nome_modelo"].str.contains("turbo|TSI|TDI|TGDI|TB", case=False, na=False) &
        ultimo_mes["nome_modelo"].str.contains(r"Aut\.", na=False)
    ]

    output = "data/carros_turbo.csv"
    turbo.to_csv(output, index=False)
    print(f"Total de registros: {len(ultimo_mes)}")
    print(f"Exportado para: {output}")
    print(f"\n{ultimo_mes[['nome_marca', 'nome_modelo', 'ano_modelo', 'valor_formatado']].to_string()}")


if __name__ == "__main__":
    main()
