import asyncio
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import structlog

# TEMPORARILY DISABLED — Semantic Cache feature paused (see steps 2 & 9 below).
# تم تعليق ميزة الذاكرة المخبئية الدلالية مؤقتاً — راجع الخطوتين 2 و 9 أدناه.
# from src.core.cache import SemanticCache
from src.core.exceptions import LLMError, SecurityError
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
from src.vectorstore.base import Document

logger = structlog.get_logger(__name__)


class RAGPipeline:
    """
    Top-level orchestrator for the RAG query execution path.

    It coordinates query processing, retrieval, reranking, context construction,
    and LLM generation while enforcing security and tracking performance.
    """

    def __init__(
        self,
        llm: BaseLLM,
        retriever: HybridRetriever,
        reranker: CohereReranker,
        query_processor: QueryProcessor,
        context_builder: ContextBuilder,
        # TEMPORARILY DISABLED — cache parameter kept for future re-enablement.
        # تم تعليق معامل الكاش مؤقتاً مع الإبقاء عليه لإعادة التفعيل لاحقاً.
        # cache: SemanticCache | None = None,
    ) -> None:
        """
        Initialize the RAGPipeline with its required dependencies.

        Args:
            llm: Abstract LLM interface for answer generation.
            retriever: Hybrid retriever for multi-stage document search.
            reranker: Reranker for refining retrieval results.
            query_processor: Processor for expansion and classification.
            context_builder: Builder for constructing the LLM context window.
        """
        self.llm = llm
        self.retriever = retriever
        self.reranker = reranker
        self.query_processor = query_processor
        self.context_builder = context_builder
        # TEMPORARILY DISABLED — cache assignment paused alongside constructor param.
        # self.cache = cache
        self.cache = None  # forced to None until Semantic Cache is re-enabled

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

        # 2. Cache Lookup — TEMPORARILY DISABLED
        # ─────────────────────────────────────────────────────────────────────────
        # تم التخلي عن هذه الميزة مؤقتاً.
        # قبل القيام بأي عمليات مكلفة، كان النظام يتحقق مما إذا كان هذا السؤال
        # (أو سؤال مشابه له جداً دلالياً) قد تم طرحه مسبقاً من قبل نفس المستأجر.
        # إذا وجد إجابة جاهزة في Redis، يعيدها فوراً مع تحديث latency_ms.
        # السبب: تحتاج هذه الميزة إلى مزيد من الاختبار وضبط عتبة التشابه الدلالي
        # قبل تفعيلها في بيئة الإنتاج.
        # ─────────────────────────────────────────────────────────────────────────
        # if self.cache:
        #     cached_response = await self.cache.get(question, tenant_id)
        #     if cached_response:
        #         # Return cached response but update latency to reflect cache hit speed
        #         cached_response["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        #         return RAGResponse(**cached_response)

        # 3. Query Processing: Expand and Classify in a single request
        expansions, category = await self.query_processor.process_query(question)

        # 3. Retrieval: Search for each expansion in parallel
        retrieval_tasks = [
            self.retriever.retrieve(
                q, 
                tenant_id, 
                filters,
                search_type=search_type,
                **(search_config or {})
            ) for q in expansions
        ]
        retrieval_results = await asyncio.gather(*retrieval_tasks)

        # 4. Deduplication: Flatten and keep highest score for each doc
        unique_docs: dict[UUID, Document] = {}
        for doc_list in retrieval_results:
            for doc in doc_list:
                if doc.id not in unique_docs or (doc.score or 0) > (
                    unique_docs[doc.id].score or 0
                ):
                    unique_docs[doc.id] = doc

        candidates = list(unique_docs.values())

        # 5. Reranking: Refine results based on original question
        reranked_docs = await self.reranker.rerank(question, candidates)

        # 6. Context Construction: Format and truncate
        context = self.context_builder.build_context(reranked_docs)

        # 7. Answer Generation
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

        # 8. Result Formatting
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

        # 9. Cache Write — TEMPORARILY DISABLED
        # ─────────────────────────────────────────────────────────────────────────
        # تم التخلي عن هذه الخطوة مؤقتاً بالتزامن مع تعطيل خطوة 2 (Cache Lookup).
        # كانت هذه الخطوة تحفظ الإجابة المولّدة في Redis لإعادة استخدامها لاحقاً.
        # ─────────────────────────────────────────────────────────────────────────
        # if self.cache:
        #     await self.cache.set(question, tenant_id, rag_response.model_dump())

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
                q, 
                tenant_id, 
                filters,
                search_type=search_type,
                **(search_config or {})
            ) for q in expansions
        ]
        retrieval_results = await asyncio.gather(*retrieval_tasks)

        unique_docs: dict[UUID, Document] = {}
        for doc_list in retrieval_results:
            for doc in doc_list:
                if doc.id not in unique_docs or (doc.score or 0) > (
                    unique_docs[doc.id].score or 0
                ):
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
        yield {"type": "sources", "sources": [s.model_dump() for s in sources]}

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
