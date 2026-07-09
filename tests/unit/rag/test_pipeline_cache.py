"""
Unit tests for RAGPipeline — cache hit and cache miss paths.

The blocking query() path supports Semantic Cache.
stream_query() is NOT cached (streaming responses are ephemeral).

These tests mock all external dependencies so no network calls are made.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.rag.schemas import RAGResponse, Source


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_pipeline(cache=None):
    """Build a RAGPipeline with all dependencies mocked."""
    from src.rag.pipeline import RAGPipeline

    llm = AsyncMock()
    llm.generate = AsyncMock(
        return_value=MagicMock(content="LLM answer", model="gpt-4o")
    )

    retriever = AsyncMock()
    retriever.retrieve = AsyncMock(return_value=[])

    reranker = AsyncMock()
    reranker.rerank = AsyncMock(return_value=[])

    query_processor = AsyncMock()
    query_processor.process_query = AsyncMock(return_value=(["q1", "q2"], "factual"))

    context_builder = MagicMock()
    context_builder.build_context = MagicMock(return_value="")

    return RAGPipeline(
        llm=llm,
        retriever=retriever,
        reranker=reranker,
        query_processor=query_processor,
        context_builder=context_builder,
        cache=cache,
    )


def _cached_response() -> dict:
    """Minimal serialised RAGResponse that can be returned by cache.get()."""
    return {
        "answer": "cached answer",
        "sources": [],
        "query_expansions": ["q1"],
        "retrieval_count": 0,
        "model": "gpt-4o",
        "latency_ms": 5.0,
    }


# ---------------------------------------------------------------------------
# Cache disabled (cache=None)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_no_cache_calls_retrieval():
    """When cache is None, query() executes the full retrieval pipeline."""
    pipeline = _make_pipeline(cache=None)

    result = await pipeline.query(question="What is X?", tenant_id=uuid.uuid4())

    assert isinstance(result, RAGResponse)
    pipeline.query_processor.process_query.assert_awaited_once()
    pipeline.llm.generate.assert_awaited_once()


# ---------------------------------------------------------------------------
# Cache hit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_cache_hit_skips_retrieval():
    """
    When cache returns a response, query() must return it immediately
    without calling the retriever, reranker, or LLM.
    """
    mock_cache = AsyncMock()
    mock_cache.get = AsyncMock(return_value=_cached_response())
    mock_cache.set = AsyncMock()

    pipeline = _make_pipeline(cache=mock_cache)

    result = await pipeline.query(question="What is X?", tenant_id=uuid.uuid4())

    assert result.answer == "cached answer"
    # Retrieval pipeline must NOT have been invoked
    pipeline.query_processor.process_query.assert_not_awaited()
    pipeline.retriever.retrieve.assert_not_awaited()
    pipeline.llm.generate.assert_not_awaited()
    # Cache.set must NOT be called on a cache hit
    mock_cache.set.assert_not_awaited()


@pytest.mark.asyncio
async def test_query_cache_hit_updates_latency():
    """Cache hit response has latency_ms updated to reflect the actual hit speed."""
    mock_cache = AsyncMock()
    cached = _cached_response()
    cached["latency_ms"] = 9999.0  # stale latency from original query
    mock_cache.get = AsyncMock(return_value=cached)

    pipeline = _make_pipeline(cache=mock_cache)
    result = await pipeline.query(question="What is X?", tenant_id=uuid.uuid4())

    # latency_ms should be much less than 9999 (it's a cache hit)
    assert result.latency_ms < 100.0


# ---------------------------------------------------------------------------
# Cache miss
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_cache_miss_stores_result():
    """
    On a cache miss, query() should execute retrieval, generate an answer,
    and write the result to cache.
    """
    mock_cache = AsyncMock()
    mock_cache.get = AsyncMock(return_value=None)  # cache miss
    mock_cache.set = AsyncMock()

    pipeline = _make_pipeline(cache=mock_cache)

    result = await pipeline.query(question="What is X?", tenant_id=uuid.uuid4())

    assert isinstance(result, RAGResponse)
    # Full pipeline must have been invoked
    pipeline.query_processor.process_query.assert_awaited_once()
    pipeline.llm.generate.assert_awaited_once()
    # Result must be written to cache
    mock_cache.set.assert_awaited_once()


@pytest.mark.asyncio
async def test_query_cache_miss_mode_included_in_key():
    """
    Different modes (standard vs strict) must produce different cache entries.
    The cache key must include the mode parameter.
    """
    mock_cache = AsyncMock()
    mock_cache.get = AsyncMock(return_value=None)
    mock_cache.set = AsyncMock()

    pipeline = _make_pipeline(cache=mock_cache)
    tenant_id = uuid.uuid4()

    await pipeline.query(question="Q", tenant_id=tenant_id, mode="standard")
    await pipeline.query(question="Q", tenant_id=tenant_id, mode="strict")

    # get() must have been called twice with DIFFERENT keys
    calls = mock_cache.get.call_args_list
    assert len(calls) == 2
    key_standard = calls[0][0][0]
    key_strict = calls[1][0][0]
    assert key_standard != key_strict, "Different modes must produce different cache keys"


# ---------------------------------------------------------------------------
# stream_query — no caching
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stream_query_does_not_use_cache():
    """stream_query() must never read from or write to the cache."""
    mock_cache = AsyncMock()
    mock_cache.get = AsyncMock(return_value=_cached_response())
    mock_cache.set = AsyncMock()

    pipeline = _make_pipeline(cache=mock_cache)

    # Provide a working LLM stream
    async def _mock_stream(_messages):
        yield "Hello"
        yield " world"

    pipeline.llm.stream = _mock_stream

    events = []
    async for event in pipeline.stream_query(question="Q?", tenant_id=uuid.uuid4()):
        events.append(event)

    mock_cache.get.assert_not_awaited()
    mock_cache.set.assert_not_awaited()
    assert any(e["type"] == "token" for e in events)
