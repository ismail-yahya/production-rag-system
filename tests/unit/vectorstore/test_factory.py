import pytest
from unittest.mock import MagicMock

from src.core.config import Settings
from src.vectorstore.base import BaseVectorStore
from src.vectorstore.factory import VectorStoreFactory, VectorStoreProvider
from src.vectorstore.qdrant_store import QdrantVectorStore


@pytest.fixture
def mock_settings() -> Settings:
    settings = MagicMock(spec=Settings)
    settings.QDRANT_URL = "http://localhost:6333"
    settings.QDRANT_COLLECTION_NAME = "test_collection"
    return settings


def test_factory_create_qdrant(mock_settings: Settings) -> None:
    store = VectorStoreFactory.create(VectorStoreProvider.QDRANT, mock_settings)
    assert isinstance(store, BaseVectorStore)
    assert isinstance(store, QdrantVectorStore)


def test_factory_create_with_string_provider(mock_settings: Settings) -> None:
    store = VectorStoreFactory.create("qdrant", mock_settings)
    assert isinstance(store, QdrantVectorStore)


def test_factory_create_unsupported_string(mock_settings: Settings) -> None:
    with pytest.raises(ValueError, match="Unsupported vector store provider: fake"):
        VectorStoreFactory.create("fake", mock_settings)


def test_factory_create_unsupported_enum(mock_settings: Settings) -> None:
    class FakeEnum:
        pass
    
    with pytest.raises(ValueError, match="Unsupported vector store provider"):
        VectorStoreFactory.create(FakeEnum(), mock_settings)  # type: ignore
