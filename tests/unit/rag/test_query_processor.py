import pytest
from unittest.mock import AsyncMock
from src.rag.query_processor import QueryProcessor
from src.llm.base import LLMResponse
from src.core.exceptions import LLMError


@pytest.fixture
def mock_llm() -> AsyncMock:
    """Fixture for a mocked LLM provider."""
    return AsyncMock()


@pytest.fixture
def query_processor(mock_llm: AsyncMock) -> QueryProcessor:
    """Fixture for the QueryProcessor under test."""
    return QueryProcessor(llm=mock_llm)


@pytest.mark.asyncio
async def test_expand_query_success(query_processor: QueryProcessor, mock_llm: AsyncMock) -> None:
    # Arrange
    query = "What is RAG?"
    mock_llm.generate.return_value = LLMResponse(
        content="What is retrieval augmented generation?\nHow does RAG work?\nBenefits of RAG",
        model="test-model"
    )

    # Act
    expanded = await query_processor.expand_query(query)

    # Assert
    assert len(expanded) == 4
    assert query in expanded
    assert "What is retrieval augmented generation?" in expanded
    assert "How does RAG work?" in expanded
    assert "Benefits of RAG" in expanded
    mock_llm.generate.assert_called_once()


@pytest.mark.asyncio
async def test_expand_query_handles_original_missing(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    query = "Original query"
    mock_llm.generate.return_value = LLMResponse(
        content="Exp 1\nExp 2",
        model="test-model"
    )

    # Act
    expanded = await query_processor.expand_query(query)

    # Assert
    assert expanded[0] == query
    assert len(expanded) == 3


@pytest.mark.asyncio
async def test_expand_query_raises_llm_error(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    mock_llm.generate.side_effect = Exception("LLM connection failed")

    # Act & Assert
    with pytest.raises(LLMError, match="Failed to expand query"):
        await query_processor.expand_query("test")


@pytest.mark.asyncio
async def test_classify_query_success(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    query = "When was Paris founded?"
    mock_llm.generate.return_value = LLMResponse(
        content="factual",
        model="test-model"
    )

    # Act
    category = await query_processor.classify_query(query)

    # Assert
    assert category == "factual"
    mock_llm.generate.assert_called_once()


@pytest.mark.asyncio
async def test_classify_query_invalid_category(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    mock_llm.generate.return_value = LLMResponse(
        content="invalid_cat",
        model="test-model"
    )

    # Act
    category = await query_processor.classify_query("test")

    # Assert
    assert category == "other"


@pytest.mark.asyncio
async def test_classify_query_raises_llm_error(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    mock_llm.generate.side_effect = Exception("LLM crash")

    # Act & Assert
    with pytest.raises(LLMError, match="Failed to classify query"):
        await query_processor.classify_query("test")
