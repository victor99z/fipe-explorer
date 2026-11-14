#!/usr/bin/env python3
"""
Parser e Matcher das Tabelas PBE Veicular do INMETRO (2010–2026) com a Tabela FIPE.

Funcionalidades:
1. Baixa (com cache local em data/inmetro_pdfs/) os PDFs oficiais de Veículos Leves do INMETRO.
2. Extrai dados tabulares via `pdftotext -layout` para todas as safras (2010–2026).
3. Salva a tabela consolidada padronizada em `data/inmetro-pbev.parquet`.
4. Cruza com os veículos de passeio/comerciais leves (`tipo_veiculo = 'carro'`) da base FIPE
   usando filtro mecânico + pontuação de versão/ano, salvando `data/fipe-inmetro-matches.parquet`.
"""

import argparse
import os
import re
import subprocess
import sys
import unicodedata
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import duckdb
import pandas as pd

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.core.constants import AUTOMATIC_PATTERN, MANUAL_PATTERN, TURBO_PATTERN

INMETRO_PAGE_URL = (
    "https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/"
    "programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular"
)

DATA_DIR = os.path.join(ROOT_DIR, "data")
PDF_CACHE_DIR = os.path.join(DATA_DIR, "inmetro_pdfs")
INMETRO_PARQUET = os.path.join(DATA_DIR, "inmetro-pbev.parquet")
MATCHES_PARQUET = os.path.join(DATA_DIR, "fipe-inmetro-matches.parquet")

CATEGORIES_SET = {
    "sub compacto",
    "subcompacto",
    "compacto",
    "medio",
    "grande",
    "extra grande",
    "extragrande",
    "utilitario esportivo",
    "utilitario esportivo compacto",
    "utilitario esportivo medio",
    "utilitario esportivo grande",
    "utilitario esportivo 4x4",
    "fora de estrada",
    "fora de estrada compacto",
    "fora de estrada grande",
    "comercial",
    "comercial leve",
    "comercial/picape",
    "picape",
    "picape compacta",
    "picape media",
    "picape grande",
    "esportivo",
    "minivan",
    "minivan / monovolume",
    "monovolume",
    "furgao",
    "carga",
    "microonibus",
}

TRANSMISSION_RE = re.compile(
    r"^(?:M\s*-\s*\d+|A\s*-\s*\d+|A|AUT|CVT(?:-\d+)?|E-?CVT|DCT(?:-\d+)?|MTA(?:-\d+)?|N\.?A\.?)$",
    re.IGNORECASE,
)
MOTOR_RE = re.compile(
    r"^(?:\d\.\d\s*(?:L|T|V|\d+V|-?\d+V)?.*|el[eé]trico|h[ií]brido)$",
    re.IGNORECASE,
)
MOTOR_LIT_RE = re.compile(r"(\d\.\d)")
GRADE_RE = re.compile(r"^[A-E]$")

BRAND_ALIASES = {
    "gm - chevrolet": "chevrolet",
    "gm": "chevrolet",
    "chevrolet": "chevrolet",
    "vw - volkswagen": "vw",
    "volkswagen": "vw",
    "vw": "vw",
    "caoa chery/chery": "chery",
    "caoa chery": "chery",
    "chery": "chery",
    "caoa changan": "changan",
    "caoachangan": "changan",
    "changan": "changan",
    "kia motors": "kia",
    "kia": "kia",
    "mercedes-benz": "mercedes",
    "mercedes": "mercedes",
    "citroen": "citroen",
    "great wall": "gwm",
    "gwm": "gwm",
    "land rover": "land rover",
    "alfa romeo": "alfa romeo",
    "aston martin": "aston martin",
    "rolls-royce": "rolls-royce",
    "rolls royce": "rolls-royce",
    "hitech electric": "hitech",
    "ram": "ram",
    "ssangyong": "ssangyong",
    "mini": "mini",
    "smart": "smart",
    "byd": "byd",
    "fiat": "fiat",
    "ford": "ford",
    "honda": "honda",
    "hyundai": "hyundai",
    "jac": "jac",
    "jaguar": "jaguar",
    "jeep": "jeep",
    "lexus": "lexus",
    "lifan": "lifan",
    "mitsubishi": "mitsubishi",
    "nissan": "nissan",
    "peugeot": "peugeot",
    "porsche": "porsche",
    "renault": "renault",
    "subaru": "subaru",
    "suzuki": "suzuki",
    "toyota": "toyota",
    "troller": "troller",
    "volvo": "volvo",
    "audi": "audi",
    "bmw": "bmw",
    "ferrari": "ferrari",
    "maserati": "maserati",
    "mclaren": "mclaren",
    "lamborghini": "lamborghini",
    "chrysler": "chrysler",
    "dodge": "dodge",
    "geely": "geely",
    "omoda": "omoda",
    "jaecoo": "jaecoo",
    "zeekr": "zeekr",
    "neta": "neta",
    "seres": "seres",
    "leapmotor": "leapmotor",
    "gac": "gac",
    "mg": "mg",
    "iveco": "iveco",
    "foton": "foton",
    "effa": "effa",
}

VERSION_ABBREV = {
    "allur": "allure",
    "activ": "active",
    "comfort": "comfortline",
    "confort": "comfortline",
    "high": "highline",
    "longit": "longitude",
    "limited": "limited",
    "lim": "limited",
    "trail": "trailhawk",
    "aut": "automatico",
    "at": "automatico",
    "mt": "manual",
    "mec": "manual",
    "prem": "premier",
    "exec": "executive",
    "excl": "exclusive",
    "perf": "performance",
    "adv": "adventure",
    "trek": "trekking",
    "attr": "attractive",
    "ess": "essence",
    "prec": "precision",
    "sprt": "sport",
    "tour": "touring",
    "hv": "hybrid",
    "hev": "hev",
    "phev": "phev",
    "ev": "eletrico",
    "bev": "eletrico",
    "4wd": "4x4",
    "awd": "4x4",
}

IGNORED_MODEL_WORDS = {
    "novo",
    "nova",
    "new",
    "the",
    "all",
    "grand",
}


