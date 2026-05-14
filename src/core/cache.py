import json
from typing import Any
from uuid import UUID

import redis.asyncio as redis
import structlog

from src.core.config import settings
from src.embeddings.base import BaseEmbedder

logger = structlog.get_logger(__name__)


class SemanticCache:
    """
    Redis-based semantic cache for RAG queries.
    Currently implements exact match caching for MVP, with a
    placeholder for vector-based semantic similarity.
    """

    def __init__(self, embedder: BaseEmbedder) -> None:
        """
        Initialize the semantic cache.

        Args:
            embedder: Embedder used for generating query representations.
        """
        self.redis = redis.from_url(settings.REDIS_BACKEND_URL, decode_responses=True)
        self.embedder = embedder
        self.ttl = 3600  # 1 hour cache TTL

    async def get(self, query: str, tenant_id: UUID) -> dict[str, Any] | None:
        """
        Attempt to retrieve a cached response for the given query.

        Args:
            query: The natural language query.
            tenant_id: The tenant ID scoping the cache.

        Returns:
            The cached response dict or None if not found.
        """
        # We use a composite key of tenant_id and a hash of the query
        # TODO(#42): Implement vector similarity search for true semantic caching
        key = self._get_key(query, tenant_id)

        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                logger.info("semantic_cache_hit", query=query[:50], tenant_id=str(tenant_id))
                return json.loads(cached_data)
        except Exception as e:
            logger.error("semantic_cache_get_failure", error=str(e))

        return None

    async def set(self, query: str, tenant_id: UUID, response: dict[str, Any]) -> None:
        """
        Store a response in the cache.

        Args:
            query: The natural language query.
            tenant_id: The tenant ID.
            response: The response data to cache.
        """
        key = self._get_key(query, tenant_id)

        try:
            await self.redis.set(key, json.dumps(response), ex=self.ttl)
            logger.debug("semantic_cache_set", query=query[:50])
        except Exception as e:
            logger.error("semantic_cache_set_failure", error=str(e))

    def _get_key(self, query: str, tenant_id: UUID) -> str:
        """Generate a cache key for the query."""
        import hashlib

        query_hash = hashlib.sha256(query.strip().lower().encode()).hexdigest()
        return f"cache:{tenant_id}:{query_hash}"
