"""
Rate limiting and tenant context middleware.

RateLimitMiddleware strategy:
  - Primary key: rate_limit:tenant:{tenant_id}:{endpoint_group}
  - Fallback key: rate_limit:ip:{client_ip}  (for unauthenticated endpoints)
  - Endpoint groups:
      "ingest"  → /v1/ingest              (expensive — tight limit)
      "query"   → /v1/query, /v1/query/*  (frequent — higher limit)
      "default" → everything else
  - Standard response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

TenantContextMiddleware:
  - Manages the tenant_id context variable lifecycle per-request.
"""

import time
from typing import Any

import structlog
from fastapi import Request, Response, status
from redis import asyncio as redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.core.config import settings
from src.core.context import tenant_id_context

logger = structlog.get_logger(__name__)

# Paths exempt from rate limiting entirely
_EXEMPT_PATHS: frozenset[str] = frozenset({"/health", "/ready", "/metrics"})


def _get_endpoint_group(path: str) -> str:
    """Map a request path to one of three endpoint groups for rate-limit bucketing."""
    if path.startswith("/v1/ingest"):
        return "ingest"
    if path.startswith("/v1/query"):
        return "query"
    return "default"


def _get_limit_for_group(group: str) -> int:
    """Return the requests-per-minute limit for the given endpoint group."""
    limits: dict[str, int] = {
        "ingest": settings.RATE_LIMIT_INGEST,
        "query": settings.RATE_LIMIT_QUERY,
        "default": settings.RATE_LIMIT_DEFAULT,
    }
    return limits.get(group, settings.RATE_LIMIT_DEFAULT)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces per-tenant per-endpoint rate limits using Redis.

    Key format: rate_limit:tenant:{tenant_id}:{endpoint_group}
    Fallback:   rate_limit:ip:{client_ip}  (when tenant context not available)

    Uses a fixed-window counter strategy with a 60-second window.
    Responds with standard X-RateLimit-* headers on every request.
    Fails open: if Redis is unreachable, the request is allowed through.
    """

    WINDOW_SECONDS: int = 60  # Fixed window duration

    def __init__(self, app: Any, redis_url: str, **kwargs: Any) -> None:
        # Discard legacy `limit` and `window_seconds` kwargs (kept for compat)
        kwargs.pop("limit", None)
        kwargs.pop("window_seconds", None)
        super().__init__(app)
        self.redis: redis.Redis = redis.from_url(  # type: ignore[no-untyped-call]
            redis_url, decode_responses=True
        )

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Apply rate limiting before passing the request downstream."""
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        endpoint_group = _get_endpoint_group(request.url.path)
        limit = _get_limit_for_group(endpoint_group)

        # Prefer tenant-scoped key; fall back to IP when tenant context is absent.
        tenant_id = tenant_id_context.get()
        if tenant_id is not None:
            rate_key = f"rate_limit:tenant:{tenant_id}:{endpoint_group}"
        else:
            client_ip = request.client.host if request.client else "unknown"
            rate_key = f"rate_limit:ip:{client_ip}:{endpoint_group}"

        current_count = 0
        try:
            async with self.redis.pipeline(transaction=True) as pipe:
                await pipe.incr(rate_key)
                await pipe.ttl(rate_key)
                results = await pipe.execute()

            current_count = int(results[0])
            ttl = int(results[1])

            # Set the expiry only on the first request in this window
            if current_count == 1:
                await self.redis.expire(rate_key, self.WINDOW_SECONDS)
                ttl = self.WINDOW_SECONDS

            remaining = max(0, limit - current_count)
            reset_at = int(time.time()) + max(0, ttl)

            if current_count > limit:
                logger.warning(
                    "rate_limit_exceeded",
                    key=rate_key,
                    count=current_count,
                    limit=limit,
                    group=endpoint_group,
                )
                return Response(
                    content='{"detail": "Rate limit exceeded. Please try again later."}',
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    media_type="application/json",
                    headers={
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(reset_at),
                        "Retry-After": str(max(0, ttl)),
                    },
                )

        except Exception as exc:
            # Fail-open: Redis unavailable → allow through but log
            error_msg = str(exc).lower()
            error_type = type(exc).__name__.lower()
            if "getaddrinfo" not in error_msg and "connection" not in error_type:
                logger.error("rate_limit_middleware_failure_fail_open", error=str(exc))
            remaining = limit
            reset_at = int(time.time()) + self.WINDOW_SECONDS

        response = await call_next(request)

        # Attach standard rate-limit headers to the successful response
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current_count))
        response.headers["X-RateLimit-Reset"] = str(reset_at)
        return response


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that manages the lifecycle of the tenant_id context variable.
    Ensures that the tenant_id is cleared after each request to prevent leakage
    between requests served by the same worker process.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        token = tenant_id_context.set(None)
        try:
            return await call_next(request)
        finally:
            tenant_id_context.reset(token)

