import asyncio
from abc import ABC, abstractmethod
from typing import Any

import structlog
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from src.core.exceptions import EmbeddingError

logger = structlog.get_logger(__name__)


class BaseEmbedder(ABC):
    """Abstract base class for all embedding providers.

    Every concrete embedder must implement ``embed_texts()``, which accepts a
    *batch* of texts and returns a list of embedding vectors in the same order.
    A default ``embed_query()`` convenience method is provided; override it
    only when a provider requires a different encoding mode for queries versus
    documents (e.g., asymmetric embeddings).
    """

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a batch of texts and return their vector representations.

        Implementations must process the full batch in as few API calls as
        possible — never call a per-text API endpoint in a loop.

        Args:
            texts: A non-empty list of strings to embed.

        Returns:
            A list of floating-point vectors, one per input text, preserving
            input order.

        Raises:
            EmbeddingError: If the provider call fails for any reason.
        """
        pass  # pragma: no cover

    async def embed_query(self, query: str) -> list[float]:
        """
        Embed a single query string.

        This default implementation delegates to ``embed_texts()`` with a
        single-element batch.  Override if the provider distinguishes between
        query and document encoding modes.

        Args:
            query: The query string to embed.

        Returns:
            A single floating-point vector.

        Raises:
            EmbeddingError: If the provider call fails.
        """
        results = await self.embed_texts([query])
        return results[0]


class BaseAPIEmbedder(BaseEmbedder):
    """Base class for API-based embedders that need batching, concurrency control, and retries.

    Subclasses must implement `_embed_batch`. Slicing, parallel gathering via semaphore,
    and automatic retries are handled by this class.
    """

    def __init__(
        self,
        batch_size: int,
        max_concurrency: int = 5,
        retry_attempts: int = 4,
    ) -> None:
        """Initialize the API embedder.

        Args:
            batch_size: Maximum number of texts per API request.
            max_concurrency: Maximum concurrent API requests.
            retry_attempts: Number of retry attempts on failure.
        """
        self.batch_size = batch_size
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._retry_attempts = retry_attempts

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts by batching and processing them concurrently.

        Uses a semaphore to limit concurrency and a tenacity-based retry loop.
        """
        if not texts:
            return []

        # 1. Slice texts into batches of batch_size
        batches = [
            texts[i : i + self.batch_size]
            for i in range(0, len(texts), self.batch_size)
        ]

        # 2. Run all batches concurrently with semaphore and retry logic
        async def process_batch_with_retry(batch: list[str]) -> list[list[float]]:
            async with self._semaphore:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(self._retry_attempts),
                    wait=wait_exponential(multiplier=1, min=2, max=10),
                    retry=retry_if_exception_type(EmbeddingError),
                    reraise=True,
                ):
                    with attempt:
                        return await self._embed_batch(batch)
            raise EmbeddingError("Embedding failed after all retry attempts.")

        tasks = [process_batch_with_retry(b) for b in batches]
        results = await asyncio.gather(*tasks)

        # 3. Flatten the list of lists of vectors
        return [vector for batch_res in results for vector in batch_res]

    @abstractmethod
    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        """Embed a single batch of texts (which has size <= batch_size).

        Must be implemented by subclasses. Should raise EmbeddingError for retry.
        """
        pass

