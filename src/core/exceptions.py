class RAGSystemError(Exception):
    """Base exception for all application-specific errors."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class IngestionError(RAGSystemError):
    """Raised when document ingestion fails."""

    pass


class RetrievalError(RAGSystemError):
    """Raised when document retrieval fails."""

    pass


class EmbeddingError(RAGSystemError):
    """Raised when embedding generation fails."""

    pass


class LLMError(RAGSystemError):
    """Raised when LLM generation fails."""

    pass


class SecurityError(RAGSystemError):
    """Raised when a security violation (e.g. prompt injection) is detected."""

    pass
