import time
import structlog
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.core.config import settings
from src.vectorstore.base import BaseVectorStore, Document
from src.embeddings.base import BaseEmbedder
from src.core.context import tenant_id_context
from src.retrieval.vector_retriever import VectorRetriever
from src.retrieval.bm25_retriever import BM25Retriever

logger = structlog.get_logger(__name__)


class HybridSearchConfig(BaseModel):
    """Configuration for hybrid search and RRF fusion."""

    model_config = ConfigDict(frozen=True)

    top_k: int = settings.RETRIEVAL_TOP_K
    vector_weight: float = settings.RETRIEVAL_VECTOR_WEIGHT
    keyword_weight: float = settings.RETRIEVAL_KEYWORD_WEIGHT
    final_top_k: int = settings.RETRIEVAL_FINAL_TOP_K
    rrf_k: int = 60  # Constant for RRF algorithm


class HybridRetriever:
    """Retriever that combines semantic and keyword search using RRF fusion.

    It orchestrates VectorRetriever and BM25Retriever, combining their results
    to provide a more robust retrieval signal. It enforces tenant isolation
    by delegating to sub-retrievers.
    """

    def __init__(
        self,
        vector_store: BaseVectorStore,
        embedder: BaseEmbedder,
        config: HybridSearchConfig | None = None,
    ) -> None:
        """
        Initialize the HybridRetriever.

        Args:
            vector_store: Abstract vector store interface.
            embedder: Abstract embedder interface.
            config: Optional configuration override.
        """
        self._config = config or HybridSearchConfig()
        self._vector_retriever = VectorRetriever(vector_store, embedder)
        self._bm25_retriever = BM25Retriever()

    async def retrieve(
        self,
        query: str,
        tenant_id: UUID,
        filters: dict[str, Any] | None = None,
    ) -> list[Document]:
        """
        Perform hybrid retrieval with RRF fusion.

        Args:
            query: The natural language query.
            tenant_id: The ID of the tenant to scope the search to.
            filters: Additional metadata filters to apply.

        Returns:
            A list of Document objects sorted by fused score.
        """
        # Enforce tenant isolation from global context if available.
        # This acts as a security guard-rail in case the parameter is omitted or incorrect.
        context_tenant_id = tenant_id_context.get()
        if context_tenant_id and context_tenant_id != tenant_id:
            logger.warning(
                "tenant_id_override",
                provided=str(tenant_id),
                context=str(context_tenant_id)
            )
            tenant_id = context_tenant_id

        start_time = time.perf_counter()

        # 1. Vector Retrieval (Semantic)
        vector_results = await self._vector_retriever.retrieve(
            query=query,
            tenant_id=tenant_id,
            top_k=self._config.top_k,
            filters=filters,
        )

        if not vector_results:
            self._log_retrieval(query, 0, start_time)
            return []

        # 2. BM25 Re-scoring (Keyword signal over semantic candidates)
        keyword_results = await self._bm25_retriever.retrieve(
            query=query, candidates=vector_results
        )

        # 3. Reciprocal Rank Fusion (RRF)
        vector_ranks = {doc.id: i + 1 for i, doc in enumerate(vector_results)}
        keyword_ranks = {doc.id: i + 1 for i, doc in enumerate(keyword_results)}

        fused_results = []
        # Since BM25 runs over vector results, we only need to iterate vector results
        for doc in vector_results:
            v_rank = vector_ranks.get(doc.id)
            k_rank = keyword_ranks.get(doc.id)

            # Weighted RRF score
            score = 0.0
            if v_rank:
                score += self._config.vector_weight * (
                    1.0 / (self._config.rrf_k + v_rank)
                )
            if k_rank:
                score += self._config.keyword_weight * (
                    1.0 / (self._config.rrf_k + k_rank)
                )

            fused_results.append(
                Document(
                    id=doc.id,
                    content=doc.content,
                    metadata=doc.metadata,
                    embedding=doc.embedding,
                    score=score,
                )
            )

        # 4. Sort and limit to final top_k
        fused_results.sort(key=lambda x: x.score or 0.0, reverse=True)
        final_results = fused_results[: self._config.final_top_k]

        self._log_retrieval(query, len(final_results), start_time)

        return final_results

    def _log_retrieval(self, query: str, count: int, start_time: float) -> None:
        """Log retrieval metadata as per AGENTS.md requirements."""
        latency_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "hybrid_retrieval_completed",
            question=query[:100],
            retrieval_count=count,
            latency_ms=round(latency_ms, 2),
        )
