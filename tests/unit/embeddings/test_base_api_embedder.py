import asyncio
import time
import pytest
from src.core.exceptions import EmbeddingError
from src.embeddings.base import BaseAPIEmbedder


class MockAPIEmbedder(BaseAPIEmbedder):
    """Mock implementation of BaseAPIEmbedder for testing."""

    def __init__(self, batch_size: int, max_concurrency: int = 5, retry_attempts: int = 3) -> None:
        super().__init__(
            batch_size=batch_size,
            max_concurrency=max_concurrency,
            retry_attempts=retry_attempts,
        )
        self.call_count = 0
        self.batches_received = []
        self.sleep_duration = 0.0
        self.fail_attempts = 0

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        self.call_count += 1
        self.batches_received.append(batch)

        if self.fail_attempts > 0:
            self.fail_attempts -= 1
            raise EmbeddingError("Mock transient API failure")

        if self.sleep_duration > 0:
            await asyncio.sleep(self.sleep_duration)

        return [[float(len(text))] * 3 for text in batch]


@pytest.mark.asyncio
async def test_base_api_embedder_batching() -> None:
    """Test that BaseAPIEmbedder correctly slices input into batches."""
    embedder = MockAPIEmbedder(batch_size=2)
    texts = ["a", "bb", "ccc", "dddd", "eeeee"]
    # 5 texts, batch_size=2 -> should yield 3 batches: ['a', 'bb'], ['ccc', 'dddd'], ['eeeee']
    vectors = await embedder.embed_texts(texts)

    assert len(vectors) == 5
    assert embedder.call_count == 3
    assert embedder.batches_received == [
        ["a", "bb"],
        ["ccc", "dddd"],
        ["eeeee"],
    ]
    # Check values
    assert vectors[0] == [1.0, 1.0, 1.0]
    assert vectors[4] == [5.0, 5.0, 5.0]


@pytest.mark.asyncio
async def test_base_api_embedder_concurrency() -> None:
    """Test that BaseAPIEmbedder processes batches concurrently."""
    embedder = MockAPIEmbedder(batch_size=1, max_concurrency=3)
    embedder.sleep_duration = 0.1
    texts = ["a", "b", "c"]

    start_time = time.perf_counter()
    vectors = await embedder.embed_texts(texts)
    duration = time.perf_counter() - start_time

    assert len(vectors) == 3
    assert embedder.call_count == 3
    # If sequential, total time would be >= 0.3s.
    # Concurrently, it should be around 0.1s - 0.2s.
    assert duration < 0.25


@pytest.mark.asyncio
async def test_base_api_embedder_retry_success() -> None:
    """Test that BaseAPIEmbedder retries on EmbeddingError and succeeds."""
    embedder = MockAPIEmbedder(batch_size=2, retry_attempts=3)
    embedder.fail_attempts = 1  # Fail the first attempt

    # Since fail_attempts=1, the first batch attempt fails, tenacity retries,
    # the second attempt succeeds because fail_attempts is decremented to 0.
    vectors = await embedder.embed_texts(["a", "b"])
    assert len(vectors) == 2
    # call_count should be 2 (1 failed + 1 successful)
    assert embedder.call_count == 2


@pytest.mark.asyncio
async def test_base_api_embedder_retry_exhausted() -> None:
    """Test that BaseAPIEmbedder raises EmbeddingError when retries are exhausted."""
    embedder = MockAPIEmbedder(batch_size=2, retry_attempts=2)
    embedder.fail_attempts = 3  # Fails 3 times, but only 2 attempts allowed

    with pytest.raises(EmbeddingError, match="Mock transient API failure"):
        await embedder.embed_texts(["a", "b"])

    # Attempt count should equal retry_attempts
    assert embedder.call_count == 2
