"""
Core utilities and configuration for the RAG system.
Exposes settings, logging, and common exceptions.
"""

from src.core.config import Settings, settings
from src.core.database import get_session
from src.core.exceptions import (
    EmbeddingError,
    IngestionError,
    LLMError,
    RAGSystemError,
    RetrievalError,
    SecurityError,
)
from src.core.logging import logger, setup_logging
from src.core.models import Base, Tenant
from src.core.storage import storage_service

__all__ = [
    "settings",
    "Settings",
    "setup_logging",
    "logger",
    "get_session",
    "storage_service",
    "RAGSystemError",
    "IngestionError",
    "RetrievalError",
    "EmbeddingError",
    "LLMError",
    "SecurityError",
    "Base",
    "Tenant",
]
