"""
Unit tests for AdminRepository.get_stats().

Tests verify:
1. All four DB queries are executed and results are aggregated correctly.
2. An empty tenant returns zeros (not None / exceptions).
3. The average latency handles NULL from AVG() gracefully.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.repositories import AdminRepository, AdminStatsData


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    return AsyncMock()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_stats_returns_correct_values(mock_session):
    """
    get_stats() should aggregate the four query results into AdminStatsData.
    """
    tenant_id = uuid.uuid4()

    # Each execute() call returns a result with scalar_one()
    doc_result = MagicMock()
    doc_result.scalar_one.return_value = 42

    chunk_result = MagicMock()
    chunk_result.scalar_one.return_value = 210

    query_result = MagicMock()
    query_result.scalar_one.return_value = 99

    latency_result = MagicMock()
    latency_result.scalar_one.return_value = 312.5

    mock_session.execute = AsyncMock(
        side_effect=[doc_result, chunk_result, query_result, latency_result]
    )

    repo = AdminRepository(mock_session)
    stats = await repo.get_stats(tenant_id)

    assert isinstance(stats, AdminStatsData)
    assert stats.total_documents == 42
    assert stats.total_chunks == 210
    assert stats.total_queries == 99
    assert stats.average_latency_ms == 312.5


@pytest.mark.asyncio
async def test_get_stats_empty_tenant_returns_zeros(mock_session):
    """
    When a tenant has no data, all counts should be 0 and latency 0.0.
    """
    tenant_id = uuid.uuid4()

    zero_result = MagicMock()
    zero_result.scalar_one.return_value = 0

    null_result = MagicMock()
    null_result.scalar_one.return_value = None  # AVG() returns NULL on empty table

    mock_session.execute = AsyncMock(
        side_effect=[zero_result, zero_result, zero_result, null_result]
    )

    repo = AdminRepository(mock_session)
    stats = await repo.get_stats(tenant_id)

    assert stats.total_documents == 0
    assert stats.total_chunks == 0
    assert stats.total_queries == 0
    assert stats.average_latency_ms == 0.0  # None → 0.0


@pytest.mark.asyncio
async def test_get_stats_executes_four_queries(mock_session):
    """
    get_stats() must execute exactly 4 DB queries (one per metric).
    """
    tenant_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 0
    mock_session.execute = AsyncMock(return_value=mock_result)

    repo = AdminRepository(mock_session)
    await repo.get_stats(tenant_id)

    assert mock_session.execute.call_count == 4


@pytest.mark.asyncio
async def test_get_stats_average_latency_as_float(mock_session):
    """
    average_latency_ms must always be a float, even when DB returns an int.
    """
    tenant_id = uuid.uuid4()

    int_result = MagicMock()
    int_result.scalar_one.return_value = 200  # DB returns int

    mock_session.execute = AsyncMock(
        side_effect=[int_result, int_result, int_result, int_result]
    )

    repo = AdminRepository(mock_session)
    stats = await repo.get_stats(tenant_id)

    assert isinstance(stats.average_latency_ms, float)
