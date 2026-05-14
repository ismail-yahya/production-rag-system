from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.core.exceptions import RetrievalError
from src.retrieval.reranker import CohereReranker
from src.vectorstore.base import Document


@pytest.mark.asyncio
async def test_cohere_reranker_success():
    # Arrange
    mock_client = MagicMock()
    mock_response = MagicMock()

    # Mock result objects
    res1 = MagicMock()
    res1.index = 1
    res1.relevance_score = 0.9

    res2 = MagicMock()
    res2.index = 0
    res2.relevance_score = 0.1

    mock_response.results = [res1, res2]
    mock_client.rerank = AsyncMock(return_value=mock_response)

    reranker = CohereReranker(api_key="test-key")
    reranker._client = mock_client

    doc0 = Document(id=uuid4(), content="doc0")
    doc1 = Document(id=uuid4(), content="doc1")
    documents = [doc0, doc1]

    # Act
    results = await reranker.rerank(query="test", documents=documents, top_n=2)

    # Assert
    assert len(results) == 2
    assert results[0].id == doc1.id
    assert results[0].score == 0.9
    assert results[1].id == doc0.id
    assert results[1].score == 0.1


@pytest.mark.asyncio
async def test_cohere_reranker_api_failure():
    # Arrange
    mock_client = MagicMock()
    mock_client.rerank = AsyncMock(side_effect=Exception("API Error"))

    reranker = CohereReranker(api_key="test-key")
    reranker._client = mock_client

    # Act & Assert
    with pytest.raises(RetrievalError) as exc:
        await reranker.rerank(
            query="test", documents=[Document(id=uuid4(), content="test")]
        )
    assert "Cohere rerank failed" in str(exc.value)


@pytest.mark.asyncio
async def test_cohere_reranker_missing_client(monkeypatch):
    # Arrange
    monkeypatch.setattr("src.retrieval.reranker.settings", MagicMock(COHERE_API_KEY=None))
    reranker = CohereReranker()
    assert reranker._client is None

    doc = Document(id=uuid4(), content="test")

    # Act
    results = await reranker.rerank(query="test", documents=[doc], top_n=1)

    # Assert
    assert results == [doc]


@pytest.mark.asyncio
async def test_cohere_reranker_empty_input():
    # Arrange
    reranker = CohereReranker(api_key="test")

    # Act
    results = await reranker.rerank(query="test", documents=[])

    # Assert
    assert results == []


@pytest.mark.asyncio
async def test_cohere_reranker_fewer_results():
    # Arrange
    mock_client = MagicMock()
    mock_response = MagicMock()

    res1 = MagicMock()
    res1.index = 0
    res1.relevance_score = 0.9

    mock_response.results = [res1]  # Only 1 result returned
    mock_client.rerank = AsyncMock(return_value=mock_response)

    reranker = CohereReranker(api_key="test-key")
    reranker._client = mock_client

    documents = [
        Document(id=uuid4(), content="doc0"),
        Document(id=uuid4(), content="doc1"),
    ]

    # Act
    results = await reranker.rerank(query="test", documents=documents, top_n=2)

    # Assert
    assert len(results) == 1
