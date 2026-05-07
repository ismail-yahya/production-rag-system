import cohere
import structlog
from pydantic import SecretStr

from src.core.exceptions import EmbeddingError
from src.embeddings.base import BaseEmbedder

logger = structlog.get_logger(__name__)

# Maximum texts per API request as recommended by Cohere for embeddings.
_DEFAULT_BATCH_SIZE: int = 96


class CohereEmbedder(BaseEmbedder):
    """Cohere implementation of the BaseEmbedder interface.

    Uses Cohere's async client to generate embeddings in batches.
    Recommended for multilingual and high-performance RAG systems.
    """

    def __init__(
        self,
        api_key: SecretStr | None,
        model: str = "embed-multilingual-v3.0",
        batch_size: int = _DEFAULT_BATCH_SIZE,
        input_type: str = "search_document",
    ) -> None:
        """
        Initialize the Cohere embedder.

        Args:
            api_key:    Cohere API key as a SecretStr.
            model:      Embedding model name (default: "embed-multilingual-v3.0").
            batch_size: Maximum number of texts per API call.
            input_type: Type of input for the embedding (search_document, search_query, etc.)
        """
        if api_key is None:
            raise EmbeddingError("Cohere API key is required but was not provided.")

        try:
            # We use AsyncClient for non-blocking I/O
            self._client = cohere.AsyncClient(api_key=api_key.get_secret_value())
        except Exception as exc:
            raise EmbeddingError(f"Failed to initialize Cohere client: {exc}") from exc

        self._model = model
        self._batch_size = batch_size
        self._input_type = input_type

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a batch of texts using Cohere's Embed API.

        Args:
            texts: A non-empty list of strings to embed.

        Returns:
            A list of floating-point vectors in the same order as ``texts``.
        """
        if not texts:
            return []

        all_vectors: list[list[float]] = []

        try:
            for batch_start in range(0, len(texts), self._batch_size):
                batch = texts[batch_start : batch_start + self._batch_size]

                logger.debug(
                    "cohere_embedder.batch_request",
                    model=self._model,
                    batch_size=len(batch),
                    batch_start=batch_start,
                )

                response = await self._client.embed(
                    texts=batch,
                    model=self._model,
                    input_type=self._input_type,
                    embedding_types=["float"],
                )

                # Cohere V3 returns an object with embeddings inside
                batch_vectors = response.embeddings.float
                all_vectors.extend(batch_vectors)

        except Exception as exc:
            logger.error("Cohere API error during embed_texts", error=str(exc))
            raise EmbeddingError(f"Cohere API error: {exc}") from exc

        return all_vectors
