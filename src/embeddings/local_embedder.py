import asyncio
from typing import Any

import structlog

from src.core import EmbeddingError
from src.embeddings.base import BaseEmbedder

logger = structlog.get_logger(__name__)


class LocalEmbedder(BaseEmbedder):
    """
    Local implementation of the BaseEmbedder interface using sentence-transformers.

    This implementation runs models locally (e.g., BGE-M3) and uses asyncio.to_thread
    to ensure that the synchronous CPU-bound encoding process does not block the
    event loop.
    """

    def __init__(
        self,
        model_name: str,
        device: str = "cpu",
        **kwargs: Any,
    ) -> None:
        """
        Initialize the local embedder.

        Args:
            model_name: The name or path of the sentence-transformer model.
            device: The device to run the model on ('cpu', 'cuda', etc.).
            **kwargs: Additional arguments passed to the SentenceTransformer constructor.
        """
        try:
            from sentence_transformers import SentenceTransformer  # noqa: PLC0415

            logger.info("loading_local_embedding_model", model=model_name, device=device)
            self._model = SentenceTransformer(model_name, device=device, **kwargs)
            self._model_name = model_name
        except Exception as e:
            logger.error("failed_to_load_local_model", error=str(e), model=model_name)
            raise EmbeddingError(f"Failed to load local embedding model '{model_name}': {e}") from e

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a batch of texts using the local model.

        Args:
            texts: A list of strings to embed.

        Returns:
            A list of floating-point vectors.

        Raises:
            EmbeddingError: If embedding generation fails.
        """
        if not texts:
            return []

        try:
            # sentence-transformers encode is synchronous and CPU-bound.
            # We use to_thread to avoid blocking the main event loop.
            embeddings = await asyncio.to_thread(
                self._model.encode,
                texts,
                convert_to_list=True,
                show_progress_bar=False,
            )

            # Ensure the output is a list of lists of floats
            return [[float(val) for val in vec] for vec in embeddings]

        except Exception as e:
            logger.error("local_embedding_failed", error=str(e), model=self._model_name)
            raise EmbeddingError(f"Local embedding generation failed: {e}") from e

    async def embed_query(self, query: str) -> list[float]:
        """
        Embed a single query string.

        Overridden to ensure single text processing follows the same thread pattern.
        """
        results = await self.embed_texts([query])
        return results[0]
