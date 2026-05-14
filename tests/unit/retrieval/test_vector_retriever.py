from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.embeddings.base import BaseEmbedder
from src.retrieval.vector_retriever import VectorRetriever
from src.vectorstore.base import BaseVectorStore, Document


@pytest.mark.asyncio
async def test_vector_retriever_retrieve_success():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_vector_store.search = AsyncMock()
    
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1, 0.2, 0.3])
    
    retriever = VectorRetriever(vector_store=mock_vector_store, embedder=mock_embedder)
    
    query = "test query"
    tenant_id = uuid4()
    top_k = 5
    filters = {"category": "test"}
    
    expected_docs = [
        Document(id=uuid4(), content="doc1", score=0.9),
        Document(id=uuid4(), content="doc2", score=0.8),
    ]
    mock_vector_store.search.return_value = expected_docs
    
    # Act
    results = await retriever.retrieve(
        query=query,
        tenant_id=tenant_id,
        top_k=top_k,
        filters=filters.copy()
    )
    
    # Assert
    assert results == expected_docs
    mock_embedder.embed_query.assert_called_once_with(query)
    
    # Check if tenant_id was added to filters
    expected_filters = filters.copy()
    expected_filters["tenant_id"] = str(tenant_id)
    
    mock_vector_store.search.assert_called_once_with(
        query_vector=[0.1, 0.2, 0.3],
        top_k=top_k,
        filters=expected_filters
    )

@pytest.mark.asyncio
async def test_vector_retriever_retrieve_no_filters():
    # Arrange
    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_vector_store.search = AsyncMock(return_value=[])
    
    mock_embedder = MagicMock(spec=BaseEmbedder)
    mock_embedder.embed_query = AsyncMock(return_value=[0.1])
    
    retriever = VectorRetriever(vector_store=mock_vector_store, embedder=mock_embedder)
    
    tenant_id = uuid4()
    
    # Act
    await retriever.retrieve(query="test", tenant_id=tenant_id)
    
    # Assert
    mock_vector_store.search.assert_called_once()
    _, kwargs = mock_vector_store.search.call_args
    assert kwargs["filters"] == {"tenant_id": str(tenant_id)}
