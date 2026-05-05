import pytest
import json
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from src.core.cache import SemanticCache

@pytest.fixture
def mock_embedder():
    return MagicMock()

@pytest.fixture
def mock_redis():
    with patch("redis.asyncio.from_url") as mock:
        yield mock

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
    """Verify cache set stores JSON with TTL."""
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client
    cache = SemanticCache(mock_embedder)
    
    tenant_id = uuid4()
    response_data = {"answer": "new"}
    await cache.set("test query", tenant_id, response_data)
    
    # Check that set was called with JSON string and TTL
    args, kwargs = mock_client.set.call_args
    assert json.loads(args[1]) == response_data
    assert kwargs["ex"] == 3600

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
