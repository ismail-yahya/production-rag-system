from typing import Annotated
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
import structlog

from src.api.routers import admin, ingestion, query
from src.api.middleware import RateLimitMiddleware, TenantContextMiddleware
from src.api.dependencies import get_session
from src.core.config import settings
from src.core.exceptions import (
    IngestionError,
    LLMError,
    RAGSystemError,
    RetrievalError,
    SecurityError,
)
from src.core.logging import setup_logging
from src.vectorstore.factory import VectorStoreFactory

# Initialize logging
setup_logging()
logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Production RAG System",
    description="Multi-tenant RAG system with asynchronous ingestion.",
    version="0.1.0",
)

# Register middleware
app.add_middleware(TenantContextMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    redis_url=settings.REDIS_BACKEND_URL,
    limit=100,  # Default limit
    window_seconds=60,
)

# Register routers
app.include_router(ingestion.router)
app.include_router(query.router)
app.include_router(admin.router)

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


@app.get("/ready")
async def readiness_check(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
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
