from enum import Enum

from src.core import Settings
from src.vectorstore.base import BaseVectorStore
from src.vectorstore.qdrant_store import QdrantVectorStore


class VectorStoreProvider(str, Enum):
    """Supported vector store providers."""

    QDRANT = "qdrant"


class VectorStoreFactory:
    """
    Factory for creating vector store provider instances.
    Follows the registry pattern for extensibility.
    """

    _registry: dict[VectorStoreProvider, type[BaseVectorStore]] = {
        VectorStoreProvider.QDRANT: QdrantVectorStore,
    }

    @classmethod
    def create(cls, provider: str | VectorStoreProvider, settings: Settings) -> BaseVectorStore:
        """
        Create a concrete vector store provider instance.

        Args:
            provider: The provider identifier (string or VectorStoreProvider enum).
            settings: Application settings containing connection details.

        Returns:
            An instance of a class that implements the BaseVectorStore interface.

        Raises:
            ValueError: If the provider is not supported.
        """
        if isinstance(provider, str):
            try:
                provider_enum = VectorStoreProvider(provider.lower())
            except ValueError:
                raise ValueError(f"Unsupported vector store provider: {provider}")
        else:
            provider_enum = provider

        provider_cls = cls._registry.get(provider_enum)
        if not provider_cls:
            raise ValueError(f"Unsupported vector store provider: {provider_enum}")

        if provider_enum == VectorStoreProvider.QDRANT:
            return QdrantVectorStore(
                url=settings.QDRANT_URL,
                collection_name=settings.QDRANT_COLLECTION_NAME,
            )

        raise ValueError(f"Unsupported vector store provider: {provider_enum}")  # pragma: no cover
