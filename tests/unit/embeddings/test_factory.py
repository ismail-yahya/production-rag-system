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
    settings.COHERE_API_KEY = SecretStr("sk-test-cohere")
    settings.COHERE_EMBEDDING_MODEL = "embed-multilingual-v3.0"
    settings.EMBEDDING_CONCURRENCY_LIMIT = 5
    settings.EMBEDDING_RETRY_ATTEMPTS = 4
    return settings


def test_factory_create_openai(mock_settings: Settings) -> None:
    embedder = EmbedderFactory.create(EmbeddingProvider.OPENAI, mock_settings)
    assert isinstance(embedder, BaseEmbedder)
    assert isinstance(embedder, OpenAIEmbedder)


def test_factory_create_cohere(mock_settings: Settings) -> None:
    embedder = EmbedderFactory.create(EmbeddingProvider.COHERE, mock_settings)
    assert isinstance(embedder, BaseEmbedder)
    from src.embeddings.cohere_embedder import CohereEmbedder

    assert isinstance(embedder, CohereEmbedder)


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
