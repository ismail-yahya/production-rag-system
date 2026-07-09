"""
FastAPI dependency functions for authentication and service injection.

Authentication strategy:
  1. get_current_user() — accepts Bearer JWT OR Bearer API-Key (raw)
     - Tries JWT first (fast, no DB hit)
     - Falls back to API key lookup (DB JOIN on api_keys + users)
  2. get_tenant() — BACKWARD COMPATIBILITY ONLY — wraps get_current_user
     for existing routers that expect a Tenant model.
     Will be migrated away in Phase 3.
  3. get_admin() — validates ADMIN or SUPER_ADMIN role.
"""

import uuid
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import decode_access_token, verify_api_key
from src.core.cache import SemanticCache
from src.core.config import settings
from src.core.context import tenant_id_context, user_id_context
from src.core.database import get_session as get_session
from src.core.models import Tenant, User
from src.embeddings.factory import EmbedderFactory
from src.llm.factory import LLMFactory
from src.rag.context_builder import ContextBuilder
from src.rag.pipeline import RAGPipeline
from src.rag.query_processor import QueryProcessor
from src.retrieval.hybrid_retriever import HybridRetriever
from src.retrieval.reranker import CohereReranker
from src.vectorstore.factory import VectorStoreFactory

logger = structlog.get_logger(__name__)
security = HTTPBearer()


# ---------------------------------------------------------------------------
# Primary authentication dependency — JWT or API Key
# ---------------------------------------------------------------------------


