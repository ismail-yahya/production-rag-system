"""
Core utilities and configuration for the RAG system.
Exposes settings, logging, and common exceptions.
"""
from src.core.config import Settings, settings
from src.core.exceptions import (
    EmbeddingError,
    IngestionError,
    LLMError,
    RAGSystemError,
    RetrievalError,
    SecurityError,
)
from src.core.logging import logger, setup_logging

__all__ = [
    "settings",
    "Settings",
    "setup_logging",
    "logger",
    "RAGSystemError",
    "IngestionError",
    "RetrievalError",
    "EmbeddingError",
    "LLMError",
    "SecurityError",
]