def strip_accents(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def normalize_text(text: str) -> str:
    s = strip_accents(text or "").lower()
    s = s.replace("\xad", "-").replace("\u2010", "-").replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_brand(brand: str) -> str:
    b = normalize_text(brand)
    if b in BRAND_ALIASES:
        return BRAND_ALIASES[b]
    for k, v in BRAND_ALIASES.items():
        if b.startswith(k):
            return v
    return b


def parse_float(tok: Optional[str]) -> Optional[float]:
    if not tok:
        return None
    t = tok.strip()
    if t in {"\\", "/", "-", "ND", "N.D.", "N.A.", "NA", "***", ""}:
        return None
    t = t.replace(",", ".")
    try:
        val = float(t)
        return val if val >= 0 else None
    except ValueError:
        return None


def parse_int(tok: Optional[str]) -> Optional[int]:
    val = parse_float(tok)
    if val is None:
        return None
    return int(round(val))


def fetch_inmetro_pdf_links() -> Dict[int, str]:
    """Busca links @@download/file de todos os ciclos (2010-2026) na página oficial do INMETRO."""
    req = urllib.request.Request(INMETRO_PAGE_URL, headers={"User-Agent": "fipex-inmetro-parser/1.0"})
    html = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", errors="ignore")
    raw_links = sorted(set(re.findall(r'https://www\.gov\.br/inmetro/[^"]+/@@download/file', html)))
    year_links: Dict[int, str] = {}
    for url in raw_links:
        lower = url.lower()
        if "metodologia" in lower or "2009" in lower:
            continue
        m = re.search(r"(20[12][0-9])", lower)
        if m:
            yr = int(m.group(1))
            if 2010 <= yr <= 2026:
                year_links[yr] = url
    return dict(sorted(year_links.items()))


def download_pdfs(force: bool = False) -> Dict[int, str]:
    """Baixa os PDFs para data/inmetro_pdfs/ usando cache local quando disponível."""
    os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    cached: Dict[int, str] = {}
    for yr in range(2010, 2027):
        path = os.path.join(PDF_CACHE_DIR, f"pbev_{yr}.pdf")
        if os.path.exists(path) and os.path.getsize(path) > 10_000 and not force:
            cached[yr] = path

    if len(cached) == 17 and not force:
        print(f"[*] Usando {len(cached)} PDFs do cache local em {PDF_CACHE_DIR}")
        return cached

    print("[*] Consultando links oficiais na página do INMETRO...")
    links = fetch_inmetro_pdf_links()
    for yr, url in links.items():
        dest = os.path.join(PDF_CACHE_DIR, f"pbev_{yr}.pdf")
        if not os.path.exists(dest) or os.path.getsize(dest) < 10_000 or force:
            print(f"[↓] Baixando PBEV {yr}: {url}")
            req = urllib.request.Request(url, headers={"User-Agent": "fipex-inmetro-parser/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as out:
                out.write(resp.read())
        cached[yr] = dest
    return dict(sorted(cached.items()))


def is_category_token(tok: str) -> bool:
    norm = normalize_text(tok)
    if norm in CATEGORIES_SET:
        return True
    for prefix in ("utilitario", "fora de estrada", "comercial", "picape", "sub compacto", "minivan"):
        if norm.startswith(prefix):
            return True
    return False


def extract_engine_and_version(meta_tokens: List[str], year: int) -> Tuple[str, str]:
    """
    Identifica `motor` e `versao` dentre os tokens após `marca` e `modelo`
    (antes de `propulsao`/`transmissao`).
    """
    if not meta_tokens:
        return "", ""

    motor_idx = -1
    for i, t in enumerate(meta_tokens):
        if MOTOR_RE.match(t.strip()):
            motor_idx = i
            break

    if motor_idx == -1:
        # Tenta localizar substring tipo 1.0 ou 2.0
        for i, t in enumerate(meta_tokens):
            if MOTOR_LIT_RE.search(t) and len(t) <= 18:
                motor_idx = i
                break

    if motor_idx != -1:
        motor = meta_tokens[motor_idx].strip()
        vers_parts = [t.strip() for j, t in enumerate(meta_tokens) if j != motor_idx and t.strip() != "-"]
        versao = " ".join(vers_parts).strip()
        return motor, versao

    # Sem padrão explícito de motor
    if year in (2013, 2014, 2015, 2016, 2020) and len(meta_tokens) >= 2:
        return meta_tokens[0].strip(), " ".join(t for t in meta_tokens[1:] if t != "-").strip()
    return "", " ".join(t for t in meta_tokens if t != "-").strip()


def parse_line_tokens(tokens: List[str], year: int) -> Optional[Dict[str, Any]]:
    if len(tokens) < 10:
        return None

    # Localizar âncora: Transmissão + (S/N) + (M/H/E/E-H) + ... + Combustível (F/G/D/E)
    trans_idx = -1
    fuel_idx = -1
    propulsao = "Combustão"

    for i in range(2, len(tokens) - 4):
        t = tokens[i].strip()
        if not TRANSMISSION_RE.match(t):
            continue
        # Padrão normal: [trans] [S/N] [dir] [F/G/D/E]
        if i + 3 < len(tokens) and tokens[i + 1] in ("S", "N") and tokens[i + 3] in ("F", "G", "D", "E"):
            trans_idx = i
            fuel_idx = i + 3
            break
        # Padrão 2021: [trans] [S/N] [dir] [propulsao] [F/G/D/E]
        if i + 4 < len(tokens) and tokens[i + 1] in ("S", "N") and tokens[i + 4] in ("F", "G", "D", "E"):
            trans_idx = i
            propulsao = tokens[i + 3].strip()
            fuel_idx = i + 4
            break

    if trans_idx == -1 or fuel_idx == -1:
        return None

    # Verificar se o token imediatamente antes de trans_idx é Propulsão (2022–2026)
    end_meta_idx = trans_idx
    if trans_idx > 2 and normalize_text(tokens[trans_idx - 1]) in (
        "combustao",
        "eletrico",
        "hibrido",
        "plug-in",
        "hibrido plug-in",
    ):
        propulsao = tokens[trans_idx - 1].strip()
        end_meta_idx = trans_idx - 1

    # Extrair categoria, marca, modelo, meta
    idx = 0
    categoria = ""
    if is_category_token(tokens[0]):
        categoria = tokens[0].strip()
        idx = 1

    if idx + 2 > end_meta_idx:
        return None

    marca = tokens[idx].strip()
    modelo = tokens[idx + 1].strip()
    meta_tokens = tokens[idx + 2 : end_meta_idx]

    # Caso o texto do PDF tenha juntado marca+modelo ou tenha modelo vazio
    if not marca or not modelo or marca.lower().startswith("www."):
        return None

    motor, versao = extract_engine_and_version(meta_tokens, year)
    transmissao = tokens[trans_idx].strip()
    combustivel = tokens[fuel_idx].strip()

    # Extrair métricas de consumo à direita de fuel_idx
    tail = tokens[fuel_idx + 1 :]
    eta_cid = eta_est = gas_cid = gas_est = ele_cid = ele_est = None
    eficiencia_mj_km = None
    autonomia_km = None
    nota_categoria = None
    nota_geral = None
    selo_conpet = False

    if year <= 2012:
        # Layout 2010-2012: [eta_cid, gas_cid, eta_est, gas_est, nota_pbe]
        if len(tail) < 5:
            return None
        eta_cid = parse_float(tail[0])
        gas_cid = parse_float(tail[1])
        eta_est = parse_float(tail[2])
        gas_est = parse_float(tail[3])
        if GRADE_RE.match(tail[4].strip()):
            nota_categoria = tail[4].strip()
            nota_geral = tail[4].strip()
    else:
        # Layout 2013-2026: localizar eficiência energética (MJ/km) próxima ao final
        # Final da linha: [mj_km, (autonomia?), nota_cat, nota_geral, (selo?)]
        mj_idx = -1
        for k in range(len(tail) - 2, max(-1, len(tail) - 7), -1):
            val = parse_float(tail[k])
            if val is not None and 0.20 <= val <= 4.50:
                # Verificar se após k há notas A-E
                after = tail[k + 1 :]
                grades = [x.strip() for x in after if GRADE_RE.match(x.strip())]
                if len(grades) >= 1:
                    mj_idx = k
                    eficiencia_mj_km = val
                    nota_categoria = grades[0]
                    nota_geral = grades[1] if len(grades) >= 2 else grades[0]
                    if len(after) >= 2 and after[0].strip() not in ("\\", "-", "ND") and not GRADE_RE.match(after[0].strip()):
                        autonomia_km = parse_int(after[0])
                    selo_conpet = any(x.strip().upper() == "SIM" for x in after)
                    break

        if mj_idx == -1:
            return None

        vals_before_mj = tail[:mj_idx]
        if year >= 2026 and len(vals_before_mj) >= 10:
            # Últimos 10 tokens antes de mj_km:
            # [eta_cid, eta_est, eta_comb, gas_cid, gas_est, gas_comb, ele_cid, ele_est, vehp_cid, vehp_est]
            slice10 = vals_before_mj[-10:]
            eta_cid = parse_float(slice10[0])
            eta_est = parse_float(slice10[1])
            gas_cid = parse_float(slice10[3])
            gas_est = parse_float(slice10[4])
            ele_cid = parse_float(slice10[6])
            ele_est = parse_float(slice10[7])
        elif year in (2023, 2024, 2025) and len(vals_before_mj) >= 6:
            # Últimos 6 tokens antes de mj_km:
            # [eta_cid, eta_est, gas_cid, gas_est, ele_cid, ele_est]
            slice6 = vals_before_mj[-6:]
            eta_cid = parse_float(slice6[0])
            eta_est = parse_float(slice6[1])
            gas_cid = parse_float(slice6[2])
            gas_est = parse_float(slice6[3])
            ele_cid = parse_float(slice6[4])
            ele_est = parse_float(slice6[5])
        elif len(vals_before_mj) >= 4:
            # 2013-2022: [eta_cid, eta_est, gas_cid, gas_est]
            slice4 = vals_before_mj[-4:]
            eta_cid = parse_float(slice4[0])
            eta_est = parse_float(slice4[1])
            c_cid = parse_float(slice4[2])
            c_est = parse_float(slice4[3])
            is_ev = combustivel == "E" or "eletric" in normalize_text(propulsao) or "eletric" in normalize_text(motor)
            if is_ev:
                ele_cid = c_cid
                ele_est = c_est
            else:
                gas_cid = c_cid
                gas_est = c_est
        else:
            return None

    # Normalização para matching
    marca_norm = normalize_brand(marca)
    lit_m = MOTOR_LIT_RE.search(motor) or MOTOR_LIT_RE.search(versao) or MOTOR_LIT_RE.search(modelo)
    litragem = lit_m.group(1) if lit_m else None

    full_inmetro_str = f"{modelo} {versao} {motor}".lower()
    is_turbo = bool(
        re.search(r"\b(?:t|turbo|tsi|tfsi|tce|tgdi|t-gdi|thp|t200|t270|ecoboost|biturbo|tdi|cgi)\b", full_inmetro_str)
        or re.search(r"\d\.\d\s*t\b", full_inmetro_str)
        or re.search(r"16v\s*t\b|12v\s*t\b", full_inmetro_str)
    )
    trans_up = transmissao.upper()
    is_automatico = bool(
        re.match(r"^(?:A|AUT|CVT|E-?CVT|DCT|MTA)", trans_up)
    )

    # Corrigir combustível para elétricos marcados erroneamente como G em 2021
    if "eletric" in normalize_text(propulsao) or "eletric" in normalize_text(motor):
        combustivel = "E"

    # Rejeitar linhas com colunas deslocadas por células em branco (onde valores de CO2 g/km vazam para consumo)
    if any(x is not None and x > 30.0 for x in (eta_cid, eta_est)):
        return None
    if any(x is not None and x > 45.0 for x in (gas_cid, gas_est)):
        return None
    if any(x is not None and x > 100.0 for x in (ele_cid, ele_est)):
        return None

    # Deve ter pelo menos uma métrica de consumo válida
    if all(x is None for x in (eta_cid, eta_est, gas_cid, gas_est, ele_cid, ele_est)):
        return None

    return {
        "ano_ciclo": year,
        "categoria": categoria,
        "marca": marca,
        "modelo": modelo,
        "versao": versao,
        "motor": motor,
        "propulsao": propulsao,
        "transmissao": transmissao,
        "combustivel": combustivel,
        "consumo_urbano_etanol": eta_cid,
        "consumo_rodoviario_etanol": eta_est,
        "consumo_urbano_gasolina": gas_cid,
        "consumo_rodoviario_gasolina": gas_est,
        "consumo_urbano_eletrico": ele_cid,
        "consumo_rodoviario_eletrico": ele_est,
        "eficiencia_mj_km": eficiencia_mj_km,
        "autonomia_km": autonomia_km,
        "nota_categoria": nota_categoria,
        "nota_geral": nota_geral,
        "selo_conpet": selo_conpet,
        "marca_norm": marca_norm,
        "litragem": litragem,
        "is_turbo": is_turbo,
        "is_automatico": is_automatico,
    }


def parse_pdf(pdf_path: str, year: int) -> List[Dict[str, Any]]:
    raw = subprocess.check_output(["pdftotext", "-layout", pdf_path, "-"], stderr=subprocess.DEVNULL)
    text = raw.decode("utf-8", errors="ignore")
    text = text.replace("\xad", "-").replace("\u2010", "-").replace("\u2013", "-").replace("\u2014", "-")
    rows: List[Dict[str, Any]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or "www." in stripped.lower():
            continue
        tokens = re.split(r"\s{2,}", stripped)
        parsed = parse_line_tokens(tokens, year)
        if parsed is not None:
            rows.append(parsed)
    return rows


def build_inmetro_parquet(force_download: bool = False) -> pd.DataFrame:
    pdf_map = download_pdfs(force=force_download)
    all_rows: List[Dict[str, Any]] = []
    for yr, path in pdf_map.items():
        yr_rows = parse_pdf(path, yr)
        print(f"  [PBEV {yr}] {len(yr_rows):4d} versões extraídas")
        all_rows.extend(yr_rows)

    df = pd.DataFrame(all_rows)
    if df.empty:
        raise RuntimeError("Nenhum registro foi extraído dos PDFs do INMETRO!")

    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_parquet(INMETRO_PARQUET, index=False, compression="zstd")
    print(f"[✓] Tabela INMETRO salva em {INMETRO_PARQUET} ({len(df):,} linhas)")
    return df


# ---------------------------------------------------------------------------
# Matching INMETRO <-> FIPE
# ---------------------------------------------------------------------------

def tokenize_clean(text: str) -> List[str]:
    norm = normalize_text(text)
    norm = re.sub(r"[^a-z0-9.\s-]", " ", norm)
    raw_tokens = re.split(r"[\s/-]+", norm)
    tokens: List[str] = []
    for t in raw_tokens:
        if not t or t in IGNORED_MODEL_WORDS:
            continue
        t = VERSION_ABBREV.get(t, t)
        tokens.append(t)
    return tokens


MULTI_FAMILIES = [
    "corolla cross",
    "eclipse cross",
    "dolphin mini",
    "onix plus",
    "joy plus",
    "grand siena",
    "palio weekend",
    "c3 aircross",
    "c4 cactus",
    "c4 lounge",
    "c4 picasso",
    "arrizo 5e",
    "arrizo 5",
    "arrizo 6",
    "tiggo 2",
    "tiggo 5x",
    "tiggo 3x",
    "tiggo 7",
    "tiggo 8",
    "range rover evoque",
    "range rover velar",
    "range rover sport",
    "discovery sport",
    "grand cherokee",
    "pajero sport",
    "partner rapid",
    "haval h6",
    "haval h9",
    "ora 03",
    "ioniq 5",
    "avatr 11",
    "song plus",
    "song pro",
    "yuan plus",
    "yuan pro",
    "seal",
    "han",
    "tan",
    "king",
    "e-208",
    "e-2008",
    "e-js1",
    "e-kwid",
    "e-jv5.5",
    "e-transit",
    "t-cross",
    "hr-v",
    "wr-v",
    "cr-v",
    "zr-v",
    "hb20s",
    "hb20x",
    "hb20",
    "creta",
    "compass",
    "renegade",
    "commander",
    "toro",
    "strada",
    "argo",
    "cronos",
    "mobi",
    "pulse",
    "fastback",
    "titano",
    "s10",
    "l200",
    "hilux sw4",
    "hilux",
    "sw4",
    "yaris",
    "etios",
    "corolla",
    "rav4",
    "civic",
    "city",
    "fit",
    "accord",
    "polo",
    "virtus",
    "nivus",
    "taos",
    "gol",
    "voyage",
    "saveiro",
    "fox",
    "up",
    "jetta",
    "golf",
    "tiguan",
    "amarok",
    "onix",
    "tracker",
    "cruze",
    "spin",
    "montana",
    "equinox",
    "prisma",
    "cobalt",
    "kwid",
    "sandero",
    "logan",
    "duster",
    "oroch",
    "kardian",
    "captur",
    "kicks",
    "versa",
    "sentra",
    "frontier",
    "march",
    "208",
    "2008",
    "3008",
    "c3",
    "basalt",
    "aircross",
    "ka",
    "fiesta",
    "focus",
    "ecosport",
    "ranger",
    "territory",
    "maverick",
    "bronco sport",
    "bronco",
    "mustang",
    "uno",
    "palio",
    "siena",
    "fiorino",
    "doblo",
    "500e",
    "500",
    "cooper",
    "countryman",
    "dolphin",
]

LEXUS_PREFIX_PATTERNS = [
    (r"^ct[\s-]?200h?\b", "ct200h"),
    (r"^es[\s-]?300h?\b", "es300h"),
    (r"^es[\s-]?350\b", "es350"),
    (r"^is[\s-]?200\b", "is200"),
    (r"^is[\s-]?250\b", "is250"),
    (r"^is[\s-]?300\b", "is300"),
    (r"^ls[\s-]?460\b", "ls460"),
    (r"^ls[\s-]?500h?\b", "ls500h"),
    (r"^nx[\s-]?450h\+?\b", "nx450h"),
    (r"^nx[\s-]?350h\b", "nx350h"),
    (r"^nx[\s-]?300h\b", "nx300h"),
    (r"^nx[\s-]?300\b", "nx300"),
    (r"^nx[\s-]?200t?\b", "nx200"),
    (r"^rx[\s-]?500h\b", "rx500h"),
    (r"^rx[\s-]?450h\+?\b", "rx450h"),
    (r"^rx[\s-]?350\b", "rx350"),
    (r"^ux[\s-]?250h\b", "ux250h"),
    (r"^ux[\s-]?300h\b", "ux300h"),
]


def _extract_mercedes_family(m: str) -> Optional[str]:
    if "esprinter" in m or "e sprinter" in m or "e-sprinter" in m:
        return "esprinter"
    if m.startswith(("sprinter", "spri.", "sprin.", "315cdi")):
        return "sprinter"
    if m.startswith("vito"):
        return "vito"
    m_clean = m[4:].strip() if (m.startswith("amg ") and not m.startswith("amg gt")) else m
    if m_clean.startswith("amg gt") or re.match(r"^gt\s*(?:43|53|63|r|c|amg)\b", m_clean) or m_clean == "gt":
        return "amg gt"
    for prefix in ("cla", "cls", "gla", "glb", "glc", "gle", "gls", "slc", "slk", "sl"):
        if re.match(rf"^{prefix}(?:[\s-]|\d|$)", m_clean):
            return prefix
    eq_match = re.match(r"^eq([abces])(?:[\s-]|\d|$)", m_clean)
    if eq_match:
        return f"eq{eq_match.group(1)}"
    cls_match = re.match(r"^(?:classe\s+)?([abcegs])[\s-]?\d{2,3}\b", m_clean)
    if cls_match:
        return f"classe {cls_match.group(1)}"
    cls_word = re.match(r"^classe\s+([abcegs])\b", m_clean)
    if cls_word:
        return f"classe {cls_word.group(1)}"
    return None


def _extract_shared_family(m: str, v: str, marca_norm: str) -> Optional[str]:
    """Normalizações de família compartilhadas entre registros INMETRO e FIPE."""
    if m == "up!" or m.startswith(("up!", "up ")):
        return "up"
    if marca_norm == "fiat" and (m.startswith("mille") or m in ("mille", "novo uno", "uno")):
        return "uno"
    if m.startswith("grand siena"):
        return "grand siena"
    if m.startswith("palio weekend") or m == "weekend":
        return "palio weekend"
    if m.startswith("grand c4 picasso") or m.startswith("c4 picasso"):
        return "c4 picasso"

    if marca_norm == "renault":
        if m.startswith(("e-kwid", "ekwid")) or (m.startswith("kwid") and ("e-tech" in m or "eletric" in m)):
            return "e-kwid"
        if m.startswith(("sandero stepway", "stepway")):
            return "stepway"

    if marca_norm == "chery":
        if re.match(r"^arrizo\s*5\s*e\b", m) or m.startswith(("arrizo5 e", "arrizo 5e")):
            return "arrizo 5e"
        if re.match(r"^arrizo\s*5\b", m):
            return "arrizo 5"
        if re.match(r"^arrizo\s*6\b", m):
            return "arrizo 6"
        if re.match(r"^tiggo\s*2(?!\.\d)\b", m):
            return "tiggo 2"
        if re.match(r"^tiggo\s*3x\b", m):
            return "tiggo 3x"
        if re.match(r"^tiggo\s*5x\b", m):
            return "tiggo 5x"
        if re.match(r"^tiggo\s*7\b", m):
            return "tiggo 7"
        if re.match(r"^tiggo\s*8\b", m):
            return "tiggo 8"

    if marca_norm == "gwm":
        if m.startswith("haval h6") or (m.startswith("haval") and "h6" in m):
            return "haval h6"
        if m.startswith("haval h9"):
            return "haval h9"
        if re.match(r"^ora\s*03\b", m):
            return "ora 03"
        if re.match(r"^wey(?:\s+07)?\b", m):
            return "wey 07"

    if marca_norm == "mg":
        if m == "4" or m.startswith(("4 ", "mg4", "mg 4")):
            return "mg4"

    if marca_norm == "jac":
        if re.match(r"^e-?jv\s*5\.5\b", m):
            return "e-jv5.5"
        if re.match(r"^iev\s*330p\b", m):
            return "iev330p"
        if re.match(r"^iev\s*40\b", m):
            return "iev40"
        if re.match(r"^iev\s*20\b", m):
            return "iev20"

    if marca_norm == "foton":
        if re.match(r"^e[vw]iew\b", m):
            return "eview"

    if marca_norm == "changan":
        if re.match(r"^avatr\s*11\b", m):
            return "avatr 11"

    if marca_norm == "chevrolet":
        if re.match(r"^joy\s+plus\b", m):
            return "joy plus"
        if m == "joy" or m.startswith("joy "):
            return "joy"

    if marca_norm == "ford":
        if re.match(r"^(?:nova\s+)?f-?150\b", m):
            return "f-150"
        if m == "ka+" or m.startswith(("ka+ ", "ka plus", "ka+")):
            return "ka"
        if m.startswith("e-transit"):
            return "e-transit"

    if marca_norm == "troller" and re.match(r"^t-?4\b", m):
        return "t4"

    if marca_norm == "jeep":
        if m.startswith("renegade"):
            return "renegade"
        if re.match(r"^(?:grand|g)\s+cherokee\b", m):
            return "grand cherokee"
        if m.startswith("gladiator"):
            return "gladiator"

    if marca_norm == "toyota":
        if m.startswith(("gr yaris", "yaris gr")):
            return "gr yaris"
        if m.startswith(("hilux sw4", "sw4 ")) or m == "sw4":
            return "sw4"

    if marca_norm == "mitsubishi":
        if m.startswith("pajero sport"):
            return "pajero sport"
        if m.startswith(("l200", "triton")):
            return "l200"

    if marca_norm == "hyundai" and re.match(r"^ioniq\s*5\b", m):
        return "ioniq 5"

    if marca_norm == "peugeot":
        if m.startswith(("e-2008", "e2008")) or (m.startswith("2008") and "e-2008" in m):
            return "e-2008"
        if m.startswith(("e-208", "e208")) or (m.startswith("208") and ("e-208" in m or "e-gt" in v or (v == "gt" and "eletric" in v))):
            return "e-208"
        if m.startswith(("partner rapid", "partrapid")):
            return "partner rapid"

    if marca_norm == "citroen":
        if m.startswith(("c3 aircross", "c3aircross", "aircross7", "aircross 7")):
            return "c3 aircross"

    if marca_norm == "volvo":
        for pfx in ("xc", "ex", "ec", "c", "v", "s"):
            volvo_match = re.match(rf"^{pfx}\s*(\d{{2}})\b", m)
            if volvo_match:
                return f"{pfx}{volvo_match.group(1)}"

    if marca_norm == "lexus":
        for pat, fam in LEXUS_PREFIX_PATTERNS:
            if re.match(pat, m):
                return fam

    if marca_norm == "land rover":
        if re.match(r"^(?:new\s+)?(?:def\.|defe\.|defender)\b", m):
            return "defender"
        if re.match(r"^(?:new\s+)?disc(?:ov(?:ery)?)?\.?\s+sp(?:t|ort)?\.?\b", m):
            return "discovery sport"
        if re.match(r"^(?:new\s+)?disc(?:ov(?:ery)?)?\.?\b", m):
            return "discovery"
        if re.match(r"^(?:new\s+)?range(?:\s*rover|\s*\.?\s*r\.?)?\s+velar\b|^velar\b", m):
            return "range rover velar"
        if re.match(r"^(?:new\s+)?range(?:\s*rover|\s*\.?\s*r\.?)?\s*evoque\b|^evoque\b", m):
            return "range rover evoque"
        if re.match(r"^(?:new\s+)?range(?:\s*rover|\s*\.?\s*r\.?)\s*sp(?:ort|\.?)\b|^rrspt\b", m):
            return "range rover sport"
        if re.match(r"^(?:new\s+)?range(?:\s*rover|\s*\.?\s*r\.?)\b|^rrover\b", m):
            return "range rover"

    if marca_norm == "porsche":
        if re.match(r"^(?:718\s+)?boxs?ter\b", m) or m.startswith("718 spyder"):
            return "boxster"
        if re.match(r"^(?:718\s+)?cayman\b", m):
            return "cayman"
        if m.startswith(("cayenne", "cayene")):
            return "cayenne"

    if marca_norm == "audi":
        rs_match = re.match(r"^rs\s*(q3|q8|[3-7])\b", m)
        if rs_match:
            return f"rs{rs_match.group(1)}"
        if re.match(r"^s\s*q5\b", m):
            return "sq5"
        if re.match(r"^tt\s*rs\b", m):
            return "ttrs"
        for a in ("a1", "a3", "a4", "a5", "a6", "a7", "a8", "q3", "q5", "q7", "q8"):
            if re.match(rf"^{a}\b", m):
                return a

    if marca_norm == "bmw":
        if re.match(r"^3\d{2}[ie]?", m):
            return "serie 3"
        if re.match(r"^750(?:il|li)\b", m):
            return "750li"
        s12_match = re.match(r"^([12]\d{2}i)", m)
        if s12_match:
            return s12_match.group(1)
        m_match = re.match(r"^m\s*(135|235|340|140|240|440|760)(?:li|i)?\b", m)
        if m_match:
            suffix = "li" if m_match.group(1) == "760" else "i"
            return f"m{m_match.group(1)}{suffix}"
        x_match = re.match(r"^(x[1-7])\b", m)
        if x_match:
            return x_match.group(1)

    if marca_norm == "mercedes":
        return _extract_mercedes_family(m)

    return None


def extract_inmetro_family(modelo: str, versao: str, marca_norm: str) -> str:
    """Normaliza a família/modelo base do registro INMETRO para comparação com a FIPE."""
    m = normalize_text(modelo)
    v = normalize_text(versao)
    # Remove marca se vier repetida
    if m.startswith(marca_norm + " "):
        m = m[len(marca_norm) + 1 :].strip()
    # Remover sufixos de carroceria/portas/geração que às vezes poluem o nome
    m = re.sub(r"\b(2p|4p|5p|2 portas|4 portas|hatch|sedan|suv|pick-up|pickup|ts|tsi)\b", " ", m)
    m = re.sub(r"\s+", " ", m).strip()

    shared = _extract_shared_family(m, v, marca_norm)
    if shared is not None:
        return shared

    # Casos específicos conhecidos restantes
    if m.startswith("c4 cactus"):
        return "c4 cactus"
    if m.startswith("c4 lounge"):
        return "c4 lounge"
    if m.startswith("c3 aircross"):
        return "c3 aircross"
    if m.startswith("corolla cross"):
        return "corolla cross"
    if m.startswith("eclipse cross"):
        return "eclipse cross"
    if m.startswith("dolphin mini"):
        return "dolphin mini"
    if m.startswith("onix plus"):
        return "onix plus"
    if m.startswith("hb20s"):
        return "hb20s"
    if m.startswith("hb20x"):
        return "hb20x"
    if m.startswith("hr-v"):
        return "hr-v"
    if m.startswith("wr-v"):
        return "wr-v"
    if m.startswith("cr-v"):
        return "cr-v"
    if m.startswith("zr-v"):
        return "zr-v"
    if m.startswith("t-cross") or m == "t cross":
        return "t-cross"
    if m.startswith("s10"):
        return "s10"
    if m.startswith("l200"):
        return "l200"
    if m.startswith("mini cooper") or m == "cooper":
        return "cooper"
    if m.startswith("cooper countryman") or m == "countryman":
        return "countryman"

    # Primeiro token significativo (ou 2 tokens se segundo for número/plus/cross/sedan)
    parts = [p for p in m.split() if p not in IGNORED_MODEL_WORDS]
    if not parts:
        return m
    if len(parts) >= 2 and parts[1] in ("plus", "cross", "sport", "sedan", "sw", "city", "mini", "max", "pro", "aircross", "cactus", "lounge", "5x", "7", "8", "3x", "6", "5", "4", "3", "2"):
        return f"{parts[0]} {parts[1]}"
    return parts[0]


def extract_fipe_family(nome_modelo: str, marca_norm: str) -> str:
    m = normalize_text(nome_modelo)
    m = m.replace("!", "")
    if m.startswith(marca_norm + " "):
        m = m[len(marca_norm) + 1 :].strip()

    shared = _extract_shared_family(m, "", marca_norm)
    if shared is not None:
        return shared

    # Verificar famílias compostas antes de pegar só o 1º token
    for fam in MULTI_FAMILIES:
        if m == fam or m.startswith(fam + " ") or m.startswith(fam + "/"):
            return fam
    if marca_norm == "vw" and (m.startswith("up ") or m == "up"):
        return "up"

    parts = [p for p in re.split(r"[\s/]+", m) if p and p not in IGNORED_MODEL_WORDS]
    return parts[0] if parts else m


def fuel_compatible(fipe_fuel: str, fipe_model: str, inmetro_fuel: str, inmetro_prop: str) -> bool:
    ff = normalize_text(fipe_fuel)
    fm = normalize_text(fipe_model)
    inf = (inmetro_fuel or "").upper()
    inp = normalize_text(inmetro_prop)

    if ff == "eletrico" or "(eletrico)" in fm:
        if inf == "E" or "eletric" in inp:
            return True
        # Range-extender EV (ex.: BMW i3 REX) aparece no INMETRO como gasolina ('G')
        return "rex" in fm and inf == "G"
    if ff == "diesel":
        return inf == "D"
    if ff == "hibrido" or "hibrido" in fm or "hybrid" in fm or "(hib" in fm:
        if inf in ("F", "G"):
            return True
        if inf == "D" and ("die" in fm or bool(re.search(r"\bd\d{3}\b", fm))):
            return True
        return "hibrid" in inp or "plug-in" in inp or "plug" in inp
    if ff == "flex" or "flex" in fm:
        return inf in ("F", "G")
    if ff == "gasolina":
        return inf in ("G", "F")
    if ff == "alcool":
        return inf == "F"
    return True


def match_fipe_with_inmetro(fipe_parquet_path: str, inmetro_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    if inmetro_df is None:
        if not os.path.exists(INMETRO_PARQUET):
            inmetro_df = build_inmetro_parquet()
        else:
            inmetro_df = pd.read_parquet(INMETRO_PARQUET)

    print(f"[*] Carregando veículos distintos da FIPE em {fipe_parquet_path}...")
    con = duckdb.connect()
    cols = [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM '{fipe_parquet_path}' LIMIT 1").fetchall()]
    has_ref_cols = "ano_referencia" in cols and "mes_referencia" in cols
    dedup_clause = (
        "QUALIFY row_number() OVER (PARTITION BY codigo_fipe, CAST(ano_modelo AS INT) ORDER BY ano_referencia DESC, mes_referencia DESC) = 1"
        if has_ref_cols
        else ""
    )
    select_kw = "SELECT" if has_ref_cols else "SELECT DISTINCT"
    if "litragem" in cols and "is_turbo" in cols and "is_automatico" in cols:
        fipe_df = con.execute(f"""
            {select_kw}
                codigo_fipe,
                CAST(ano_modelo AS INT) AS ano_modelo,
                nome_marca,
                nome_modelo,
                nome_combustivel,
                litragem,
                is_turbo,
                is_automatico,
                is_manual
            FROM '{fipe_parquet_path}'
            WHERE tipo_veiculo = 'carro'
              AND ano_modelo IS NOT NULL
              AND ano_modelo >= 2009
            {dedup_clause}
        """).fetchdf()
    else:
        fipe_df = con.execute(f"""
            {select_kw}
                codigo_fipe,
                CAST(ano_modelo AS INT) AS ano_modelo,
                nome_marca,
                nome_modelo,
                nome_combustivel,
                CAST(regexp_extract(nome_modelo, '([0-9]\\.[0-9])', 1) AS VARCHAR) AS litragem,
                CAST(regexp_matches(lower(nome_modelo), '{TURBO_PATTERN}') AS BOOLEAN) AS is_turbo,
                CAST(regexp_matches(lower(nome_modelo), '{AUTOMATIC_PATTERN}') AS BOOLEAN) AS is_automatico,
                CAST(regexp_matches(lower(nome_modelo), '{MANUAL_PATTERN}') AS BOOLEAN) AS is_manual
            FROM '{fipe_parquet_path}'
            WHERE tipo_veiculo = 'carro'
              AND ano_modelo IS NOT NULL
              AND ano_modelo >= 2009
            {dedup_clause}
        """).fetchdf()
    con.close()

    fipe_df = fipe_df.drop_duplicates(subset=["codigo_fipe", "ano_modelo"], keep="last")
    print(f"[*] Total de pares únicos (codigo_fipe, ano_modelo) na FIPE >= 2009: {len(fipe_df):,}")

    # Indexar registros INMETRO por (marca_norm, family)
    inmetro_records = inmetro_df.to_dict("records")
    inmetro_index: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for r in inmetro_records:
        m_norm = normalize_brand(str(r["marca_norm"]))
        fam = extract_inmetro_family(str(r["modelo"]), str(r["versao"]), m_norm)
        r["_family"] = fam
        r["_tokens"] = set(tokenize_clean(f"{r['modelo']} {r['versao']} {r['motor']}"))
        inmetro_index.setdefault((m_norm, fam), []).append(r)

    related_families: Dict[Tuple[str, str], List[Tuple[str, str]]] = {
        ("mini", "cooper"): [("mini", "mini cooper")],
        ("renault", "stepway"): [("renault", "sandero")],
        ("chevrolet", "joy"): [("chevrolet", "onix"), ("chevrolet", "10mt")],
        ("chevrolet", "joy plus"): [("chevrolet", "onix plus"), ("chevrolet", "prisma")],
        ("chevrolet", "tracker"): [("chevrolet", "1.4t-16v")],
        ("chevrolet", "prisma"): [("chevrolet", "1.0mt"), ("chevrolet", "1.4mt"), ("chevrolet", "1.4at")],
        ("chevrolet", "onix"): [("chevrolet", "1.0mt"), ("chevrolet", "1.4mt"), ("chevrolet", "1.4at")],
        ("citroen", "c4"): [("citroen", "c4 picasso"), ("citroen", "c4 lounge")],
        ("jac", "iev"): [("jac", "iev40"), ("jac", "iev20"), ("jac", "iev330p")],
        ("toyota", "sw4"): [("toyota", "cd"), ("toyota", "hilux")],
        ("audi", "rsq3"): [("audi", "q3")],
        ("audi", "sq5"): [("audi", "q5")],
    }

    matches: List[Dict[str, Any]] = []
    exact_count = 0
    mech_count = 0

    for row in fipe_df.itertuples(index=False):
        ano_modelo = int(row.ano_modelo)
        # Ano 32000 representa 0 km na FIPE -> usar ciclo mais recente (2026)
        ano_eff = 2026 if ano_modelo >= 2026 else ano_modelo

        marca_norm = normalize_brand(row.nome_marca)
        fam = extract_fipe_family(row.nome_modelo, marca_norm)

        candidates = list(inmetro_index.get((marca_norm, fam), []))
        for alt_key in related_families.get((marca_norm, fam), []):
            candidates.extend(inmetro_index.get(alt_key, []))
        if not candidates:
            continue

        model_lower = normalize_text(row.nome_modelo)
        fipe_lit = row.litragem if row.litragem and str(row.litragem).strip() else None
        if not fipe_lit:
            lit_fallback = re.search(r"([0-9]\.[0-9])", model_lower)
            if lit_fallback:
                fipe_lit = lit_fallback.group(1)
            elif re.search(r"\b(?:t?200|200\s*t\.?)\b", model_lower):
                fipe_lit = "1.0"
            elif re.search(r"\b(?:t?270|270\s*t\.?)\b", model_lower):
                fipe_lit = "1.3"

        fipe_lits = set(re.findall(r"([0-9]\.[0-9])", model_lower))
        if fipe_lit:
            fipe_lits.add(str(fipe_lit).strip())

        fipe_turbo = bool(row.is_turbo) or bool(
            re.search(r"(?:200\s*t\.|270\s*t\.|\btd\b|\bbi-tb\b|\bt\.flex\b|\bt\.aut\b|\bt200\b|\bt270\b)", model_lower)
        )
        fipe_auto = bool(row.is_automatico)
        fipe_manual = bool(row.is_manual)
        trans_ambiguous = not fipe_auto and not fipe_manual
        fipe_fuel = row.nome_combustivel or ""
        ff_norm = normalize_text(fipe_fuel)
        fipe_tokens = set(tokenize_clean(row.nome_modelo))

        # Base compatível (combustível, litragem, transmissão) antes da janela de ano/turbo
        base_compatible: List[Tuple[Dict[str, Any], Optional[str], int]] = []
        for cand in candidates:
            if not fuel_compatible(fipe_fuel, row.nome_modelo, cand["combustivel"], cand["propulsao"]):
                continue

            raw_cand_lit = cand.get("litragem")
            cand_lit = None if raw_cand_lit is None or pd.isna(raw_cand_lit) else str(raw_cand_lit).strip()
            if not cand_lit or cand_lit.lower() == "nan":
                cand_lit = None
            if fipe_lits and cand_lit and cand_lit not in fipe_lits:
                continue

            cand_auto = bool(cand["is_automatico"])
            if fipe_auto and not cand_auto:
                continue
            if fipe_manual and not fipe_auto and cand_auto:
                continue

            cand_tokens = cand["_tokens"]
            noise = {fipe_lit, "flex", "gasolina", "diesel", "eletrico", "manual", "automatico", "aut", "mec", "5p", "4p", "2p", "16v", "8v", "6v", "12v", "turbo"}
            v_fipe = {t for t in fipe_tokens if t not in noise and not re.match(r"^\d+\.\d+$", t)}
            v_cand = {t for t in cand_tokens if t not in noise and not re.match(r"^\d+\.\d+$", t)}
            overlap = len(v_fipe & v_cand)
            base_compatible.append((cand, cand_lit, overlap))

        if not base_compatible:
            continue

        best_cand = None
        best_score = -1e9
        best_version_overlap = 0

        for max_year_diff in (2, 3, 4):
            in_window = [
                item for item in base_compatible
                if abs(ano_eff - int(item[0]["ano_ciclo"])) <= max_year_diff
            ]
            if not in_window:
                continue
            has_same_turbo_in_window = any(
                bool(item[0]["is_turbo"]) == fipe_turbo for item in in_window
            )

            for cand, cand_lit, overlap in in_window:
                year_diff = abs(ano_eff - int(cand["ano_ciclo"]))
                cand_turbo = bool(cand["is_turbo"])
                cand_auto = bool(cand["is_automatico"])
                cand_prop_norm = normalize_text(cand["propulsao"])

                # Evitar falso positivo entre aspirado e turbo, exceto quando:
                # - for elétrico/híbrido (INMETRO frequentemente omite 'T' em motorizações híbridas; elétricos Porsche usam "Turbo" como versão)
                # - for Diesel (INMETRO omite 'T' em picapes diesel como S10/Ranger/Frontier)
                # - litragem >= 2.0 ou houver match de versão com transmissão compatível
                # - nenhum candidato compatível na janela possuir a mesma flag de turbo (omissão de 'T' no PDF do INMETRO)
                if fipe_turbo != cand_turbo:
                    is_electric = ff_norm == "eletrico" or cand["combustivel"] == "E"
                    is_hybrid = (
                        ff_norm == "hibrido"
                        or "hibrid" in cand_prop_norm
                        or "plug" in cand_prop_norm
                        or "hibrido" in model_lower
                        or "hybrid" in model_lower
                    )
                    is_diesel = cand["combustivel"] == "D" or "diesel" in model_lower or "die." in model_lower or "dies" in model_lower
                    lit_num = float(fipe_lit) if fipe_lit else 0.0
                    trans_match = (fipe_auto == cand_auto) or trans_ambiguous
                    if (
                        not is_electric
                        and not is_hybrid
                        and not is_diesel
                        and lit_num < 2.0
                        and not (overlap >= 1 and trans_match)
                        and has_same_turbo_in_window
                    ):
                        continue

                score = 0.0
                if cand["_family"] == fam:
                    score += 20.0
                if fipe_lits and cand_lit and cand_lit in fipe_lits:
                    score += 12.0
                if fipe_turbo == cand_turbo:
                    score += 25.0
                # Proximidade de ano (peso forte)
                if year_diff == 0:
                    score += 30.0
                elif year_diff == 1:
                    score += 18.0 if int(cand["ano_ciclo"]) <= ano_eff else 12.0
                elif year_diff == 2:
                    score += 4.0
                else:
                    score -= float(year_diff) * 4.0

                # Match de transmissão quando FIPE é ambíguo (nem auto nem manual explícito)
                if fipe_auto == cand_auto:
                    score += 15.0

                # Match de combustível exato (Flex vs Flex, Gasolina vs Gasolina)
                if ff_norm == "flex" and cand["combustivel"] == "F":
                    score += 10.0
                elif ff_norm == "gasolina" and cand["combustivel"] == "G":
                    score += 10.0
                elif ff_norm == "hibrido":
                    wants_plugin = "phev" in fipe_tokens or "plug" in model_lower
                    wants_hev = "hev" in fipe_tokens
                    if wants_plugin and "plug" in cand_prop_norm:
                        score += 22.0
                    elif wants_hev and "hibrid" in cand_prop_norm:
                        score += 20.0
                    elif "hibrid" in cand_prop_norm or "plug" in cand_prop_norm:
                        score += 15.0

                score += overlap * 12.0

                if score > best_score:
                    best_score = score
                    best_cand = cand
                    best_version_overlap = overlap

            if best_cand is not None:
                break

        if best_cand is not None:
            is_exact = best_version_overlap >= 1 and abs(ano_eff - int(best_cand["ano_ciclo"])) <= 1
            match_type = "versao_exata" if is_exact else "conjunto_mecanico"
            if is_exact:
                exact_count += 1
            else:
                mech_count += 1

            # Para carros 100% elétricos sem campo gasolina, manter campos separados
            nota = best_cand.get("nota_geral") or best_cand.get("nota_categoria")
            matches.append({
                "codigo_fipe": row.codigo_fipe,
                "ano_modelo": ano_modelo,
                "consumo_urbano_gasolina": best_cand.get("consumo_urbano_gasolina"),
                "consumo_rodoviario_gasolina": best_cand.get("consumo_rodoviario_gasolina"),
                "consumo_urbano_etanol": best_cand.get("consumo_urbano_etanol"),
                "consumo_rodoviario_etanol": best_cand.get("consumo_rodoviario_etanol"),
                "consumo_urbano_eletrico": best_cand.get("consumo_urbano_eletrico"),
                "consumo_rodoviario_eletrico": best_cand.get("consumo_rodoviario_eletrico"),
                "eficiencia_mj_km": best_cand.get("eficiencia_mj_km"),
                "autonomia_km": best_cand.get("autonomia_km"),
                "nota_pbe": nota,
                "selo_conpet": bool(best_cand.get("selo_conpet", False)),
                "match_consumo": match_type,
                "ano_pbev": int(best_cand["ano_ciclo"]),
            })

    matches_df = pd.DataFrame(matches)
    if not matches_df.empty:
        matches_df = matches_df.drop_duplicates(subset=["codigo_fipe", "ano_modelo"])
        matches_df["autonomia_km"] = matches_df["autonomia_km"].astype("Int64")
    matches_df.to_parquet(MATCHES_PARQUET, index=False, compression="zstd")

    total_fipe = len(fipe_df)
    total_matched = len(matches_df)
    pct = (total_matched / total_fipe * 100.0) if total_fipe else 0.0
    print(f"[✓] Matches salvos em {MATCHES_PARQUET}")
    print(f"    - Cobertura total FIPE (>=2009): {total_matched:,} / {total_fipe:,} ({pct:.1f}%)")
    print(f"    - Match versão exata    : {exact_count:,}")
    print(f"    - Match conjunto mecân. : {mech_count:,}")
    return matches_df


def main():
    parser = argparse.ArgumentParser(description="Parser PBEV INMETRO (2010–2026) e matcher com base FIPE")
    parser.add_argument("--force-download", action="store_true", help="Força re-download dos PDFs do INMETRO")
    parser.add_argument("--skip-parse", action="store_true", help="Reutiliza data/inmetro-pbev.parquet existente")
    parser.add_argument(
        "--fipe-parquet",
        type=str,
        default=os.path.join(DATA_DIR, "fipex-prices.parquet"),
        help="Caminho do arquivo Parquet da FIPE para cruzamento",
    )
    args = parser.parse_args()

    if args.skip_parse and os.path.exists(INMETRO_PARQUET):
        inmetro_df = pd.read_parquet(INMETRO_PARQUET)
    else:
        inmetro_df = build_inmetro_parquet(force_download=args.force_download)

    fipe_path = args.fipe_parquet
    if not os.path.exists(fipe_path):
        alt = os.path.join(DATA_DIR, "fipex-prices-enriched.parquet")
        if os.path.exists(alt):
            fipe_path = alt
    if not os.path.exists(fipe_path):
        raise FileNotFoundError(f"Arquivo FIPE Parquet não encontrado: {fipe_path}")

    match_fipe_with_inmetro(fipe_path, inmetro_df)


if __name__ == "__main__":
    main()
