from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.embeddings.base import BaseEmbedder
from src.retrieval.hybrid_retriever import HybridRetriever, HybridSearchConfig
from src.vectorstore.base import BaseVectorStore, Document


@pytest.mark.asyncio
async def test_hybrid_retriever_retrieve_success():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)

    mock_embedder.embed_query = AsyncMock(return_value=[0.1])

    doc1 = Document(id=uuid4(), content="apple pie")
    doc2 = Document(id=uuid4(), content="banana split")

    # Mock vector search to return doc1, doc2 (Semantic rank: doc1, doc2)
    mock_vector_store.search = AsyncMock(return_value=[doc1, doc2])

    retriever = HybridRetriever(vector_store=mock_vector_store, embedder=mock_embedder)

    # Act
    # Query for "banana" should boost doc2 via BM25
    results = await retriever.retrieve(query="banana", tenant_id=uuid4())

    # Assert
    assert len(results) > 0
    # Depending on weights, doc2 might even jump to #1.
    # In any case, we check that we got results.
    assert any(d.id == doc1.id for d in results)
    assert any(d.id == doc2.id for d in results)


@pytest.mark.asyncio
async def test_hybrid_retriever_empty_results():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_vector_store.search = AsyncMock(return_value=[])
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])

    retriever = HybridRetriever(vector_store=mock_vector_store, embedder=mock_embedder)

    # Act
    results = await retriever.retrieve(query="test", tenant_id=uuid4())

    # Assert
    assert results == []


@pytest.mark.asyncio
async def test_hybrid_retriever_rrf_logic():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])

    doc_v1 = Document(id=uuid4(), content="This is a document about apples")
    doc_v2 = Document(id=uuid4(), content="This is a document about bananas")
    doc_v3 = Document(id=uuid4(), content="This is a document about cherries")

    # Vector rank: v1 (1), v2 (2), v3 (3)
    mock_vector_store.search = AsyncMock(return_value=[doc_v1, doc_v2, doc_v3])

    # For query "bananas", BM25 rank will be: v2 (1), v1 (2), v3 (3)
    # Note: v1 and v3 have no matching terms, so they will share the same score (0)
    # and their relative rank will depend on original order.

    config = HybridSearchConfig(vector_weight=0.3, keyword_weight=0.7, rrf_k=0, final_top_k=10)
    retriever = HybridRetriever(
        vector_store=mock_vector_store, embedder=mock_embedder, config=config
    )

    # Act
    results = await retriever.retrieve(query="bananas", tenant_id=uuid4())

    # Assert
    # v1 (vector=1, keyword=2) -> 0.3*(1/1) + 0.7*(1/2) = 0.3 + 0.35 = 0.65
    # v2 (vector=2, keyword=1) -> 0.3*(1/2) + 0.7*(1/1) = 0.15 + 0.7 = 0.85
    assert results[0].id == doc_v2.id
    assert results[0].score == pytest.approx(0.85)
