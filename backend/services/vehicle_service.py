import os
import math
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.cache import cache_store
from backend.repositories.vehicle_repository import VehicleRepository

class VehicleService:
    """Service layer coordinating vehicle search and auto-complete suggestions."""

    def __init__(self, repository: Optional[VehicleRepository] = None):
        self.repo = repository or VehicleRepository()

    def get_total_records(self) -> int:
        if not os.path.exists(settings.PARQUET_FILE):
            settings.PARQUET_FILE = settings.resolve_parquet_file()
            if not os.path.exists(settings.PARQUET_FILE):
                return 0

        cache_key = "total_records_count"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        total = self.repo.count_total_records()
        cache_store.set(cache_key, total, ttl_seconds=3600)
        return total

    def get_suggestions(self, q: str, tipo_veiculo: str = "carro") -> List[Dict[str, Any]]:
        clean_q = q.strip().lower()
        if len(clean_q) < 2:
            return []

        cache_key = f"suggestions:{tipo_veiculo}:{clean_q}"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        suggestions = self.repo.get_suggestions(clean_q, tipo_veiculo)
        cache_store.set(cache_key, suggestions, ttl_seconds=300)
        return suggestions

    def search_vehicles(
        self,
        tipo_veiculo: str = "carro",
        preco_min: Optional[float] = None,
        preco_max: Optional[float] = None,
        ano_min: Optional[int] = None,
        ano_max: Optional[int] = None,
        marca: Optional[str] = None,
        marcas: Optional[str] = None,
        combustivel: Optional[str] = None,
        motorizacao: Optional[str] = "todos",
        cambio: Optional[str] = "todos",
        litragem: Optional[str] = "todos",
        search: Optional[str] = None,
        ordenacao: str = "preco_desc",
        page: int = 1,
        limit: int = 24
    ) -> Dict[str, Any]:
        total, items = self.repo.search_vehicles(
            tipo_veiculo=tipo_veiculo,
            preco_min=preco_min,
            preco_max=preco_max,
            ano_min=ano_min,
            ano_max=ano_max,
            marca=marca,
            marcas=marcas,
            combustivel=combustivel,
            motorizacao=motorizacao,
            cambio=cambio,
            litragem=litragem,
            search=search,
            ordenacao=ordenacao,
            page=page,
            limit=limit
        )

        total_pages = math.ceil(total / limit) if limit > 0 else 1

        return {
            "total_encontrados": total,
            "page": page,
            "total_paginas": total_pages,
            "resumo_faixa": {
                "preco_min": preco_min,
                "preco_max": preco_max,
                "ano_min": ano_min,
                "ano_max": ano_max,
                "motorizacao": motorizacao,
                "cambio": cambio,
                "litragem": litragem
            },
            "resultados": items
        }
