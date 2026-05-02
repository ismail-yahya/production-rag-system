from enum import Enum

from src.core.config import Settings
from src.embeddings.base import BaseEmbedder
from src.embeddings.local_embedder import LocalEmbedder
from src.embeddings.openai_embedder import OpenAIEmbedder


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""

    OPENAI = "openai"
    LOCAL = "local"


class EmbedderFactory:
    """
    Factory for creating embedding provider instances.
    Follows the registry pattern to allow easy extension.
    """

    _registry: dict[EmbeddingProvider, type[BaseEmbedder]] = {
        EmbeddingProvider.OPENAI: OpenAIEmbedder,
        EmbeddingProvider.LOCAL: LocalEmbedder,
    }

    @classmethod
    def create(cls, provider: str | EmbeddingProvider, settings: Settings) -> BaseEmbedder:
        """
        Create a concrete embedding provider instance based on the provider type.

        Args:
            provider: The provider identifier (string or EmbeddingProvider enum).
            settings: Application settings containing API keys and other configurations.

        Returns:
            An instance of a class that implements the BaseEmbedder interface.

        Raises:
            ValueError: If the provider is not supported.
        """
        # Ensure we have an EmbeddingProvider enum member
        if isinstance(provider, str):
            try:
                provider_enum = EmbeddingProvider(provider.lower())
            except ValueError:
                raise ValueError(f"Unsupported embedding provider: {provider}")
            except Exception as e:
                # Handle unexpected errors gracefully
                raise ValueError(f"Error resolving embedding provider '{provider}': {e}")
        else:
            provider_enum = provider

        provider_cls = cls._registry.get(provider_enum)
        if not provider_cls:
            raise ValueError(f"Unsupported embedding provider: {provider_enum}")

        # Instantiate based on the provider's specific needs
        if provider_enum == EmbeddingProvider.OPENAI:
            return OpenAIEmbedder(
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_EMBEDDING_MODEL,
                batch_size=settings.OPENAI_EMBEDDING_BATCH_SIZE,
            )

        if provider_enum == EmbeddingProvider.LOCAL:
            return LocalEmbedder(
                model_name=settings.LOCAL_EMBEDDING_MODEL,
                device=settings.EMBEDDING_DEVICE,
            )

        raise ValueError(f"Unsupported embedding provider: {provider_enum}")
