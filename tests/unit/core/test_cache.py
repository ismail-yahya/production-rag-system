"""
Unit tests for SemanticCache — including the new invalidate_tenant() method.
"""
import json
from unittest.mock import AsyncMock, MagicMock, call, patch
from uuid import uuid4

import pytest

from src.core.cache import SemanticCache


@pytest.fixture
def mock_embedder():
    return MagicMock()


@pytest.fixture
def mock_redis():
    with patch("redis.asyncio.from_url") as mock:
        yield mock


# ---------------------------------------------------------------------------
# Existing tests (updated to use settings.SEMANTIC_CACHE_TTL_SECONDS)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cache_get_hit(mock_redis, mock_embedder):
    """Verify cache hit returns parsed JSON."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)

    tenant_id = uuid4()
    response_data = {"answer": "cached"}
    mock_client.get.return_value = json.dumps(response_data)

    result = await cache.get("test query", tenant_id)
    assert result == response_data
    mock_client.get.assert_called_once()


@pytest.mark.asyncio
async def test_cache_get_miss(mock_redis, mock_embedder):
    """Verify cache miss returns None."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)

    mock_client.get.return_value = None
    result = await cache.get("test query", uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_cache_set(mock_redis, mock_embedder):
    """Verify cache set stores JSON with TTL from settings."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)

    tenant_id = uuid4()
    response_data = {"answer": "new"}
    await cache.set("test query", tenant_id, response_data)

    # Check that set was called with JSON string and TTL from settings
    args, kwargs = mock_client.set.call_args
    assert json.loads(args[1]) == response_data
    assert kwargs["ex"] == cache.ttl  # Uses settings value, not hardcoded 3600


@pytest.mark.asyncio
async def test_cache_get_exception(mock_redis, mock_embedder):
    """Verify that get handles Redis exceptions gracefully."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)
    mock_client.get.side_effect = Exception("redis error")

    result = await cache.get("test query", uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_cache_set_exception(mock_redis, mock_embedder):
    """Verify that set handles Redis exceptions gracefully."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)
    mock_client.set.side_effect = Exception("redis error")

    # Should not raise exception
    await cache.set("test query", uuid4(), {"ans": "1"})


# ---------------------------------------------------------------------------
# New tests for invalidate_tenant()
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_invalidate_tenant_no_keys(mock_redis, mock_embedder):
    """When no keys match the pattern, returns 0 and calls no delete."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    # SCAN returns cursor=0, empty keys list — single iteration terminates
    mock_client.scan.return_value = (0, [])
    cache = SemanticCache(mock_embedder)

    tenant_id = uuid4()
    deleted = await cache.invalidate_tenant(tenant_id)

    assert deleted == 0
    mock_client.delete.assert_not_called()
    mock_client.scan.assert_called_once_with(0, match=f"cache:{tenant_id}:*", count=100)


@pytest.mark.asyncio
async def test_invalidate_tenant_with_keys(mock_redis, mock_embedder):
    """When keys exist, they are deleted and count is returned."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    tenant_id = uuid4()

    key1 = f"cache:{tenant_id}:abc"
    key2 = f"cache:{tenant_id}:def"
    # First scan returns 2 keys and cursor=0 (terminates)
    mock_client.scan.return_value = (0, [key1, key2])

    cache = SemanticCache(mock_embedder)
    deleted = await cache.invalidate_tenant(tenant_id)

    assert deleted == 2
    mock_client.delete.assert_called_once_with(key1, key2)


@pytest.mark.asyncio
async def test_invalidate_tenant_multiple_pages(mock_redis, mock_embedder):
    """SCAN loop continues until cursor returns to 0."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    tenant_id = uuid4()

    page1_keys = [f"cache:{tenant_id}:{i}" for i in range(3)]
    page2_keys = [f"cache:{tenant_id}:{i}" for i in range(3, 5)]

    # First call: non-zero cursor → continue; Second call: cursor=0 → stop
    mock_client.scan.side_effect = [
        (42, page1_keys),
        (0, page2_keys),
    ]

    cache = SemanticCache(mock_embedder)
    deleted = await cache.invalidate_tenant(tenant_id)

    assert deleted == 5
    assert mock_client.scan.call_count == 2
    assert mock_client.delete.call_count == 2


@pytest.mark.asyncio
async def test_invalidate_tenant_redis_exception(mock_redis, mock_embedder):
    """Redis exceptions during invalidation are absorbed — returns 0."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    mock_client.scan.side_effect = Exception("connection lost")

    cache = SemanticCache(mock_embedder)
    # Must NOT raise, must return 0
    deleted = await cache.invalidate_tenant(uuid4())
    assert deleted == 0


@pytest.mark.asyncio
async def test_invalidate_tenant_uses_correct_pattern(mock_redis, mock_embedder):
    """The SCAN pattern is scoped to the specific tenant_id."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    mock_client.scan.return_value = (0, [])

    cache = SemanticCache(mock_embedder)
    tenant_id = uuid4()
    await cache.invalidate_tenant(tenant_id)

    # Pattern must include tenant_id so other tenants' keys are not touched
    call_kwargs = mock_client.scan.call_args
    assert f"cache:{tenant_id}:*" in call_kwargs[1]["match"]
