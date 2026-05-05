from typing import Annotated

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import SemanticCache
from src.core.config import settings
from src.core.context import tenant_id_context
from src.core.database import get_session
from src.core.models import Tenant
from src.embeddings.factory import EmbedderFactory
from src.llm.factory import LLMFactory
from src.rag.context_builder import ContextBuilder
from src.rag.pipeline import RAGPipeline
from src.rag.query_processor import QueryProcessor
from src.retrieval.hybrid_retriever import HybridRetriever
from src.retrieval.reranker import CohereReranker
from src.vectorstore.factory import VectorStoreFactory

security = HTTPBearer()


async def get_tenant(
    auth: Annotated[HTTPAuthorizationCredentials, Security(security)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Tenant:
    """
    Dependency that validates the Bearer token and returns the Tenant model.
    In this MVP, the token is treated as the raw API key hash for simplicity,
    as per the TDD Phase 1 requirements.
    """
    # In a production system, we would hash the incoming credential
    # and compare it against the stored hash.
    api_key = auth.credentials

    stmt = select(Tenant).where(Tenant.api_key_hash == api_key, Tenant.is_active)
    result = await session.execute(stmt)
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    # Inject tenant_id into the global request context
    tenant_id_context.set(tenant.id)

    return tenant


def get_rag_pipeline() -> RAGPipeline:
    """
    Dependency that provides a stateless RAGPipeline instance.
    The pipeline's dependencies are instantiated via their respective factories.
    """
    llm = LLMFactory.create(settings.LLM_PROVIDER, settings)
    embedder = EmbedderFactory.create(settings.EMBEDDING_PROVIDER, settings)
    vector_store = VectorStoreFactory.create(settings.VECTOR_STORE_PROVIDER, settings)

    retriever = HybridRetriever(vector_store, embedder)
    reranker = CohereReranker()
    query_processor = QueryProcessor(llm)
    context_builder = ContextBuilder(max_tokens=settings.RAG_CONTEXT_MAX_TOKENS)
    cache = SemanticCache(embedder)

    return RAGPipeline(
        llm=llm,
        retriever=retriever,
        reranker=reranker,
        query_processor=query_processor,
        context_builder=context_builder,
        cache=cache,
    )


async def get_admin(
    tenant: Annotated[Tenant, Depends(get_tenant)],
) -> Tenant:
    """
    Dependency that ensures the authenticated tenant has admin privileges.
    For MVP, we perform a simple check on the tenant name as a stub for RBAC.
    """
    # TODO(#42): Implement proper role-based access control (RBAC) via JWT or DB roles.
    if "admin" not in tenant.name.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource",
        )
    return tenant
