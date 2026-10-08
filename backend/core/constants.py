import re
from typing import List, Dict, Any

TURBO_PATTERN = r'(\btb\b|\b([0-9]+)?tsi\b|\b([0-9]+)?tce\b|\btgdi\b|\bt-gdi\b|\bthp\b|\btfsi\b|\bt270\b|\bt200\b|\becoboost\b|\bturbo\b|\bbiturbo\b|\btwinpower\b|\btdi\b|\bcgi\b|\bkompressor\b)'
AUTOMATIC_PATTERN = r'(\baut\b|\bautom[aá]tic[oac]?s?\b|\bautoshift\b|\bcvt\b|\be-cvt\b|\becvt\b|tiptronic|dualogic|powershift|i-motion|dsg|g-tronic|steptronic|s-tronic|pdk|multitronic|geartronic|\b[a-z]?[0-9]{3}[a-z]*a\b|\b[1-8][0-9]{2}ia?\b)'
MANUAL_PATTERN = r'(\bmec\b|\bmanual\b)'
ENGINE_PATTERN = r'\b([0-9]\.[0-9])\b'

RE_TURBO = re.compile(TURBO_PATTERN, re.IGNORECASE)
RE_AUTO = re.compile(AUTOMATIC_PATTERN, re.IGNORECASE)
RE_MANUAL = re.compile(MANUAL_PATTERN, re.IGNORECASE)
RE_ENGINE = re.compile(ENGINE_PATTERN)

PRESETS_DATA: List[Dict[str, Any]] = [
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
        "id": "byd-dolphin-2024",
        "title": "BYD Dolphin EV 2024",
        "subtitle": "100% Elétrico pioneiro e líder de vendas",
        "tipo_veiculo": "carro",
        "search_term": "dolphin",
        "ano_modelo": 2024,
        "badge": "Elétrico"
    },
    {
        "id": "corolla-hybrid-2020",
        "title": "Toyota Corolla Altis Hybrid 2020",
        "subtitle": "Sedã híbrido flex com alta economia",
        "tipo_veiculo": "carro",
        "search_term": "corolla altis hybrid",
        "ano_modelo": 2020,
        "badge": "Híbrido"
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
