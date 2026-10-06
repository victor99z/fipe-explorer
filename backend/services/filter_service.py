from typing import List, Optional, Dict, Any
from backend.core.cache import cache_store
from backend.repositories.filter_repository import FilterRepository

class FilterService:
    """Service layer for filter lookups with TTL caching."""

    def __init__(self, repository: Optional[FilterRepository] = None):
        self.repo = repository or FilterRepository()

    def get_brands(self, tipo_veiculo: str = "carro") -> List[str]:
        cache_key = f"brands:{tipo_veiculo}"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        brands = self.repo.get_brands(tipo_veiculo)
        cache_store.set(cache_key, brands, ttl_seconds=3600)
        return brands

    def get_models(self, tipo_veiculo: str = "carro", marcas: Optional[str] = None) -> List[str]:
        cache_key = f"models:{tipo_veiculo}:{marcas or 'all'}"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        models = self.repo.get_models(tipo_veiculo, marcas)
        cache_store.set(cache_key, models, ttl_seconds=600)
        return models

    def get_years(
        self,
        tipo_veiculo: str = "carro",
        codigo_fipe: Optional[str] = None,
        marca: Optional[str] = None,
        modelo: Optional[str] = None
    ) -> List[int]:
        cache_key = f"years:{tipo_veiculo}:{codigo_fipe}:{marca}:{modelo}"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        years = self.repo.get_years(tipo_veiculo, codigo_fipe, marca, modelo)
        cache_store.set(cache_key, years, ttl_seconds=600)
        return years

    def get_engine_sizes(self, tipo_veiculo: str = "carro") -> List[Dict[str, Any]]:
        cache_key = f"engine_sizes:{tipo_veiculo}"
        cached = cache_store.get(cache_key)
        if cached is not None:
            return cached

        sizes = self.repo.get_engine_sizes(tipo_veiculo)
        cache_store.set(cache_key, sizes, ttl_seconds=3600)
        return sizes
