from typing import Optional, Tuple
from backend.core.constants import RE_AUTO, RE_MANUAL, RE_TURBO, RE_ENGINE

_ELECTRIC_NAME_MARKERS = ("(elétrico)", "(eletrico)", "(eltétrico)", "(életrico)")


def is_electric_vehicle(
    nome_combustivel: Optional[str],
    nome_modelo: Optional[str] = None,
) -> bool:
    """Returns True when the vehicle is 100% electric (BEV), never hybrid."""
    comb = (nome_combustivel or "").strip().lower()
    if comb in ("elétrico", "eletrico"):
        return True
    modelo = (nome_modelo or "").lower()
    return any(marker in modelo for marker in _ELECTRIC_NAME_MARKERS)


def determine_transmission_label(
    is_automatico: bool,
    is_manual: bool,
    is_eletrico: bool = False,
) -> Optional[str]:
    """Returns readable transmission type description, or None for 100% electric vehicles."""
    if is_eletrico:
        return None
    if is_automatico:
        return "Automático"
    elif is_manual:
        return "Manual"
    return "Manual/Indefinido"


def infer_specs_from_name(
    nome_modelo: str,
    nome_combustivel: Optional[str] = None,
) -> Tuple[Optional[str], bool, bool, bool]:
    """Fallback specification extractor for non-enriched datasets."""
    if is_electric_vehicle(nome_combustivel, nome_modelo):
        return None, False, False, False
    eng_match = RE_ENGINE.search(nome_modelo or "")
    eng_size = eng_match.group(1) if eng_match else None
    is_turbo = bool(RE_TURBO.search(nome_modelo or ""))
    is_auto = bool(RE_AUTO.search(nome_modelo or ""))
    is_manual = bool(RE_MANUAL.search(nome_modelo or ""))
    return eng_size, is_turbo, is_auto, is_manual
