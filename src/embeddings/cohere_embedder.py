import cohere
import structlog
from pydantic import SecretStr

from src.core.exceptions import EmbeddingError
from src.embeddings.base import BaseAPIEmbedder

logger = structlog.get_logger(__name__)

# Maximum texts per API request as recommended by Cohere for embeddings.
_DEFAULT_BATCH_SIZE: int = 96


class CohereEmbedder(BaseAPIEmbedder):
    """Cohere implementation of the BaseAPIEmbedder interface.

    Uses Cohere's async client to generate embeddings concurrently in batches.
    """

    def __init__(
        self,
        api_key: SecretStr | None,
        model: str = "embed-multilingual-v3.0",
        batch_size: int = _DEFAULT_BATCH_SIZE,
        input_type: str = "search_document",
        max_concurrency: int = 5,
        retry_attempts: int = 4,
    ) -> None:
        """
        Initialize the Cohere embedder.

        Args:
            api_key:          Cohere API key as a SecretStr.
            model:            Embedding model name (default: "embed-multilingual-v3.0").
            batch_size:       Maximum number of texts per API call.
            input_type:       Type of input for the embedding (search_document, search_query, etc.)
            max_concurrency:  Maximum concurrent API requests.
            retry_attempts:   Number of retry attempts on failure.
        """
        if api_key is None:
            raise EmbeddingError("Cohere API key is required but was not provided.")

        super().__init__(
            batch_size=batch_size,
            max_concurrency=max_concurrency,
            retry_attempts=retry_attempts,
        )

        try:
            # We use AsyncClient for non-blocking I/O
            self._client = cohere.AsyncClient(api_key=api_key.get_secret_value())
        except Exception as exc:
            raise EmbeddingError(f"Failed to initialize Cohere client: {exc}") from exc

        self._model = model
        self._input_type = input_type

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        """
        Embed a single batch of texts using Cohere's Embed API.

        Args:
            batch: A list of strings to embed.

        Returns:
            A list of floating-point vectors in the same order as ``batch``.
        """
        if not batch:
            return []

        try:
            logger.debug(
                "cohere_embedder.batch_request",
                model=self._model,
                batch_size=len(batch),
            )

            response = await self._client.embed(
                texts=batch,
                model=self._model,
                input_type=self._input_type,
                embedding_types=["float"],
            )

            # Cohere V3 returns an object with embeddings inside
            batch_vectors = response.embeddings.float  # type: ignore[union-attr]
            return batch_vectors

        except Exception as exc:
            logger.error("Cohere API error during _embed_batch", error=str(exc))
            raise EmbeddingError(f"Cohere API error: {exc}") from exc