async def get_current_user(
    auth: Annotated[HTTPAuthorizationCredentials, Security(security)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """
    Authenticate the request and return the current User.

    Accepts two forms of Bearer token:
      1. JWT access token  — decoded in memory, no DB hit required.
      2. Raw API key       — looked up via bcrypt verification against api_keys table.

    Both paths return a fully hydrated User model with tenant_id populated.
    """
    from src.api.repositories import ApiKeyRepository, UserRepository

    token = auth.credentials

    # ------------------------------------------------------------------
    # Attempt 1: JWT decoding (fast path — no database query)
    # ------------------------------------------------------------------
    try:
        payload = decode_access_token(token)

        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tid"])

        user_repo = UserRepository(session)
        user = await user_repo.get_by_id(user_id, tenant_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or has been deactivated",
            )

        # Inject tenant_id and user_id into request context
        tenant_id_context.set(user.tenant_id)
        user_id_context.set(user.id)
        return user

    except HTTPException:
        raise
    except Exception:
        # JWT decode failed — not a JWT token, try API key lookup
        pass

    # ------------------------------------------------------------------
    # Attempt 2: API Key lookup (slower path — bcrypt + DB query)
    # The token is treated as a raw API key.
    # We retrieve all active api_keys for the hash match.
    # ------------------------------------------------------------------
    try:
        from src.core.models import ApiKey

        # Fetch candidate api_keys by checking against raw token
        # We cannot query by hash directly since bcrypt hashes are non-deterministic.
        # Strategy: get all active keys for the tenant (small set) and verify each.
        # For high-traffic systems, consider adding a fast prefix lookup.
        stmt = select(ApiKey).where(ApiKey.is_active.is_(True))
        result = await session.execute(stmt)
        api_keys = result.scalars().all()

        matched_key = None
        for api_key in api_keys:
            if verify_api_key(token, api_key.key_hash):
                matched_key = api_key
                break

        if matched_key is None:
            raise Exception("API key lookup failed, try legacy fallback")

        user_repo = UserRepository(session)
        user = await user_repo.get_by_id(matched_key.user_id, matched_key.tenant_id)

        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or has been deactivated",
            )

        # Record API key usage asynchronously (best-effort, no await needed)
        api_key_repo = ApiKeyRepository(session)
        await api_key_repo.record_usage(matched_key.id)

        tenant_id_context.set(user.tenant_id)
        user_id_context.set(user.id)
        return user

    except HTTPException:
        raise
    except Exception as exc:
        # ------------------------------------------------------------------
        # Attempt 3: Backward-compatibility for Tenant API key
        # ------------------------------------------------------------------
        try:
            stmt = select(Tenant).where(Tenant.api_key_hash == token, Tenant.is_active.is_(True))
            result = await session.execute(stmt)
            tenant = result.scalar_one_or_none()

            if tenant:
                user_repo = UserRepository(session)
                legacy_email = f"legacy_admin_{tenant.id}@system.local"
                user = await user_repo.get_by_email(legacy_email, tenant.id)
                role = "ADMIN" if "admin" in tenant.name.lower() else "USER"
                if not user:
                    user = await user_repo.create(
                        tenant_id=tenant.id,
                        email=legacy_email,
                        name=tenant.name,
                        role=role,
                    )
                    await session.commit()
                elif user.role != role:
                    user.role = role
                    await session.commit()

                tenant_id_context.set(tenant.id)
                user_id_context.set(user.id)
                return user
        except Exception as fallback_exc:
            logger.warning("legacy_auth_fallback_failed", error=str(fallback_exc))

        logger.warning("auth_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        ) from exc


# ---------------------------------------------------------------------------
# Backward-compatible tenant dependency — DO NOT use in new routes
# ---------------------------------------------------------------------------


async def get_tenant(
    auth: Annotated[HTTPAuthorizationCredentials, Security(security)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Tenant:
    """
    BACKWARD COMPATIBILITY: Returns the Tenant for the authenticated user.

    This dependency exists so that ingestion, query, and admin routers
    (which were written before Phase 2) continue to work without modification.
    It will be removed in Phase 3 when those routers are migrated to get_current_user.

    NOTE: For new routes, use get_current_user() directly.
    """
    # Original MVP behavior: compare raw API key against stored hash value.
    # The existing tenants.api_key_hash column stores the raw key (not a bcrypt hash)
    # because Phase 1 had not yet implemented real hashing.
    api_key = auth.credentials

    stmt = select(Tenant).where(Tenant.api_key_hash == api_key, Tenant.is_active)
    result = await session.execute(stmt)
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    tenant_id_context.set(tenant.id)
    return tenant


# ---------------------------------------------------------------------------
# Admin authorization — old path (wraps get_tenant for backward compat)
# ---------------------------------------------------------------------------


async def get_admin(
    tenant: Annotated[Tenant, Depends(get_tenant)],
) -> Tenant:
    """
    BACKWARD COMPATIBILITY: Ensures the authenticated tenant has admin privileges.

    Replaced by require_role(ADMIN, SUPER_ADMIN) from permissions.py in new routes.
    Will be removed in Phase 3.
    """
    # TODO(#42): Remove after admin.py is migrated to get_current_user + require_role
    if "admin" not in tenant.name.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource",
        )
    return tenant


# ---------------------------------------------------------------------------
# Role-based access control — use in all new routes
# ---------------------------------------------------------------------------


def require_role(*roles: str):
    """
    Returns a FastAPI dependency that enforces at least one of the given roles.

    Usage:
        @router.get("/admin/stats")
        async def stats(admin: Annotated[User, Depends(require_role("ADMIN", "SUPER_ADMIN"))]):
            ...

    Args:
        roles: One or more valid role strings (e.g. "ADMIN", "SUPER_ADMIN").
    """
    allowed = set(roles)
    if not allowed:
        raise ValueError("require_role() called with no roles")

    async def _dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed:
            detail = f"Access restricted to roles: {', '.join(sorted(allowed))}"
            if "ADMIN" in allowed or "SUPER_ADMIN" in allowed:
                detail = "Administrative privileges required to access this resource"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )
        return current_user

    return _dependency


# ---------------------------------------------------------------------------
# RAG pipeline factory
# ---------------------------------------------------------------------------


def get_semantic_cache() -> SemanticCache | None:
    """
    Dependency that returns a SemanticCache instance if caching is enabled.

    Returns None when SEMANTIC_CACHE_ENABLED=False so callers can skip caching
    without changing their logic.
    """
    if not settings.SEMANTIC_CACHE_ENABLED:
        return None
    embedder = EmbedderFactory.create(settings.EMBEDDING_PROVIDER, settings)
    return SemanticCache(embedder)


def get_rag_pipeline(
    cache: SemanticCache | None = Depends(get_semantic_cache),
) -> RAGPipeline:
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

    return RAGPipeline(
        llm=llm,
        retriever=retriever,
        reranker=reranker,
        query_processor=query_processor,
        context_builder=context_builder,
        cache=cache,
    )
