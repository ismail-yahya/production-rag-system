import structlog
from typing import Any
from uuid import UUID

from src.vectorstore.base import BaseVectorStore, Document
from src.embeddings.base import BaseEmbedder

logger = structlog.get_logger(__name__)


class VectorRetriever:
    """Retriever that performs semantic search using embeddings.

    This class wraps a vector store and an embedder to provide a simple
    interface for document retrieval based on vector similarity. It enforces
    tenant isolation by requiring a tenant_id for every retrieval call.
    """

    def __init__(
        self,
        vector_store: BaseVectorStore,
        embedder: BaseEmbedder,
    ) -> None:
        """
        Initialize the VectorRetriever.

        Args:
            vector_store: An instance of a concrete BaseVectorStore.
            embedder: An instance of a concrete BaseEmbedder.
        """
        self._vector_store = vector_store
        self._embedder = embedder

    async def retrieve(
        self,
        query: str,
        tenant_id: UUID,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[Document]:
        """
        Retrieve documents semantically similar to the query.

        Args:
            query: The natural language query string.
            tenant_id: The ID of the tenant to scope the search to.
            top_k: The maximum number of documents to retrieve.
            filters: Additional metadata filters to apply to the search.

        Returns:
            A list of Document objects with similarity scores populated.

        Raises:
            RetrievalError: If the vector store search fails.
            EmbeddingError: If the query embedding fails.
        """
        filters = filters or {}
        # Enforce tenant isolation
        filters["tenant_id"] = str(tenant_id)

        # Embed the query
        query_vector = await self._embedder.embed_query(query)

        # Perform the search
        results = await self._vector_store.search(
            query_vector=query_vector,
            top_k=top_k,
            filters=filters,
        )

        return results
