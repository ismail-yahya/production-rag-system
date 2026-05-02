import openai
import structlog
from openai import AsyncOpenAI
from pydantic import SecretStr

from src.core.exceptions import EmbeddingError
from src.embeddings.base import BaseEmbedder

logger = structlog.get_logger(__name__)

# Maximum texts per API request as defined by OpenAI's embeddings endpoint.
# Sourced from Settings.OPENAI_EMBEDDING_BATCH_SIZE; this constant is used
# internally only as the constructor default.
_DEFAULT_BATCH_SIZE: int = 100


class OpenAIEmbedder(BaseEmbedder):
    """OpenAI implementation of the BaseEmbedder interface.

    Calls ``client.embeddings.create()`` in batches of at most
    ``batch_size`` texts to respect the OpenAI embeddings API limit and
    minimise round-trips.
    """

    def __init__(
        self,
        api_key: SecretStr | None,
        model: str,
        batch_size: int = _DEFAULT_BATCH_SIZE,
    ) -> None:
        """
        Initialize the OpenAI embedder.

        Args:
            api_key:    OpenAI API key as a SecretStr.
            model:      Embedding model name (e.g. ``"text-embedding-3-large"``).
            batch_size: Maximum number of texts per API call.  Must be between
                        1 and 100 inclusive.

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

        try:
            self._client = AsyncOpenAI(api_key=api_key.get_secret_value())
        except Exception as exc:
            raise EmbeddingError(f"Failed to initialize OpenAI client: {exc}") from exc

        self._model = model
        self._batch_size = batch_size

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a batch of texts using the OpenAI Embeddings API.

        Texts are split into sub-batches of at most ``self._batch_size`` items.
        Each sub-batch is sent as a single API request.  Results are
        reassembled in the original input order.

        Args:
            texts: A non-empty list of strings to embed.

        Returns:
            A list of floating-point vectors in the same order as ``texts``.

        Raises:
            EmbeddingError: If any OpenAI API call fails.
        """
        if not texts:
            return []

        all_vectors: list[list[float]] = []

        try:
            for batch_start in range(0, len(texts), self._batch_size):
                batch = texts[batch_start : batch_start + self._batch_size]

                logger.debug(
                    "openai_embedder.batch_request",
                    model=self._model,
                    batch_size=len(batch),
                    batch_start=batch_start,
                )

                response = await self._client.embeddings.create(
                    model=self._model,
                    input=batch,
                )

                # OpenAI guarantees the response order matches the input order.
                batch_vectors = [item.embedding for item in response.data]
                all_vectors.extend(batch_vectors)

        except openai.OpenAIError as exc:
            raise EmbeddingError(f"OpenAI API error during embed_texts: {exc}") from exc

        return all_vectors
