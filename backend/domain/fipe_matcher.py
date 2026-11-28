"""
Domain matcher for mapping scraped vehicle listings to official FIPE catalog entries.

Design goals:
- Handle FIPE's aggressive character-limit abbreviations (e.g., PREM., Comfor., Hig.,
  Long., Overl., Sed., TIT., Diamo., Aut., Mec., Dies., Híb., High.CD, TIT./TIT.Plus).
- Separate structured mechanical attributes (engine displacement, transmission, turbo,
  fuel/powertrain, body style, drivetrain, doors group, power cv) from identity & trim
  tokens so noise tokens (4p/5p, 16v, Hi-Flex, Total, Geração) never overpower real
  trims (Premier, Highline, Comfortline, LTZ, Altis, Touring, Overland, Platinum, etc.).
- Strongly penalize explicit contradictions (manual vs auto, hatch vs sedan, turbo vs
  aspirated, engine size mismatch, diesel/hybrid/electric mismatch, conflicting trims).
- Pre-index catalog by (year, normalized_brand) for fast matching.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, List, Optional, Set, Tuple

from backend.domain.calculations import format_currency

_BRAND_ALIAS_MAP: Dict[str, Tuple[str, ...]] = {
    "volkswagen": ("vw - volkswagen", "volkswagen"),
    "vw": ("vw - volkswagen", "volkswagen"),
    "chevrolet": ("gm - chevrolet", "chevrolet"),
    "gm": ("gm - chevrolet", "chevrolet"),
    "citroen": ("citroen",),
    "caoa chery": ("caoa chery", "caoa chery/chery", "chery"),
    "chery": ("caoa chery", "caoa chery/chery", "chery"),
    "kia": ("kia motors", "kia"),
    "kia motors": ("kia motors", "kia"),
    "mercedes-benz": ("mercedes-benz",),
    "mercedes": ("mercedes-benz",),
    "land rover": ("land rover",),
    "gwm": ("gwm", "great wall"),
    "great wall": ("gwm", "great wall"),
    "changan": ("caoa changan", "changan"),
    "caoa changan": ("caoa changan", "changan"),
    "mini": ("mini",),
    "ram": ("ram",),
    "smart": ("smart",),
    "byd": ("byd",),
    "jaecoo": ("jaecoo",),
    "omoda": ("omoda",),
    "jetour": ("jetour",),
    "gac": ("gac",),
    "geely": ("geely",),
    "zeekr": ("zeekr",),
    "leapmotor": ("leapmotor",),
    "denza": ("denza",),
}

# Compound terms normalized before splitting punctuation so "T-Cross" == "TCross",
# "HR-V" == "HRV", "I-Motion" == "I MOTION", "Hi-Flex" == "hiflex", etc.
_COMPOUND_PATTERNS: Tuple[Tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bt[\s\-]+cross\b"), "tcross"),
    (re.compile(r"\bhr[\s\-]+v\b"), "hrv"),
    (re.compile(r"\bcr[\s\-]+v\b"), "crv"),
    (re.compile(r"\bwr[\s\-]+v\b"), "wrv"),
    (re.compile(r"\bzr[\s\-]+v\b"), "zrv"),
    (re.compile(r"\bx[\s\-]+trail\b"), "xtrail"),
    (re.compile(r"\br[\s\-]+line\b"), "rline"),
    (re.compile(r"\bs[\s\-]+line\b"), "sline"),
    (re.compile(r"\bx[\s\-]+line\b"), "xline"),
    (re.compile(r"\bs[\s\-\.]+tr(?:on(?:ic)?)?\.?(?=\s|$|[/(),\-])"), "stronic"),
    (re.compile(r"\bg[\s\-\.]+tr(?:on(?:ic)?)?\.?(?=\s|$|[/(),\-])"), "gtronic"),
    (re.compile(r"\be[\s\-]+tron\b"), "etron"),
    (re.compile(r"\bi[\s\-]+moti(?:on)?\.?\b"), "imotion"),
    (re.compile(r"\be[\s\-]+cvt\b"), "ecvt"),
    (re.compile(r"\bhi[\s\-]+flex\b"), "hiflex"),
    (re.compile(r"\btotal[\s\-]+flex\b"), "flex"),
    (re.compile(r"\bt\.?\s*flex\b"), "flex"),
    (re.compile(r"\bti[\s\-]+vct\b"), "tivct"),
    (re.compile(r"\bt[\s\-]+gdi\b"), "tgdi"),
    (re.compile(r"\b4[\s\-]+matic\b"), "4matic"),
    (re.compile(r"\be[\s\-]+pace\b"), "epace"),
    (re.compile(r"\bf[\s\-]+pace\b"), "fpace"),
    (re.compile(r"\bf[\s\-]+type\b"), "ftype"),
    (re.compile(r"\bm[\s\-]+sport\b"), "msport"),
    (re.compile(r"\bf[\s\-]+sport\b"), "fsport"),
    (re.compile(r"\br[\s\-]+sport\b"), "rsport"),
    (re.compile(r"\br[\s\-]+dyn(?:amic)?\.?\b"), "rdynamic"),
    (re.compile(r"\btd[\s\-]+(350|380)\b"), r"td\1"),
    (re.compile(r"\bka\s*\+"), "kaplus"),
    (re.compile(r"\bbl\."), "black"),
    (re.compile(r"\bcabine\s+dupla\b"), "cd"),
    (re.compile(r"\bcabine\s+simples\b"), "cs"),
    (re.compile(r"\bcabine\s+estendida\b"), "ce"),
    (re.compile(r"\bc/\s*ar\b"), ""),
)

# Explicit FIPE typo / abbreviation canonicalizations (applied after dot stripping).
_EXPLICIT_TOKEN_MAP: Dict[str, str] = {
    "highi": "highline",
    "highli": "highline",
    "hig": "highline",
    "comfor": "comfortline",
    "comf": "comfortline",
    "prem": "premier",
    "premiu": "premium",
    "overl": "overland",
    "overla": "overland",
    "diamo": "diamond",
    "diam": "diamond",
    "tit": "titanium",
    "plat": "platinum",
    "plati": "platinum",
    "dyn": "dynamique",
    "dyna": "dynamique",
    "excl": "exclusive",
    "exc": "exclusive",
    "exec": "executive",
    "expres": "expression",
    "express": "expression",
    "prest": "prestige",
    "priv": "privilege",
    "privil": "privilege",
    "attra": "attractive",
    "attract": "attractive",
    "essen": "essence",
    "inten": "intense",
    "perf": "performance",
    "perfo": "performance",
    "celeb": "celebration",
    "bus": "business",
    "sportb": "sportback",
    "sb": "sportback",
    "autob": "autobiography",
    "autobio": "autobiography",
    "insc": "inscription",
    "laram": "laramie",
    "step": "stepway",
    "week": "weekend",
    "outd": "outdoor",
    "evol": "evolution",
    "lux": "luxury",
    "quat": "quattro",
    "quatt": "quattro",
    "qt": "quattro",
    "superchar": "supercharged",
    "supercharg": "supercharged",
    "turboch": "turbo",
    "blind": "blindado",
    "ltd": "limited",
    "lim": "limited",
    "lon": "longitude",
    "long": "longitude",
    "edicao": "edition",
    "edit": "edition",
    "ed": "edition",
    "hatchback": "hatch",
    "hb": "hatch",
    "sed": "sedan",
    "seda": "sedan",
    "furg": "furgao",
    "cabriolet": "cabrio",
    "conversivel": "cabrio",
    "spyder": "cabrio",
    "spider": "cabrio",
    "roadster": "cabrio",
    "tb": "turbo",
    "biturbo": "turbo",
    "twinpower": "turbo",
    "aut": "auto",
    "automatico": "auto",
    "automatica": "auto",
    "mec": "manual",
    "mecanico": "manual",
    "mecanica": "manual",
    "die": "diesel",
    "dies": "diesel",
    "hib": "hibrido",
    "hybrid": "hibrido",
    "hibryd": "hibrido",
    "hibrida": "hibrido",
    "phev": "hibrido",
    "hev": "hibrido",
    "mhev": "hibrido",
    "reev": "hibrido",
    "ele": "eletrico",
    "eletrica": "eletrico",
    "electric": "eletrico",
    "bev": "eletrico",
    "ev": "eletrico",
    "gas": "gasolina",
    "alc": "etanol",
    "alcool": "etanol",
    "flexp": "flex",
    "flexpower": "flex",
    "hiflex": "flex",
    "econoflex": "flex",
    "econo": "flex",
    "dual": "dualogic",
    "tip": "tiptronic",
    "tiptr": "tiptronic",
    "grs": "grsport",
    "gr": "grsport",
}

# Meaningful single-letter automotive trims/classes preserved during tokenization.
_SINGLE_LETTER_TRIMS: FrozenSet[str] = frozenset({"s", "r", "x", "m", "z"})

# Peugeot / numeric models that look like 4-digit years.
_NUMERIC_YEAR_LIKE_MODELS: FrozenSet[str] = frozenset({"2008", "3008", "5008"})

# Tokens representing structured specs or noise that should NOT be treated as trim/identity tokens.
_SPEC_AND_NOISE_TOKENS: FrozenSet[str] = frozenset(
    {
        # Transmissions
        "auto",
        "manual",
        "cvt",
        "ecvt",
        "tiptronic",
        "dsg",
        "stronic",
        "gtronic",
        "steptronic",
        "powershift",
        "pdk",
        "multitronic",
        "geartronic",
        "xtronic",
        "automatizado",
        "imotion",
        "dualogic",
        "easytronic",
        "autoshift",
        "mt",
        "at",
        "at6",
        "at8",
        "at9",
        "mt5",
        "mt6",
        # Fuels / powertrains
        "flex",
        "gasolina",
        "diesel",
        "etanol",
        "hibrido",
        "eletrico",
        "gnv",
        "mi",
        "mpfi",
        "efi",
        "vvt",
        "vvti",
        "vtec",
        "ivtec",
        "tivct",
        "dohc",
        "sohc",
        "sce",
        "fire",
        "firefly",
        "msi",
        "ea211",
        "spe",
        "ecotec",
        "duratec",
        "rocam",
        "sigma",
        "zetec",
        "multijet",
        "jtd",
        "bluehdi",
        "e5",
        "e6",
        # Turbo / engine buzzwords
        "turbo",
        "tsi",
        "tfsi",
        "tfsie",
        "tgdi",
        "thp",
        "tce",
        "ecoboost",
        "tdi",
        "cdi",
        "hdi",
        "cgi",
        "kompressor",
        "gdi",
        "v6",
        "v8",
        "v10",
        "v12",
        "w12",
        # Body / doors / drivetrain (scored structurally)
        "hatch",
        "sedan",
        "cd",
        "cs",
        "ce",
        "sw",
        "wagon",
        "perua",
        "cabrio",
        "coupe",
        "furgao",
        "picape",
        "pickup",
        "suv",
        "2p",
        "3p",
        "4p",
        "5p",
        "2e4p",
        "4x4",
        "4x2",
        "awd",
        "4wd",
        "fwd",
        "rwd",
        "4motion",
        "4matic",
        "xdrive",
        "allgrip",
        "quattro",
        "4xe",
        # Valves / power / generic labels
        "8v",
        "12v",
        "16v",
        "20v",
        "24v",
        "32v",
        "cv",
        "hp",
        "kw",
        "novo",
        "nova",
        "geracao",
        "ger",
        "g1",
        "g2",
        "g3",
        "g4",
        "g5",
        "g6",
        "g7",
        "g8",
        "ii",
        "iii",
        "iv",
        "vi",
        "vii",
        "viii",
        "modelo",
        "ano",
        "completo",
        "completa",
        "unico",
        "dono",
        "impecavel",
        "revisado",
        "revisada",
        "urgente",
        "repasse",
        "abaixo",
        "fipe",
        "oportunidade",
        "oferta",
        "promocao",
        "garantia",
        "periciado",
        "periciada",
        "laudo",
        "cautelar",
        "aprovado",
        "conservado",
        "sem",
        "detalhes",
        "uber",
        "ideal",
        "para",
        "com",
        "teto",
        "solar",
        "couro",
        "multimidia",
        "camera",
        "sensor",
        "chave",
        "presenca",
        "banco",
        "bancos",
        "roda",
        "rodas",
        "liga",
        "leve",
        "ipva",
        "pago",
        "licenciado",
        "nota",
        "fiscal",
        "baixa",
        "km",
        "original",
        "super",
        "lindo",
        "linda",
        "top",
        "linha",
        "portas",
        "porta",
        "ar",
        "condicionado",
        "direcao",
        "hidraulica",
        "vidro",
        "vidros",
        "trava",
        "travas",
        "alarme",
        "abs",
        "airbag",
        "airbags",
        "zero",
        "0km",
        "carro",
        "veiculo",
        "total",
        "especial",
        # Common listing color spam
        "branco",
        "branca",
        "preto",
        "preta",
        "prata",
        "cinza",
        "vermelho",
        "vermelha",
        "azul",
        "verde",
        "amarelo",
        "amarela",
        "bege",
        "marrom",
        "dourado",
        "dourada",
        "vinho",
        "laranja",
        "grafite",
        "chumbo",
        "perola",
    }
)

_RE_ENGINE_SIZE = re.compile(r"(?<![a-z0-9.])([1-6]\.[0-9])(?![0-9.])")
_RE_POWER_CV = re.compile(r"^(\d{2,4})cv$")
_RE_POWER_KW = re.compile(r"^(\d{2,4})kw$")
_RE_YEAR_TOKEN = re.compile(r"^(?:19[5-9]\d|20[0-3]\d)$")
_RE_GLUED_ALPHA_ENGINE = re.compile(r"\b([a-z]{2,})([1-6]\.[0-9])\b")
_RE_GLUED_DOT_WORDS = re.compile(r"([a-z]{2,})\.([a-z]{2,})")
_RE_DOT_ABBREV = re.compile(r"\b([a-z]{3,})\.(?=\s|$|[/(),\-])")

_AUTO_TOKENS = frozenset(
    {
        "auto",
        "tiptronic",
        "dsg",
        "stronic",
        "gtronic",
        "steptronic",
        "powershift",
        "pdk",
        "multitronic",
        "geartronic",
        "autoshift",
        "at6",
        "at8",
        "at9",
    }
)
_CVT_TOKENS = frozenset({"cvt", "ecvt", "xtronic"})
_AUTOMATED_TOKENS = frozenset({"automatizado", "imotion", "dualogic", "easytronic"})
_MANUAL_TOKENS = frozenset({"manual", "mt5", "mt6"})

_TURBO_TOKENS = frozenset(
    {
        "turbo",
        "tsi",
        "tfsi",
        "tfsie",
        "tgdi",
        "thp",
        "tce",
        "ecoboost",
        "t200",
        "t270",
        "tdi",
        "td350",
        "td380",
        "cgi",
        "kompressor",
    }
)

_AWD_TOKENS = frozenset({"4x4", "awd", "4wd", "quattro", "4motion", "4matic", "xdrive", "allgrip", "4xe"})
_TWO_WD_TOKENS = frozenset({"4x2", "fwd", "rwd"})


@dataclass(frozen=True, slots=True)
class ParsedCarSpecs:
    all_tokens: FrozenSet[str]
    sig_tokens: FrozenSet[str]
    abbrev_tokens: FrozenSet[str]
    engine_size: Optional[str]
    transmission: Optional[str]  # "auto" | "cvt" | "automated" | "manual"
    is_turbo: bool
    body_type: Optional[str]  # "hatch" | "sedan" | "cd" | "cs" | "ce" | "sw" | "cabrio" | "coupe" | "furgao"
    fuel: Optional[str]  # "electric" | "hybrid" | "diesel" | "flex" | "gasolina" | "etanol"
    drivetrain: Optional[str]  # "4x4" | "4x2"
    doors_group: Optional[str]  # "2_3" | "4_5"
    power_cvs: FrozenSet[str]  # e.g. {"180"}, {"252", "265"}


@dataclass(frozen=True, slots=True)
class FipeCatalogEntry:
    codigo_fipe: str
    nome_marca: str
    nome_modelo: str
    ano_modelo: int
    nome_combustivel: Optional[str]
    valor: float
    mes_referencia: int
    ano_referencia: int
    norm_brand: str
    brand_tokens: FrozenSet[str]
    specs: ParsedCarSpecs
    slash_branches: Tuple[FrozenSet[str], ...]


@dataclass(frozen=True, slots=True)
class YearCatalogBucket:
    all_entries: Tuple[FipeCatalogEntry, ...]
    by_brand: Dict[str, Tuple[FipeCatalogEntry, ...]]


def strip_accents_lower(text: str) -> str:
    nfd = unicodedata.normalize("NFD", text or "")
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn").lower()


def brand_matches(item_brand: Optional[str], fipe_brand: str) -> bool:
    if not item_brand:
        return True
    norm_item = strip_accents_lower(item_brand).strip()
    norm_fipe = strip_accents_lower(fipe_brand).strip()
    if norm_item == norm_fipe or norm_item in norm_fipe or norm_fipe in norm_item:
        return True
    aliases = _BRAND_ALIAS_MAP.get(norm_item, ())
    return any(alias in norm_fipe for alias in aliases)


def build_year_buckets(entries: List[FipeCatalogEntry]) -> Dict[int, YearCatalogBucket]:
    raw_by_year: Dict[int, List[FipeCatalogEntry]] = {}
    for e in entries:
        raw_by_year.setdefault(e.ano_modelo, []).append(e)

    buckets: Dict[int, YearCatalogBucket] = {}
    for yr, yr_entries in raw_by_year.items():
        brand_map: Dict[str, List[FipeCatalogEntry]] = {}
        for e in yr_entries:
            brand_map.setdefault(e.norm_brand, []).append(e)
        buckets[yr] = YearCatalogBucket(
            all_entries=tuple(yr_entries),
            by_brand={b: tuple(lst) for b, lst in brand_map.items()},
        )
    return buckets


def _preprocess_text(text: str) -> str:
    clean = strip_accents_lower(text)
    # Separate glued dot abbreviations like "high.cd", "tit.plus", "perf.bl." BEFORE compound patterns
    clean = _RE_GLUED_DOT_WORDS.sub(r"\1. \2", clean)
    for pattern, repl in _COMPOUND_PATTERNS:
        clean = pattern.sub(repl, clean)
    # Separate glued alpha+displacement like "cd2.0" or "plus1.6" -> "cd 2.0", "plus 1.6"
    clean = _RE_GLUED_ALPHA_ENGINE.sub(r"\1 \2", clean)
    return clean


def _canonicalize_token(raw: str) -> str:
    return _EXPLICIT_TOKEN_MAP.get(raw, raw)


def _extract_tokens_and_abbrevs(
    clean_text: str,
    exclude_brand_tokens: FrozenSet[str] = frozenset(),
    keep_numeric_models: bool = True,
) -> Tuple[Set[str], Set[str], Optional[str], Set[str]]:
    # Capture dot-abbreviated tokens before removing dots (e.g. "prem.", "comfor.", "diamo.").
    raw_abbrevs: Set[str] = set()
    for m in _RE_DOT_ABBREV.finditer(clean_text):
        stem = m.group(1)
        if stem not in ("aut", "mec", "die", "dies", "hib", "ele", "gas", "alc", "sed"):
            raw_abbrevs.add(stem)

    # Extract engine displacement (first valid 1.0..6.9)
    eng_match = _RE_ENGINE_SIZE.search(clean_text)
    engine_size = eng_match.group(1) if eng_match else None

    # Protect valid engine sizes using lowercase sentinel so lowercase split preserves them intact
    protected = _RE_ENGINE_SIZE.sub(lambda m: m.group(1).replace(".", "__dot__"), clean_text)
    parts = [p for p in re.split(r"[^a-z0-9_]+", protected) if p]

    all_tokens: Set[str] = set()
    abbrev_tokens: Set[str] = set()
    power_cvs: Set[str] = set()

    for p in parts:
        tok = p.replace("__dot__", ".")
        if not tok:
            continue
        if len(tok) == 1 and tok not in _SINGLE_LETTER_TRIMS and not tok.isdigit():
            continue
        cv_m = _RE_POWER_CV.match(tok)
        if cv_m:
            power_cvs.add(cv_m.group(1))
            continue
        if _RE_POWER_KW.match(tok):
            continue
        if _RE_YEAR_TOKEN.match(tok) and not (keep_numeric_models and tok in _NUMERIC_YEAR_LIKE_MODELS):
            continue

        was_abbrev = tok in raw_abbrevs
        canon = _canonicalize_token(tok)
        all_tokens.add(canon)
        if was_abbrev:
            abbrev_tokens.add(tok)
            if canon != tok:
                abbrev_tokens.add(canon)

        # Emit split numeric part for "td350"/"td380"
        if canon in ("td350", "td380"):
            all_tokens.add(canon[2:])

    abbrev_tokens -= exclude_brand_tokens
    return all_tokens, abbrev_tokens, engine_size, power_cvs


def _infer_structured_specs(
    all_tokens: Set[str],
    abbrev_tokens: Set[str],
    engine_size: Optional[str],
    power_cvs: Set[str],
    exclude_brand_tokens: FrozenSet[str] = frozenset(),
    explicit_fuel: Optional[str] = None,
    explicit_transmission: Optional[str] = None,
) -> ParsedCarSpecs:
    # 1. Transmission
    trans: Optional[str] = None
    explicit_t = strip_accents_lower(explicit_transmission or "").strip()
    if explicit_t:
        if "cvt" in explicit_t:
            trans = "cvt"
        elif "automatiz" in explicit_t:
            trans = "automated"
        elif "auto" in explicit_t:
            trans = "auto"
        elif "man" in explicit_t or "mec" in explicit_t:
            trans = "manual"

    if all_tokens & _CVT_TOKENS:
        trans = "cvt"
    elif all_tokens & _AUTOMATED_TOKENS:
        trans = "automated"
    elif trans is None:
        if all_tokens & _AUTO_TOKENS:
            trans = "auto"
        elif all_tokens & _MANUAL_TOKENS:
            trans = "manual"

    # 2. Fuel / Powertrain
    fuel: Optional[str] = None
    explicit_f = strip_accents_lower(explicit_fuel or "").strip()
    if "hibrid" in explicit_f or "hybrid" in explicit_f:
        fuel = "hybrid"
    elif "eletric" in explicit_f:
        fuel = "electric"
    elif "diesel" in explicit_f:
        fuel = "diesel"
    elif "flex" in explicit_f:
        fuel = "flex"
    elif "gasolina" in explicit_f:
        fuel = "gasolina"
    elif "etanol" in explicit_f or "alcool" in explicit_f:
        fuel = "etanol"

    if "hibrido" in all_tokens:
        fuel = "hybrid"
    elif "eletrico" in all_tokens and fuel != "hybrid":
        fuel = "electric"
    elif "diesel" in all_tokens and fuel is None:
        fuel = "diesel"
    elif "flex" in all_tokens and fuel is None:
        fuel = "flex"
    elif "gasolina" in all_tokens and fuel is None:
        fuel = "gasolina"
    elif "etanol" in all_tokens and fuel is None:
        fuel = "etanol"

    # 3. Turbo
    is_turbo = bool(all_tokens & _TURBO_TOKENS)

    # 4. Body type
    body_type: Optional[str] = None
    if "sedan" in all_tokens:
        body_type = "sedan"
    elif "hatch" in all_tokens:
        body_type = "hatch"
    elif "cd" in all_tokens:
        body_type = "cd"
    elif "cs" in all_tokens:
        body_type = "cs"
    elif "ce" in all_tokens:
        body_type = "ce"
    elif "furgao" in all_tokens:
        body_type = "furgao"
    elif "sw" in all_tokens or "wagon" in all_tokens or "perua" in all_tokens:
        body_type = "sw"
    elif "cabrio" in all_tokens:
        body_type = "cabrio"
    elif "coupe" in all_tokens:
        body_type = "coupe"

    # 5. Drivetrain
    drivetrain: Optional[str] = None
    if all_tokens & _AWD_TOKENS:
        drivetrain = "4x4"
    elif all_tokens & _TWO_WD_TOKENS:
        drivetrain = "4x2"

    # 6. Doors group ("2_3" vs "4_5" — note 4p on OLX hatches corresponds to 5p on FIPE)
    doors_group: Optional[str] = None
    has_23 = bool(all_tokens & {"2p", "3p"})
    has_45 = bool(all_tokens & {"4p", "5p"})
    if has_45 and not has_23:
        doors_group = "4_5"
    elif has_23 and not has_45:
        doors_group = "2_3"

    # 7. Significant identity & trim tokens
    sig_tokens: Set[str] = set()
    for tok in all_tokens:
        if tok in _SPEC_AND_NOISE_TOKENS or tok in exclude_brand_tokens:
            continue
        if engine_size and tok == engine_size:
            continue
        if _RE_ENGINE_SIZE.fullmatch(tok):
            continue
        sig_tokens.add(tok)

    clean_abbrevs = {a for a in abbrev_tokens if a not in _SPEC_AND_NOISE_TOKENS and a not in exclude_brand_tokens}

    return ParsedCarSpecs(
        all_tokens=frozenset(all_tokens),
        sig_tokens=frozenset(sig_tokens),
        abbrev_tokens=frozenset(clean_abbrevs),
        engine_size=engine_size,
        transmission=trans,
        is_turbo=is_turbo,
        body_type=body_type,
        fuel=fuel,
        drivetrain=drivetrain,
        doors_group=doors_group,
        power_cvs=frozenset(power_cvs),
    )


def _extract_slash_branches(
    nome_modelo: str,
    base_sig: FrozenSet[str],
    brand_tokens: FrozenSet[str],
) -> Tuple[FrozenSet[str], ...]:
    """
    When FIPE packs alternative trims into one name via '/' (e.g.,
    "Corolla ALTIS/A.Premiu. 2.0", "Fiesta TIT./TIT.Plus 1.6",
    "Gol (novo) 1.6 Power/Highi T.Flex"), produce one candidate sig_token set
    per alternative so matching one side isn't penalized by the other side.
    """
    if "/" not in nome_modelo:
        return ()

    clean = _preprocess_text(nome_modelo)
    slash_groups = re.findall(r"[a-z0-9.]+(?:/[a-z0-9.]+)+", clean)
    alt_sets: List[List[Set[str]]] = []
    for grp in slash_groups:
        alts = grp.split("/")
        parsed_alts: List[Set[str]] = []
        for alt in alts:
            toks, _, _, _ = _extract_tokens_and_abbrevs(alt, exclude_brand_tokens=brand_tokens)
            sig = {t for t in toks if t not in _SPEC_AND_NOISE_TOKENS and not _RE_ENGINE_SIZE.fullmatch(t)}
            if sig:
                parsed_alts.append(sig)
        if len(parsed_alts) >= 2:
            alt_sets.append(parsed_alts)

    if not alt_sets:
        return ()

    first_alts = alt_sets[0]
    union_group = set().union(*first_alts)
    common = set(base_sig) - union_group
    return tuple(frozenset(common | alt) for alt in first_alts if (common | alt))


def build_fipe_catalog_entry(
    codigo_fipe: str,
    nome_marca: str,
    nome_modelo: str,
    ano_modelo: int,
    nome_combustivel: Optional[str],
    valor: float,
    mes_referencia: int,
    ano_referencia: int,
) -> FipeCatalogEntry:
    norm_brand = strip_accents_lower(nome_marca).strip()
    brand_toks_raw, _, _, _ = _extract_tokens_and_abbrevs(_preprocess_text(nome_marca))
    brand_tokens = frozenset(brand_toks_raw | {"gm", "vw", "motors"})

    clean_model = _preprocess_text(f"{nome_modelo} {nome_combustivel or ''}")
    all_toks, abbrev_toks, eng, power_cvs = _extract_tokens_and_abbrevs(
        clean_model,
        exclude_brand_tokens=brand_tokens,
    )
    specs = _infer_structured_specs(
        all_tokens=all_toks,
        abbrev_tokens=abbrev_toks,
        engine_size=eng,
        power_cvs=power_cvs,
        exclude_brand_tokens=brand_tokens,
        explicit_fuel=nome_combustivel,
    )
    slash_branches = _extract_slash_branches(nome_modelo, specs.sig_tokens, brand_tokens)

    return FipeCatalogEntry(
        codigo_fipe=codigo_fipe,
        nome_marca=nome_marca,
        nome_modelo=nome_modelo,
        ano_modelo=ano_modelo,
        nome_combustivel=nome_combustivel,
        valor=valor,
        mes_referencia=mes_referencia,
        ano_referencia=ano_referencia,
        norm_brand=norm_brand,
        brand_tokens=brand_tokens,
        specs=specs,
        slash_branches=slash_branches,
    )


def _token_matches_set(
    tok: str,
    target_set: FrozenSet[str],
    tok_is_abbrev: bool,
    target_abbrevs: FrozenSet[str],
) -> bool:
    if tok in target_set:
        return True
    if tok_is_abbrev and len(tok) >= 3:
        for t in target_set:
            if len(t) > len(tok) and t.startswith(tok):
                return True
    for ab in target_abbrevs:
        if len(ab) >= 3 and len(tok) > len(ab) and tok.startswith(ab):
            return True
    if tok == "premier" and ("prem" in target_abbrevs or "prem" in target_set):
        return True
    if tok == "premium" and ("premiu" in target_abbrevs or "prem" in target_abbrevs):
        return True
    return False


def _score_sig_token_sets(
    item_sig: FrozenSet[str],
    item_abbrevs: FrozenSet[str],
    cand_sig: FrozenSet[str],
    cand_abbrevs: FrozenSet[str],
) -> Tuple[float, int, int]:
    """Returns (token_score, unmatched_item_count, unmatched_cand_count)."""
    if not item_sig or not cand_sig:
        return 0.0, len(item_sig), len(cand_sig)

    matched_item = sum(
        1
        for t in item_sig
        if _token_matches_set(t, cand_sig, t in item_abbrevs, cand_abbrevs)
    )
    matched_cand = sum(
        1
        for t in cand_sig
        if _token_matches_set(t, item_sig, t in cand_abbrevs, item_abbrevs)
    )
    if matched_item == 0 or matched_cand == 0:
        return 0.0, len(item_sig), len(cand_sig)

    recall = matched_item / len(item_sig)
    precision = matched_cand / len(cand_sig)
    score = 0.62 * recall + 0.38 * precision
    return score, len(item_sig) - matched_item, len(cand_sig) - matched_cand


def _transmission_family(t: Optional[str]) -> Optional[str]:
    if t in ("auto", "cvt", "automated"):
        return "auto"
    if t == "manual":
        return "manual"
    return None


def _score_candidate(
    item_specs: ParsedCarSpecs,
    model_tokens: FrozenSet[str],
    cand: FipeCatalogEntry,
) -> float:
    cs = cand.specs

    # 1. Require model overlap when model tokens are known
    model_matched = 0
    if model_tokens:
        for mt in model_tokens:
            if _token_matches_set(mt, cs.all_tokens, mt in item_specs.abbrev_tokens, cs.abbrev_tokens):
                model_matched += 1
        if model_matched == 0:
            return -1.0

    # 2. Significant identity + trim token score (evaluating slash branches if present)
    best_tok_score, unm_item, unm_cand = _score_sig_token_sets(
        item_specs.sig_tokens,
        item_specs.abbrev_tokens,
        cs.sig_tokens,
        cs.abbrev_tokens,
    )
    for branch_sig in cand.slash_branches:
        b_score, b_unm_i, b_unm_c = _score_sig_token_sets(
            item_specs.sig_tokens,
            item_specs.abbrev_tokens,
            branch_sig,
            cs.abbrev_tokens,
        )
        if (b_score - 0.14 * b_unm_i - 0.11 * b_unm_c) > (
            best_tok_score - 0.14 * unm_item - 0.11 * unm_cand
        ):
            best_tok_score, unm_item, unm_cand = b_score, b_unm_i, b_unm_c

    if best_tok_score <= 0.0:
        return -1.0

    score = best_tok_score

    # Model coverage bonus
    if model_tokens:
        score += 0.22 * (model_matched / len(model_tokens))

    # Trim discrimination penalties (missing ad's trim or introducing an unmentioned trim)
    score -= min(0.55, 0.18 * unm_item)
    score -= min(0.45, 0.14 * unm_cand)

    # 3. Engine displacement
    if item_specs.engine_size and cs.engine_size:
        if item_specs.engine_size == cs.engine_size:
            score += 0.28
        else:
            score -= 0.55

    # 4. Transmission
    item_tfam = _transmission_family(item_specs.transmission)
    cand_tfam = _transmission_family(cs.transmission)
    if item_tfam and cand_tfam:
        if item_tfam == cand_tfam:
            score += 0.20
            if item_specs.transmission == cs.transmission and item_specs.transmission in ("cvt", "automated"):
                score += 0.08
        else:
            score -= 0.50

    # 5. Turbo
    if item_specs.is_turbo and cs.is_turbo:
        score += 0.20
    elif item_specs.is_turbo and not cs.is_turbo:
        score -= 0.38
    elif not item_specs.is_turbo and cs.is_turbo:
        score -= 0.18

    # 6. Body style (hatch vs sedan, cd vs cs/ce, etc.)
    if item_specs.body_type and cs.body_type:
        if item_specs.body_type == cs.body_type:
            score += 0.25
        elif {item_specs.body_type, cs.body_type} <= {"hatch", "sedan"} or {
            item_specs.body_type,
            cs.body_type,
        } <= {"cd", "cs", "ce"}:
            score -= 0.60
        else:
            score -= 0.25
    elif item_specs.body_type == "sedan" and cs.body_type is None:
        score -= 0.22
    elif item_specs.body_type is None and cs.body_type == "sedan":
        score -= 0.08
    elif item_specs.body_type is None and cs.body_type in ("cabrio", "coupe", "furgao", "sw"):
        score -= 0.30
    elif item_specs.body_type in ("cd", "cs", "ce") and cs.body_type is None:
        score -= 0.15

    # 7. Fuel / Powertrain
    special_fuels = {"diesel", "hybrid", "electric"}
    if item_specs.fuel and cs.fuel:
        if item_specs.fuel == cs.fuel:
            score += 0.30 if item_specs.fuel in special_fuels else 0.06
        elif item_specs.fuel in special_fuels or cs.fuel in special_fuels:
            score -= 0.70
        else:
            score -= 0.08
    elif item_specs.fuel in special_fuels and cs.fuel not in special_fuels:
        score -= 0.65
    elif cs.fuel in special_fuels and item_specs.fuel not in special_fuels:
        score -= 0.45

    # 8. Drivetrain (4x4 vs 4x2)
    if item_specs.drivetrain and cs.drivetrain:
        if item_specs.drivetrain == cs.drivetrain:
            score += 0.18
        else:
            score -= 0.45
    elif item_specs.drivetrain == "4x4" and cs.drivetrain is None:
        score -= 0.18
    elif item_specs.drivetrain is None and cs.drivetrain == "4x4":
        score -= 0.14

    # 9. Doors group tie-breaker (2p/3p vs 4p/5p)
    if item_specs.doors_group and cs.doors_group:
        if item_specs.doors_group == cs.doors_group:
            score += 0.08
        else:
            score -= 0.12

    # 10. Horsepower tie-breaker (e.g. 180cv / 185cv / 272cv special power variants)
    if item_specs.power_cvs and cs.power_cvs:
        if item_specs.power_cvs & cs.power_cvs:
            score += 0.14
        else:
            score -= 0.20
    elif cs.power_cvs and not item_specs.power_cvs:
        score -= 0.04

    return score


def _resolve_brand_candidates(
    item_brand_raw: str,
    bucket: YearCatalogBucket,
    brand_lookup_cache: Dict[Tuple[int, str], Tuple[bool, Tuple[FipeCatalogEntry, ...]]],
    year_int: int,
) -> Tuple[bool, Tuple[FipeCatalogEntry, ...]]:
    """
    Returns (used_brand_filter, candidate_entries) using cached per-(year, brand) lookup.
    """
    if not item_brand_raw:
        return False, bucket.all_entries

    norm_key = strip_accents_lower(item_brand_raw).strip()
    cache_key = (year_int, norm_key)
    cached = brand_lookup_cache.get(cache_key)
    if cached is not None:
        return cached

    matched_entries: List[FipeCatalogEntry] = []
    for fipe_brand, b_entries in bucket.by_brand.items():
        if brand_matches(norm_key, fipe_brand):
            matched_entries.extend(b_entries)

    if matched_entries:
        result = (True, tuple(matched_entries))
    else:
        # Messy brand field (e.g. full listing title stored in `brand`) -> fall back to all brands
        result = (False, bucket.all_entries)

    brand_lookup_cache[cache_key] = result
    return result


def match_listings_against_catalog(
    items: List[Dict[str, Any]],
    by_year: Dict[int, YearCatalogBucket],
) -> Dict[str, Dict[str, Any]]:
    """Match a batch of listing dicts against the pre-indexed FIPE catalog."""
    matches: Dict[str, Dict[str, Any]] = {}
    brand_lookup_cache: Dict[Tuple[int, str], Tuple[bool, Tuple[FipeCatalogEntry, ...]]] = {}

    for item in items:
        item_id = item.get("id")
        yr = item.get("year")
        if not item_id or not yr:
            continue
        year_int = int(yr)
        bucket = by_year.get(year_int)
        if not bucket:
            continue

        item_brand_raw = (item.get("brand") or "").strip()
        item_model_raw = (item.get("model") or "").strip()
        item_version_raw = (item.get("version") or "").strip()
        item_title_raw = (item.get("title") or "").strip()
        item_trans_raw = (item.get("transmission") or "").strip()
        item_fuel_raw = (item.get("fuel") or "").strip()

        use_brand_filter, candidates = _resolve_brand_candidates(
            item_brand_raw,
            bucket,
            brand_lookup_cache,
            year_int,
        )
        if not candidates:
            continue

        brand_toks_raw: Set[str] = set()
        if use_brand_filter:
            brand_toks_raw, _, _, _ = _extract_tokens_and_abbrevs(_preprocess_text(item_brand_raw))
            brand_toks_raw |= {"gm", "vw", "motors"}
        brand_exclude = frozenset(brand_toks_raw)

        combined_text = " ".join(
            x
            for x in (
                item_model_raw,
                item_version_raw,
                item_title_raw,
                item_trans_raw,
                item_fuel_raw,
            )
            if x
        )
        clean_combined = _preprocess_text(combined_text)
        all_toks, abbrev_toks, eng, power_cvs = _extract_tokens_and_abbrevs(
            clean_combined,
            exclude_brand_tokens=brand_exclude,
        )
        item_specs = _infer_structured_specs(
            all_tokens=all_toks,
            abbrev_tokens=abbrev_toks,
            engine_size=eng,
            power_cvs=power_cvs,
            exclude_brand_tokens=brand_exclude,
            explicit_fuel=item_fuel_raw,
            explicit_transmission=item_trans_raw,
        )

        if not item_specs.sig_tokens:
            continue

        model_toks_raw, _, _, _ = _extract_tokens_and_abbrevs(
            _preprocess_text(item_model_raw),
            exclude_brand_tokens=brand_exclude,
        )
        model_tokens = frozenset(
            t for t in model_toks_raw if t not in _SPEC_AND_NOISE_TOKENS and not _RE_ENGINE_SIZE.fullmatch(t)
        )

        best_score = -999.0
        best_cand: Optional[FipeCatalogEntry] = None

        for cand in candidates:
            sc = _score_candidate(item_specs, model_tokens, cand)
            if sc > best_score:
                best_score = sc
                best_cand = cand

        min_threshold = 0.45 if use_brand_filter else 0.70
        if best_cand is not None and best_score >= min_threshold:
            confidence = min(0.99, max(0.35, round(best_score / 1.85, 2)))
            matches[str(item_id)] = {
                "codigo_fipe": best_cand.codigo_fipe,
                "nome_marca": best_cand.nome_marca,
                "nome_modelo": best_cand.nome_modelo,
                "ano_modelo": best_cand.ano_modelo,
                "nome_combustivel": best_cand.nome_combustivel,
                "valor": best_cand.valor,
                "valor_formatado": format_currency(best_cand.valor),
                "periodo_referencia": f"{best_cand.mes_referencia:02d}/{best_cand.ano_referencia}",
                "confidence": confidence,
            }

    return matches
