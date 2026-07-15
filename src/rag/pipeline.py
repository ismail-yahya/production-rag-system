import asyncio
import hashlib
import time
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any
from uuid import UUID

import structlog

from src.core.cache import SemanticCache
from src.llm.base import BaseLLM, LLMMessage
from src.observability.tracer import traceable
from src.rag.context_builder import ContextBuilder
from src.rag.prompt_templates import (
    ANTI_HALLUCINATION_SYSTEM_PROMPT,
    RAG_SYSTEM_PROMPT,
    RAG_USER_PROMPT_TEMPLATE,
)
from src.rag.query_processor import QueryProcessor
from src.rag.schemas import RAGResponse, Source
from src.rag.security import SecurityGuard
from src.retrieval.hybrid_retriever import HybridRetriever
from src.retrieval.reranker import CohereReranker

if TYPE_CHECKING:
    from src.vectorstore.base import Document

logger = structlog.get_logger(__name__)


class RAGPipeline:
    """
    Top-level orchestrator for the RAG query execution path.

    It coordinates query processing, retrieval, reranking, context construction,
    and LLM generation while enforcing security and tracking performance.

    Caching: The blocking `query()` path supports a Semantic Cache.
    Streaming `stream_query()` does NOT use the cache — streaming responses
    are inherently ephemeral and cannot be meaningfully serialised.
    """

    def __init__(
        self,
        llm: BaseLLM,
        retriever: HybridRetriever,
        reranker: CohereReranker,
        query_processor: QueryProcessor,
        context_builder: ContextBuilder,
        cache: SemanticCache | None = None,
    ) -> None:
        """
        Initialize the RAGPipeline with its required dependencies.

        Args:
            llm: Abstract LLM interface for answer generation.
            retriever: Hybrid retriever for multi-stage document search.
            reranker: Reranker for refining retrieval results.
            query_processor: Processor for expansion and classification.
            context_builder: Builder for constructing the LLM context window.
            cache: Optional semantic cache. If None, caching is disabled.
        """
        self.llm = llm
        self.retriever = retriever
        self.reranker = reranker
        self.query_processor = query_processor
        self.context_builder = context_builder
        self.cache = cache

    @traceable
    async def query(
        self,
        question: str,
        tenant_id: UUID,
        mode: str = "standard",
        filters: dict[str, Any] | None = None,
        search_type: str | None = None,
        search_config: dict[str, Any] | None = None,
    ) -> RAGResponse:
        """
        Executes a complete RAG query flow (blocking).

        Args:
            question: The natural language question from the user.
            tenant_id: The ID of the tenant to scope the search to.
            mode: Query mode ('standard' or 'strict').
            filters: Additional metadata filters for retrieval.

        Returns:
            A RAGResponse containing the answer, sources, and metadata.

        Raises:
            SecurityError: If prompt injection is detected.
            LLMError: If expansion or generation fails.
            RetrievalError: If retrieval or reranking fails.
        """
        start_time = time.perf_counter()

        # 1. Security: Sanitize incoming query
        SecurityGuard.sanitize_query(question)

        # 2. Cache Lookup — check before any expensive operations
        # The cache key incorporates mode and filters to avoid serving
        # a cached standard-mode response to a strict-mode request.
        if self.cache:
            cache_key_data = f"{question}|{mode}|{filters}"
            cached_response = await self.cache.get(cache_key_data, tenant_id)
            if cached_response:
                # Update latency_ms to reflect the actual cache hit speed
                cached_response["latency_ms"] = round(
                    (time.perf_counter() - start_time) * 1000, 2
                )
                logger.info(
                    "rag_query_cache_hit",
                    tenant_id=str(tenant_id),
                    latency_ms=cached_response["latency_ms"],
                )
                return RAGResponse(**cached_response)

        # 3. Query Processing: Expand and Classify in a single request
        expansions, category = await self.query_processor.process_query(question)

        # 4. Retrieval: Search for each expansion in parallel
        retrieval_tasks = [
            self.retriever.retrieve(
                q, tenant_id, filters, search_type=search_type, **(search_config or {})
            )
            for q in expansions
        ]
        retrieval_results = await asyncio.gather(*retrieval_tasks)

        # 5. Deduplication: Flatten and keep highest score for each unique content
        unique_docs: dict[str, "Document"] = {}
        for doc_list in retrieval_results:
            for doc in doc_list:
                # Use a hash of the content for deduplication
                content_hash = hashlib.sha256(doc.content.encode()).hexdigest()
                if content_hash not in unique_docs or (doc.score or 0) > (
                    unique_docs[content_hash].score or 0
                ):
                    unique_docs[content_hash] = doc

        candidates = list(unique_docs.values())

        # 6. Reranking: Refine results based on original question
        reranked_docs = await self.reranker.rerank(question, candidates)

        # 7. Context Construction: Format and truncate
        context = self.context_builder.build_context(reranked_docs)

        # 8. Answer Generation
        system_prompt = RAG_SYSTEM_PROMPT
        if mode == "strict":
            system_prompt += "\n" + ANTI_HALLUCINATION_SYSTEM_PROMPT

        user_prompt = RAG_USER_PROMPT_TEMPLATE.format(context=context, question=question)

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]

        response = await self.llm.generate(messages)

        latency_ms = (time.perf_counter() - start_time) * 1000

        # 9. Result Formatting
        sources = [
            Source(
                source_id=i + 1,
                document_id=doc.id,
                file_name=doc.metadata.get("file_name", "Unknown"),
                section_title=doc.metadata.get("section_title"),
                page_number=doc.metadata.get("page_number"),
                relevance_score=doc.score or 0.0,
                snippet=doc.content,
            )
            for i, doc in enumerate(reranked_docs)
        ]

        rag_response = RAGResponse(
            answer=response.content,
            sources=sources,
            query_expansions=expansions,
            retrieval_count=len(sources),
            model=response.model,
            latency_ms=round(latency_ms, 2),
        )

        # 10. Cache Write — only for blocking queries (streaming is not cached)
        if self.cache:
            cache_key_data = f"{question}|{mode}|{filters}"
            await self.cache.set(cache_key_data, tenant_id, rag_response.model_dump())

        logger.info(
            "rag_query_completed",
            model=rag_response.model,
            retrieval_count=rag_response.retrieval_count,
            latency_ms=rag_response.latency_ms,
        )

        return rag_response

    async def stream_query(
        self,
        question: str,
        tenant_id: UUID,
        mode: str = "standard",
        filters: dict[str, Any] | None = None,
        search_type: str | None = None,
        search_config: dict[str, Any] | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Executes a RAG query flow and yields tokens as they are generated.

        NOTE: Streaming responses are NOT cached. The cache is only used
        by the blocking `query()` path.

        Args:
            question: The natural language question.
            tenant_id: The tenant ID.
            mode: Query mode.
            filters: Metadata filters.

        Yields:
            Tokens of the generated answer.
        """
        # Steps 1-6 are identical to blocking query
        SecurityGuard.sanitize_query(question)

        expansions, category = await self.query_processor.process_query(question)

        retrieval_tasks = [
            self.retriever.retrieve(
                q, tenant_id, filters, search_type=search_type, **(search_config or {})
            )
            for q in expansions
        ]
        retrieval_results = await asyncio.gather(*retrieval_tasks)

        unique_docs: dict[UUID, "Document"] = {}
        for doc_list in retrieval_results:
            for doc in doc_list:
                if doc.id not in unique_docs or (doc.score or 0) > (unique_docs[doc.id].score or 0):
                    unique_docs[doc.id] = doc

        reranked_docs = await self.reranker.rerank(question, list(unique_docs.values()))
        context = self.context_builder.build_context(reranked_docs)

        # Yield sources immediately after retrieval/reranking
        sources = [
            Source(
                source_id=i + 1,
                document_id=doc.id,
                file_name=doc.metadata.get("file_name", "Unknown"),
                section_title=doc.metadata.get("section_title"),
                page_number=doc.metadata.get("page_number"),
                relevance_score=doc.score or 0.0,
                snippet=doc.content,
            )
            for i, doc in enumerate(reranked_docs)
        ]
        yield {"type": "sources", "sources": [s.model_dump(mode="json") for s in sources]}

        system_prompt = RAG_SYSTEM_PROMPT
        if mode == "strict":
            system_prompt += "\n" + ANTI_HALLUCINATION_SYSTEM_PROMPT

        user_prompt = RAG_USER_PROMPT_TEMPLATE.format(context=context, question=question)

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]

        async for token in self.llm.stream(messages):
            yield {"type": "token", "content": token}
