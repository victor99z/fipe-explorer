from typing import Optional, Tuple
from backend.core.constants import RE_AUTO, RE_MANUAL, RE_TURBO, RE_ENGINE

def determine_transmission_label(is_automatico: bool, is_manual: bool) -> str:
    """Returns readable transmission type description."""
    if is_automatico:
        return "Automático"
    elif is_manual:
        return "Manual"
    return "Manual/Indefinido"

def infer_specs_from_name(nome_modelo: str) -> Tuple[Optional[str], bool, bool, bool]:
    """Fallback specification extractor for non-enriched datasets."""
    eng_match = RE_ENGINE.search(nome_modelo or "")
    eng_size = eng_match.group(1) if eng_match else None
    is_turbo = bool(RE_TURBO.search(nome_modelo or ""))
    is_auto = bool(RE_AUTO.search(nome_modelo or ""))
    is_manual = bool(RE_MANUAL.search(nome_modelo or ""))
    return eng_size, is_turbo, is_auto, is_manual
