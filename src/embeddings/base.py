from abc import ABC, abstractmethod


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
