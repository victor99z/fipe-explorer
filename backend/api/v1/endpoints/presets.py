from fastapi import APIRouter
from backend.core.constants import PRESETS_DATA

router = APIRouter()

@router.get("/presets")
def get_presets():
    return PRESETS_DATA
