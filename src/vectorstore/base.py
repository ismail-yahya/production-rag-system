from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID


@dataclass
class Document:
    """Value object representing a document chunk in the vector store.

    This dataclass bridges the gap between the raw content/embeddings in the
    vector store and the structured metadata in the relational database.
    """

    id: UUID
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    score: float | None = None


class BaseVectorStore(ABC):
    """Abstract base class for all vector store providers.

    Implementations must handle batch operations and enforce tenant isolation
    via filters provided in every call.
    """

    @abstractmethod
    async def upsert(self, documents: list[Document]) -> None:
        """
        Batch upsert documents into the vector store.

        Args:
            documents: A list of Document objects to index.

        Raises:
            IngestionError: If the vector store call fails.
        """
        pass  # pragma: no cover

    @abstractmethod
    async def search(
        self, query_vector: list[float], top_k: int, filters: dict[str, Any]
    ) -> list[Document]:
        """
        Search for similar documents given a query vector and filters.

        Args:
            query_vector: The embedding vector of the query.
            top_k: Maximum number of results to return.
            filters: Metadata filters to apply (must include tenant_id).

        Returns:
            A list of Document objects with score populated.

        Raises:
            RetrievalError: If the vector store call fails.
        """
        pass  # pragma: no cover

    @abstractmethod
    async def delete(self, filters: dict[str, Any]) -> None:
        """
        Delete documents matching the filters (usually document_id and tenant_id).

        Args:
            filters: Metadata filters to identify documents for deletion.

        Raises:
            RetrievalError: If the vector store call fails.
        """
        pass  # pragma: no cover
