import pytest
import uuid
from typing import Any

from src.vectorstore.base import BaseVectorStore, Document


def test_base_vector_store_is_abstract() -> None:
    """Test that BaseVectorStore cannot be instantiated directly."""
    with pytest.raises(TypeError):
        BaseVectorStore()  # type: ignore


def test_document_instantiation() -> None:
    """Test that Document value object works correctly."""
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        content="test content",
        metadata={"tenant_id": "test_tenant"},
        embedding=[1.0, 2.0, 3.0],
        score=0.95
    )
    
    assert doc.id == doc_id
    assert doc.content == "test content"
    assert doc.metadata == {"tenant_id": "test_tenant"}
    assert doc.embedding == [1.0, 2.0, 3.0]
    assert doc.score == 0.95


def test_document_defaults() -> None:
    """Test default values of Document."""
    doc_id = uuid.uuid4()
    doc = Document(id=doc_id, content="test content")
    
    assert doc.metadata == {}
    assert doc.embedding is None
    assert doc.score is None


class DummyVectorStore(BaseVectorStore):
    """Dummy implementation of BaseVectorStore for testing."""

    async def upsert(self, documents: list[Document]) -> None:
        pass

    async def search(self, query_vector: list[float], top_k: int, filters: dict[str, Any]) -> list[Document]:
        return [Document(id=uuid.uuid4(), content="dummy", score=1.0)]

    async def delete(self, filters: dict[str, Any]) -> None:
        pass


@pytest.mark.asyncio
async def test_dummy_vector_store() -> None:
    """Test that a subclass can be properly implemented."""
    store = DummyVectorStore()
    
    # Should not raise any errors
    await store.upsert([])
    
    results = await store.search([1.0], 1, {"tenant_id": "test"})
    assert len(results) == 1
    assert results[0].content == "dummy"
    
    # Should not raise any errors
    await store.delete({"tenant_id": "test"})
