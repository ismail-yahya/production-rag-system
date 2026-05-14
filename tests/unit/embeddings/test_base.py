
import pytest

from src.embeddings.base import BaseEmbedder


def test_base_embedder_is_abstract() -> None:
    """Test that BaseEmbedder cannot be instantiated directly."""
    with pytest.raises(TypeError):
        BaseEmbedder()  # type: ignore


class DummyEmbedder(BaseEmbedder):
    """Dummy implementation of BaseEmbedder for testing."""

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        # Return a simple vector based on text length for testing
        return [[float(len(t))] * 3 for t in texts]


@pytest.mark.asyncio
async def test_dummy_embedder_embed_texts() -> None:
    """Test that a subclass can properly implement embed_texts."""
    embedder = DummyEmbedder()
    vectors = await embedder.embed_texts(["hello", "world!"])
    assert len(vectors) == 2
    assert vectors[0] == [5.0, 5.0, 5.0]
    assert vectors[1] == [6.0, 6.0, 6.0]


@pytest.mark.asyncio
async def test_dummy_embedder_embed_query() -> None:
    """Test that the default embed_query method works correctly."""
    embedder = DummyEmbedder()
    vector = await embedder.embed_query("test")
    # Length of "test" is 4
    assert vector == [4.0, 4.0, 4.0]
