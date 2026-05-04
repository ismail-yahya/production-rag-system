import structlog
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from src.api.routers import ingestion, query
from src.api.middleware import RateLimitMiddleware
from src.core.config import settings
from src.core.exceptions import (
    IngestionError,
    LLMError,
    RAGSystemError,
    RetrievalError,
    SecurityError,
)
from src.core.logging import setup_logging

# Initialize logging
setup_logging()
logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Production RAG System",
    description="Multi-tenant RAG system with asynchronous ingestion.",
    version="0.1.0",
)

# Register middleware
app.add_middleware(
    RateLimitMiddleware,
    redis_url=settings.REDIS_BACKEND_URL,
    limit=100,  # Default limit
    window_seconds=60,
)

# Register routers
app.include_router(ingestion.router)
app.include_router(query.router)


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
async def readiness_check() -> dict[str, str]:
    """Readiness check (stub for now)."""
    # In a real app, verify DB and Vector Store connectivity here
    return {"status": "ready"}
