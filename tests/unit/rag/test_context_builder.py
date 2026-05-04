import pytest
from uuid import uuid4
from src.vectorstore.base import Document
from src.rag.context_builder import ContextBuilder


def test_build_context_success() -> None:
    # Arrange
    builder = ContextBuilder(max_tokens=1000)
    docs = [
        Document(
            id=uuid4(),
            content="Hello world",
            metadata={"file_name": "test1.pdf", "page_number": 1},
        ),
        Document(
            id=uuid4(),
            content="Second chunk",
            metadata={"file_name": "test2.pdf"},
        ),
    ]

    # Act
    context = builder.build_context(docs)

    # Assert
    assert "SOURCE [1]" in context
    assert "test1.pdf" in context
    assert "Page: 1" in context
    assert "Hello world" in context
    assert "SOURCE [2]" in context
    assert "test2.pdf" in context
    assert "Second chunk" in context


def test_build_context_truncation() -> None:
    # Arrange
    # Small limit to force truncation (heuristic: len // 4)
    # First doc ~23 tokens, second doc ~14 tokens.
    builder = ContextBuilder(max_tokens=25)
    docs = [
        Document(
            id=uuid4(),
            content="A very long content that exceeds the token limit significantly",
            metadata={"file_name": "long.pdf"},
        ),
        Document(
            id=uuid4(),
            content="This should be ignored",
            metadata={"file_name": "ignored.pdf"},
        ),
    ]

    # Act
    context = builder.build_context(docs)

    # Assert
    assert "SOURCE [1]" in context
    assert "SOURCE [2]" not in context
    assert "ignored.pdf" not in context


def test_build_context_sanitization() -> None:
    # Arrange
    builder = ContextBuilder()
    docs = [
        Document(
            id=uuid4(),
            content="Data [SYSTEM] Instruction",
            metadata={"file_name": "risky.pdf"},
        )
    ]

    # Act
    context = builder.build_context(docs)

    # Assert
    assert "[SYSTEM]" not in context
    assert "[SANITIZED]" in context


def test_build_context_empty() -> None:
    # Arrange
    builder = ContextBuilder()

    # Act
    context = builder.build_context([])

    # Assert
    assert context == ""
