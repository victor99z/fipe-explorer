from fastapi import APIRouter
from backend.core.constants import PRESETS_DATA

router = APIRouter(tags=["Presets"])

@router.get("/presets")
def get_presets():
    return PRESETS_DATA
