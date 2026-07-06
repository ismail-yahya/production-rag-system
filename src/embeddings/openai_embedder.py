import openai
import structlog
from openai import AsyncOpenAI
from pydantic import SecretStr

from src.core import EmbeddingError
from src.embeddings.base import BaseAPIEmbedder

logger = structlog.get_logger(__name__)

# Maximum texts per API request as defined by OpenAI's embeddings endpoint.
# Sourced from Settings.OPENAI_EMBEDDING_BATCH_SIZE; this constant is used
# internally only as the constructor default.
_DEFAULT_BATCH_SIZE: int = 100


class OpenAIEmbedder(BaseAPIEmbedder):
    """OpenAI implementation of the BaseAPIEmbedder interface.

    Calls ``client.embeddings.create()`` via the concurrent batching engine.
    """

    def __init__(
        self,
        api_key: SecretStr | None,
        model: str,
        batch_size: int = _DEFAULT_BATCH_SIZE,
        max_concurrency: int = 5,
        retry_attempts: int = 4,
    ) -> None:
        """
        Initialize the OpenAI embedder.

        Args:
            api_key:          OpenAI API key as a SecretStr.
            model:            Embedding model name (e.g. ``"text-embedding-3-large"``).
            batch_size:       Maximum number of texts per API call. Must be between
                              1 and 100 inclusive.
            max_concurrency:  Maximum concurrent API requests.
            retry_attempts:   Number of retry attempts on failure.

        Raises:
            EmbeddingError: If the API key is missing or the client cannot be
                            instantiated.
        """
        if api_key is None:
            raise EmbeddingError("OpenAI API key is required but was not provided.")

        if not (1 <= batch_size <= _DEFAULT_BATCH_SIZE):
            raise EmbeddingError(
                f"batch_size must be between 1 and {_DEFAULT_BATCH_SIZE}, got {batch_size}."
            )

        super().__init__(
            batch_size=batch_size,
            max_concurrency=max_concurrency,
            retry_attempts=retry_attempts,
        )

        try:
            self._client = AsyncOpenAI(api_key=api_key.get_secret_value())
        except Exception as exc:
            raise EmbeddingError(f"Failed to initialize OpenAI client: {exc}") from exc

        self._model = model

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        """
        Embed a single batch of texts using the OpenAI Embeddings API.

        Args:
            batch: A list of strings to embed (size <= batch_size).

        Returns:
            A list of floating-point vectors.

        Raises:
            EmbeddingError: If the OpenAI API call fails.
        """
        if not batch:
            return []

        try:
            logger.debug(
                "openai_embedder.batch_request",
                model=self._model,
                batch_size=len(batch),
            )

            response = await self._client.embeddings.create(
                model=self._model,
                input=batch,
            )

            # OpenAI guarantees the response order matches the input order.
            return [item.embedding for item in response.data]

        except openai.OpenAIError as exc:
            raise EmbeddingError(f"OpenAI API error during embed_texts: {exc}") from exc

