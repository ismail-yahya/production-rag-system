from unittest.mock import MagicMock, patch

import pytest
from pydantic import SecretStr

from src.core.config import Settings
from src.embeddings.base import BaseEmbedder
from src.embeddings.factory import EmbedderFactory, EmbeddingProvider
from src.embeddings.local_embedder import LocalEmbedder
from src.embeddings.openai_embedder import OpenAIEmbedder


@pytest.fixture
def mock_settings() -> Settings:
    settings = MagicMock(spec=Settings)
    settings.OPENAI_API_KEY = SecretStr("sk-test-openai")
    settings.OPENAI_EMBEDDING_MODEL = "text-embedding-3-large"
    settings.OPENAI_EMBEDDING_BATCH_SIZE = 100
    settings.LOCAL_EMBEDDING_MODEL = "BAAI/bge-m3"
    settings.EMBEDDING_DEVICE = "cpu"
    return settings


def test_factory_create_openai(mock_settings: Settings) -> None:
    embedder = EmbedderFactory.create(EmbeddingProvider.OPENAI, mock_settings)
    assert isinstance(embedder, BaseEmbedder)
    assert isinstance(embedder, OpenAIEmbedder)


def test_factory_create_local(mock_settings: Settings) -> None:
    mock_st = MagicMock()
    with patch.dict(
        "sys.modules", {"sentence_transformers": MagicMock(SentenceTransformer=mock_st)}
    ):
        embedder = EmbedderFactory.create(EmbeddingProvider.LOCAL, mock_settings)
        assert isinstance(embedder, BaseEmbedder)
        assert isinstance(embedder, LocalEmbedder)
        mock_st.assert_called_once_with("BAAI/bge-m3", device="cpu")


def test_factory_create_with_string_provider(mock_settings: Settings) -> None:
    embedder = EmbedderFactory.create("openai", mock_settings)
    assert isinstance(embedder, OpenAIEmbedder)


def test_factory_create_unsupported_string(mock_settings: Settings) -> None:
    with pytest.raises(ValueError, match="Unsupported embedding provider: fake"):
        EmbedderFactory.create("fake", mock_settings)


def test_factory_create_unsupported_enum(mock_settings: Settings) -> None:
    class FakeEnum:
        pass

    with pytest.raises(ValueError, match="Unsupported embedding provider"):
        EmbedderFactory.create(FakeEnum(), mock_settings)  # type: ignore
