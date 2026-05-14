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
    similarity_threshold: float = settings.RETRIEVAL_SIMILARITY_THRESHOLD
    search_type: str = settings.RETRIEVAL_SEARCH_TYPE
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
        search_type: str | None = None,
        vector_weight: float | None = None,
        keyword_weight: float | None = None,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
    ) -> list[Document]:
        """
        Perform retrieval with support for different search types and weight overrides.

        Args:
            query: The natural language query.
            tenant_id: The ID of the tenant to scope the search to.
            filters: Additional metadata filters to apply.
            search_type: Override for search mode ('semantic', 'literal', 'hybrid').
            vector_weight: Override for semantic weight.
            keyword_weight: Override for keyword weight.
            top_k: Override for number of chunks to fetch initially.
            similarity_threshold: Minimum similarity score to include a result.

        Returns:
            A list of Document objects sorted by fused score.
        """
        # Enforce tenant isolation from global context if available.
        context_tenant_id = tenant_id_context.get()
        if context_tenant_id and context_tenant_id != tenant_id:
            logger.warning(
                "tenant_id_override",
                provided=str(tenant_id),
                context=str(context_tenant_id)
            )
            tenant_id = context_tenant_id

        start_time = time.perf_counter()

        # Resolve configuration with overrides
        s_type = search_type or self._config.search_type
        v_weight = vector_weight if vector_weight is not None else self._config.vector_weight
        k_weight = keyword_weight if keyword_weight is not None else self._config.keyword_weight
        t_k = top_k or self._config.top_k
        threshold = similarity_threshold if similarity_threshold is not None else self._config.similarity_threshold

        # Adjust weights and parameters based on search type
        if s_type == "semantic":
            v_weight, k_weight = 1.0, 0.0
        elif s_type == "literal":
            v_weight, k_weight = 0.0, 1.0
            # For literal search, we fetch more candidates to ensure keyword matches are found
            t_k = max(t_k, settings.RETRIEVAL_TOP_K * 5)

        # 1. Vector Retrieval (Semantic)
        vector_results = await self._vector_retriever.retrieve(
            query=query,
            tenant_id=tenant_id,
            top_k=t_k,
            filters=filters,
        )

        if not vector_results:
            self._log_retrieval(query, 0, start_time, s_type)
            return []

        # 2. BM25 Re-scoring (Keyword signal over semantic candidates)
        # Skip if keyword weight is zero (pure semantic)
        if k_weight > 0:
            keyword_results = await self._bm25_retriever.retrieve(
                query=query, candidates=vector_results
            )
        else:
            keyword_results = []

        # 3. Fusion Logic
        if s_type == "semantic" or k_weight <= 0:
            # Pure semantic search: use vector results directly with their original scores
            fused_results = vector_results
        elif s_type == "literal" or v_weight <= 0:
            # Pure literal search: use BM25 results directly
            # Filter out results that don't match the keyword at all (score > 0)
            fused_results = [doc for doc in keyword_results if (doc.score or 0.0) > 0.0]
        else:
            # Hybrid search: Reciprocal Rank Fusion (RRF)
            vector_ranks = {doc.id: i + 1 for i, doc in enumerate(vector_results)}
            keyword_ranks = {doc.id: i + 1 for i, doc in enumerate(keyword_results)}

            fused_results = []
            for doc in vector_results:
                vr = vector_ranks.get(doc.id)
                kr = keyword_ranks.get(doc.id)

                score = 0.0
                if vr:
                    score += v_weight * (1.0 / (self._config.rrf_k + vr))
                if kr:
                    score += k_weight * (1.0 / (self._config.rrf_k + kr))

                fused_results.append(
                    Document(
                        id=doc.id,
                        content=doc.content,
                        metadata=doc.metadata,
                        embedding=doc.embedding,
                        score=score,
                    )
                )
            fused_results.sort(key=lambda x: x.score or 0.0, reverse=True)

        # 4. Filter by similarity threshold if applicable (only for semantic/vector scores)
        # Note: BM25/RRF scores are on different scales, so we apply threshold to vector results if available
        if threshold > 0:
            # Map vector scores for quick lookup
            v_scores = {doc.id: doc.score or 0.0 for doc in vector_results}
            fused_results = [
                doc for doc in fused_results 
                if v_scores.get(doc.id, 0.0) >= threshold
            ]

        # 5. Limit to final top_k
        final_results = fused_results[: self._config.final_top_k]

        self._log_retrieval(query, len(final_results), start_time, s_type)

        return final_results

    def _log_retrieval(self, query: str, count: int, start_time: float, search_type: str) -> None:
        """Log retrieval metadata as per AGENTS.md requirements."""
        latency_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "hybrid_retrieval_completed",
            question=query[:100],
            retrieval_count=count,
            search_type=search_type,
            latency_ms=round(latency_ms, 2),
        )
