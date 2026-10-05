import time
import threading
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from backend.core.config import settings

class SlidingWindowRateLimiter:
    """Sliding window per-IP rate limiter with burst control and background pruning."""
    def __init__(self, per_minute: int = settings.RATE_LIMIT_PER_MINUTE, burst_5s: int = settings.RATE_LIMIT_BURST):
        self.per_minute = per_minute
        self.burst_5s = burst_5s
        self.hits: Dict[str, List[float]] = defaultdict(list)
        self.lock = threading.Lock()
        self._last_cleanup = time.time()

    def _cleanup_old_entries(self, now: float) -> None:
        if now - self._last_cleanup > 120 or len(self.hits) > 2000:
            min_boundary = now - 60.0
            dead_ips = [ip for ip, timestamps in self.hits.items() if not timestamps or timestamps[-1] < min_boundary]
            for ip in dead_ips:
                del self.hits[ip]
            self._last_cleanup = now

    def is_allowed(self, ip: str) -> Tuple[bool, int, int]:
        """Returns (is_allowed, retry_after_seconds, remaining_requests_in_window)"""
        now = time.time()
        with self.lock:
            self._cleanup_old_entries(now)
            history = self.hits[ip]
            min_boundary = now - 60.0
            history = [t for t in history if t > min_boundary]
            self.hits[ip] = history

            # Check short burst limit (last 5s)
            burst_hits = sum(1 for t in history if t > now - 5.0)
            if burst_hits >= self.burst_5s:
                return False, 5, 0

            # Check sustained 1-minute window
            if len(history) >= self.per_minute:
                oldest_timestamp = history[0]
                retry_after = max(1, int(60.0 - (now - oldest_timestamp)))
                return False, retry_after, 0

            history.append(now)
            remaining = max(0, self.per_minute - len(history))
            return True, 0, remaining

rate_limiter = SlidingWindowRateLimiter()

def get_client_ip(request: Request) -> str:
    """
    Extract visitor IP considering Cloudflare Tunnel (CF-Connecting-IP),
    X-Forwarded-For reverse proxies, or direct TCP connection.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"

class RateLimitAndSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path

        # Whitelist root, docs, and schema definitions
        if (
            path in ("/", "/favicon.ico", "/openapi.json")
            or path.startswith("/docs")
            or path.startswith("/redoc")
        ):
            return await call_next(request)

        client_ip = get_client_ip(request)

        # Whitelist local machine calls if not via Cloudflare header
        if client_ip in ("127.0.0.1", "::1", "localhost") and not request.headers.get("cf-connecting-ip"):
            return await call_next(request)

        allowed, retry_after, remaining = rate_limiter.is_allowed(client_ip)
        if not allowed:
            headers = {
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(settings.RATE_LIMIT_PER_MINUTE),
                "X-RateLimit-Remaining": "0",
                "Access-Control-Allow-Origin": "*",
            }
            return JSONResponse(
                status_code=429,
                content={
                    "error": "too_many_requests",
                    "detail": "Limite de requisições excedido. Por favor, aguarde alguns segundos antes de tentar novamente.",
                    "retry_after_seconds": retry_after
                },
                headers=headers
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_PER_MINUTE)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
