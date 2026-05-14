from uuid import uuid4

import pytest

from src.retrieval.bm25_retriever import BM25Retriever
from src.vectorstore.base import Document


@pytest.mark.asyncio
async def test_bm25_retriever_retrieve_success():
    # Arrange
    retriever = BM25Retriever()
    query = "fast brown fox"

    candidates = [
        Document(id=uuid4(), content="The quick brown fox jumps over the lazy dog"),
        Document(id=uuid4(), content="A fast runner is a winner"),
        Document(id=uuid4(), content="Completely irrelevant text"),
    ]

    # Act
    results = await retriever.retrieve(query, candidates)

    # Assert
    assert len(results) == 3
    # Doc 2 has no matching terms, so it should be last with score 0
    assert results[-1].content == "Completely irrelevant text"
    assert results[-1].score == 0.0
    assert results[0].score > 0.0

    # Check that it's sorted by score descending
    assert results[0].score >= results[1].score >= results[2].score


@pytest.mark.asyncio
async def test_bm25_retriever_empty_candidates():
    # Arrange
    retriever = BM25Retriever()

    # Act
    results = await retriever.retrieve("query", [])

    # Assert
    assert results == []


@pytest.mark.asyncio
async def test_bm25_retriever_no_matching_terms():
    # Arrange
    retriever = BM25Retriever()
    query = "xyz"
    candidates = [Document(id=uuid4(), content="abc def")]

    # Act
    results = await retriever.retrieve(query, candidates)

    # Assert
    assert len(results) == 1
    assert results[0].score == 0.0


@pytest.mark.asyncio
async def test_bm25_retriever_exception_fallback(monkeypatch):
    # Arrange
    retriever = BM25Retriever()

    def mock_init(*args, **kwargs):
        raise Exception("Mocked BM25 failure")

    monkeypatch.setattr("src.retrieval.bm25_retriever.BM25Okapi", mock_init)

    candidates = [Document(id=uuid4(), content="test")]

    # Act
    results = await retriever.retrieve("query", candidates)

    # Assert
    # Should return original candidates on failure
    assert results == candidates
