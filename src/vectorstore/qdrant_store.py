from typing import Any
from uuid import UUID

import structlog
from qdrant_client import AsyncQdrantClient, models

from src.core import IngestionError, RetrievalError, settings
from src.vectorstore.base import BaseVectorStore, Document

logger = structlog.get_logger(__name__)


class QdrantVectorStore(BaseVectorStore):
    """Qdrant implementation of the BaseVectorStore.

    Uses AsyncQdrantClient for non-blocking I/O and enforces tenant isolation
    on every read and write operation.
    """

    def __init__(self, url: str | None = None, collection_name: str | None = None) -> None:
        """
        Initialize the Qdrant client.

        Args:
            url: Qdrant service URL. Defaults to settings.QDRANT_URL.
            collection_name: Collection to use. Defaults to settings.QDRANT_COLLECTION_NAME.
        """
        self.url = url or settings.QDRANT_URL
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        self._client = AsyncQdrantClient(url=self.url)

    async def upsert(self, documents: list[Document]) -> None:
        """
        Batch upsert documents into Qdrant.

        Args:
            documents: List of Document objects with embeddings populated.

        Raises:
            IngestionError: If the upsert operation fails.
        """
        if not documents:
            return

        points = []
        for doc in documents:
            if doc.embedding is None:
                logger.error("qdrant_upsert_missing_embedding", document_id=str(doc.id))
                raise IngestionError(f"Document {doc.id} is missing embedding for upsert.")

            points.append(
                models.PointStruct(
                    id=str(doc.id),
                    vector=doc.embedding,
                    payload={"content": doc.content, **doc.metadata},
                )
            )

        try:
            await self._client.upsert(
                collection_name=self.collection_name, points=points, wait=True
            )
            logger.info(
                "qdrant_upsert_completed", collection=self.collection_name, count=len(points)
            )
        except Exception as e:
            logger.error("qdrant_upsert_failed", error=str(e), collection=self.collection_name)
            raise IngestionError(f"Failed to upsert documents to Qdrant: {str(e)}") from e

    async def search(
        self, query_vector: list[float], top_k: int, filters: dict[str, Any]
    ) -> list[Document]:
        """
        Search for similar documents in Qdrant with tenant scoping.

        Args:
            query_vector: The embedding vector of the query.
            top_k: Maximum number of results to return.
            filters: Metadata filters to apply (MUST include tenant_id).

        Returns:
            A list of Document objects with scores.

        Raises:
            RetrievalError: If the search operation fails or tenant_id is missing.
        """
        if "tenant_id" not in filters:
            logger.error("qdrant_search_missing_tenant_id", filters=filters)
            raise RetrievalError("Missing mandatory tenant_id filter for vector search.")

        qdrant_filter = self._build_filter(filters)

        try:
            response = await self._client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=top_k,
                query_filter=qdrant_filter,
                with_vectors=False,
                with_payload=True,
            )

            documents = []
            for res in response.points:
                payload = res.payload or {}
                # Extract content and leave the rest as metadata
                content = str(payload.pop("content", ""))
                documents.append(
                    Document(
                        id=UUID(str(res.id)), content=content, metadata=payload, score=res.score
                    )
                )

            logger.debug(
                "qdrant_search_completed",
                collection=self.collection_name,
                result_count=len(documents),
            )
            return documents

        except Exception as e:
            logger.error("qdrant_search_failed", error=str(e), collection=self.collection_name)
            raise RetrievalError(f"Failed to search Qdrant: {str(e)}") from e

    async def delete(self, filters: dict[str, Any]) -> None:
        """
        Delete documents from Qdrant matching the filters.

        Args:
            filters: Metadata filters (MUST include tenant_id).

        Raises:
            RetrievalError: If the delete operation fails or tenant_id is missing.
        """
        if "tenant_id" not in filters:
            logger.error("qdrant_delete_missing_tenant_id", filters=filters)
            raise RetrievalError("Missing mandatory tenant_id filter for deletion.")

        qdrant_filter = self._build_filter(filters)

        try:
            await self._client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=qdrant_filter),
            )
            logger.info("qdrant_delete_completed", collection=self.collection_name, filters=filters)
        except Exception as e:
            logger.error("qdrant_delete_failed", error=str(e), collection=self.collection_name)
            raise RetrievalError(f"Failed to delete from Qdrant: {str(e)}") from e

    def _build_filter(self, filters: dict[str, Any]) -> models.Filter:
        """
        Transform a simple filter dict into Qdrant models.Filter.

        Args:
            filters: Key-value pairs to filter by. Supports lists for MatchAny.
        """
        must_filters = []
        for key, value in filters.items():
            if isinstance(value, list):
                must_filters.append(
                    models.FieldCondition(key=key, match=models.MatchAny(any=value))
                )
            else:
                must_filters.append(
                    models.FieldCondition(key=key, match=models.MatchValue(value=value))
                )

        return models.Filter(must=must_filters)  # type: ignore[arg-type]

    async def is_healthy(self) -> bool:
        """
        Check if the Qdrant service is healthy and reachable.
        """
        try:
            # We just need to verify connection to the client
            # get_collections is a lightweight call to check liveness
            await self._client.get_collections()
            return True
        except Exception as e:
            logger.error("qdrant_health_check_failed", error=str(e))
            return False
