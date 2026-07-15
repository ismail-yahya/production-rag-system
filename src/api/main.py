from contextlib import asynccontextmanager
from typing import Annotated

import structlog
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_session
from src.api.middleware import RateLimitMiddleware, TenantContextMiddleware
from src.api.routers import admin, auth, ingestion, query, users, workspaces, chat, settings as settings_router
from src.core.config import settings
from src.core.exceptions import (
    IngestionError,
    LLMError,
    RAGSystemError,
    RetrievalError,
    SecurityError,
)
from src.core.logging import setup_logging
from src.core.startup import run_startup_checks
from src.vectorstore.factory import VectorStoreFactory

# Initialize logging
setup_logging()
logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """
    FastAPI lifespan handler.
    Startup: run infrastructure health checks and ensure required resources exist.
    Shutdown: nothing to clean up (connections are managed per-request).
    """
    await run_startup_checks()
    yield
    # Shutdown phase — add cleanup logic here if needed in the future.


app = FastAPI(
    title="Production RAG System",
    description="Multi-tenant RAG system with asynchronous ingestion.",
    version="0.1.0",
    lifespan=lifespan,
)

# Register middleware (order matters: outermost middleware is added last)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantContextMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    redis_url=settings.REDIS_BACKEND_URL,
    limit=100,  # Default limit
    window_seconds=60,
)

# Register routers — order determines display order in /docs
app.include_router(auth.router)      # /v1/auth/* — login, refresh, api-keys
app.include_router(users.router)     # /v1/users/* — user management
app.include_router(workspaces.router) # /v1/workspaces/* — workspace management
app.include_router(ingestion.router) # /v1/ingest, /v1/documents
app.include_router(query.router)     # /v1/query, /v1/query/stream
app.include_router(chat.router)      # /v1/chat/*
app.include_router(settings_router.router)  # /v1/settings/*
app.include_router(admin.router)     # /v1/admin/*

# Register Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.exception_handler(RAGSystemError)
async def rag_system_exception_handler(request: Request, exc: RAGSystemError) -> JSONResponse:
    """
    Global exception handler for custom RAG system errors.
    Maps internal error types to appropriate HTTP status codes.
    """
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    if isinstance(exc, SecurityError):
        status_code = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, IngestionError):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    elif isinstance(exc, (RetrievalError, LLMError)):
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    logger.error(
        "RAG system error occurred",
        error_type=exc.__class__.__name__,
        detail=str(exc),
        path=request.url.path,
    )

    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
    )


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness check."""
    return {"status": "healthy"}


@app.get("/ready", response_model=None)
async def readiness_check(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JSONResponse | dict[str, str]:
    """
    Readiness check that verifies DB and Vector Store connectivity.
    """
    # 1. Check Database
    try:
        await session.execute(text("SELECT 1"))
    except Exception as e:
        logger.error("readiness_check_failed_db", error=str(e))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unready", "detail": "Database connection failed"},
        )

    # 2. Check Vector Store
    try:
        vector_store = VectorStoreFactory.create(settings.VECTOR_STORE_PROVIDER, settings)
        if not await vector_store.is_healthy():
            raise Exception("Vector store is_healthy() returned False")
    except Exception as e:
        logger.error("readiness_check_failed_vectorstore", error=str(e))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unready", "detail": "Vector store connection failed"},
        )

    return {"status": "ready"}
