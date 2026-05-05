import pytest
from src.core.exceptions import (
    RAGSystemError,
    IngestionError,
    RetrievalError,
    EmbeddingError,
    LLMError,
    SecurityError,
)

def test_exceptions_inheritance():
    """Verify that all custom exceptions inherit from RAGSystemError."""
    assert issubclass(IngestionError, RAGSystemError)
    assert issubclass(RetrievalError, RAGSystemError)
    assert issubclass(EmbeddingError, RAGSystemError)
    assert issubclass(LLMError, RAGSystemError)
    assert issubclass(SecurityError, RAGSystemError)

def test_exception_message():
    """Verify that exceptions preserve the provided message."""
    msg = "test error"
    with pytest.raises(IngestionError) as exc:
        raise IngestionError(msg)
    assert str(exc.value) == msg
