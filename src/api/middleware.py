import structlog
from fastapi import Request, Response, status
from redis import asyncio as redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.core.config import settings

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces rate limits using Redis.
    Currently applies a global per-IP limit for simplicity.
    """

    def __init__(
        self, 
        app, 
        redis_url: str, 
        limit: int = 100, 
        window_seconds: int = 60
    ) -> None:
        super().__init__(app)
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.limit = limit
        self.window = window_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Intersects the request to check if the client has exceeded their rate limit.
        """
        # Skip rate limiting for health/ready checks to avoid false negatives in monitoring
        if request.url.path in ["/health", "/ready", "/metrics"]:
            return await call_next(request)

        # 1. Identify the client (IP-based for global limit)
        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:ip:{client_ip}"

        # 2. Check and increment the rate limit counter
        try:
            # We use a simple fixed-window strategy for MVP
            current_count = await self.redis.get(key)
            
            if current_count and int(current_count) >= self.limit:
                logger.warning(
                    "Rate limit exceeded", 
                    client_ip=client_ip, 
                    limit=self.limit, 
                    window=self.window
                )
                return Response(
                    content='{"detail": "Rate limit exceeded. Please try again later."}',
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    media_type="application/json",
                )

            # Increment and set expiry if it's a new window
            async with self.redis.pipeline(transaction=True) as pipe:
                await pipe.incr(key)
                await pipe.expire(key, self.window, nx=True)
                await pipe.execute()
                
        except Exception as e:
            # Fail-open: If Redis is unavailable, allow the request but log the error
            # This ensures that a Redis failure doesn't cause a total system outage.
            logger.error("Rate limit middleware failure (fail-open)", error=str(e))

        # 3. Proceed to the next handler
        return await call_next(request)
