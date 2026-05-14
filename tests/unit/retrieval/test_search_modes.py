import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from src.retrieval.hybrid_retriever import HybridRetriever
from src.vectorstore.base import BaseVectorStore, Document
from src.embeddings.base import BaseEmbedder

@pytest.mark.asyncio
async def test_search_mode_semantic():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])
    
    doc1 = Document(id=uuid4(), content="semantic match", score=0.9)
    mock_vector_store.search = AsyncMock(return_value=[doc1])
    
    retriever = HybridRetriever(vector_store=mock_vector_store, embedder=mock_embedder)
    
    # Act
    results = await retriever.retrieve(
        query="test", 
        tenant_id=uuid4(), 
        search_type="semantic"
    )
    
    # Assert
    assert len(results) == 1
    assert results[0].id == doc1.id
    # In semantic mode, we should have the original vector score (or at least it shouldn't be RRF fused)
    # Actually, in my implementation, semantic mode uses vector results directly
    assert results[0].score == 0.9

@pytest.mark.asyncio
async def test_search_mode_literal():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])
    
    doc1 = Document(id=uuid4(), content="apple")
    doc2 = Document(id=uuid4(), content="banana")
    doc3 = Document(id=uuid4(), content="cherry")
    doc4 = Document(id=uuid4(), content="date")
    
    # Vector search returns all (to simulate a large candidate pool)
    mock_vector_store.search = AsyncMock(return_value=[doc1, doc2, doc3, doc4])
    
    retriever = HybridRetriever(vector_store=mock_vector_store, embedder=mock_embedder)
    
    # Act: Query for "banana" in literal mode
    results = await retriever.retrieve(
        query="banana", 
        tenant_id=uuid4(), 
        search_type="literal"
    )
    
    # Assert
    assert len(results) == 1
    assert results[0].id == doc2.id
    # Score should be the BM25 score
    assert results[0].score > 0

@pytest.mark.asyncio
async def test_similarity_threshold():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])
    
    doc_high = Document(id=uuid4(), content="high similarity", score=0.8)
    doc_low = Document(id=uuid4(), content="low similarity", score=0.2)
    
    mock_vector_store.search = AsyncMock(return_value=[doc_high, doc_low])
    
    retriever = HybridRetriever(vector_store=mock_vector_store, embedder=mock_embedder)
    
    # Act: Set threshold to 0.5
    results = await retriever.retrieve(
        query="test", 
        tenant_id=uuid4(), 
        similarity_threshold=0.5
    )
    
    # Assert
    assert len(results) == 1
    assert results[0].id == doc_high.id
