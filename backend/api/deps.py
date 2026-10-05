from functools import lru_cache
from backend.services.filter_service import FilterService
from backend.services.vehicle_service import VehicleService
from backend.services.analytics_service import AnalyticsService

@lru_cache()
def get_filter_service() -> FilterService:
    return FilterService()

@lru_cache()
def get_vehicle_service() -> VehicleService:
    return VehicleService()

@lru_cache()
def get_analytics_service() -> AnalyticsService:
    return AnalyticsService()
