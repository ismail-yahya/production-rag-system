import json
from unittest.mock import AsyncMock

import pytest

from src.core.exceptions import LLMError
from src.llm.base import LLMResponse
from src.rag.query_processor import QueryProcessor


@pytest.fixture
def mock_llm() -> AsyncMock:
    """Fixture for a mocked LLM provider."""
    return AsyncMock()


@pytest.fixture
def query_processor(mock_llm: AsyncMock) -> QueryProcessor:
    """Fixture for the QueryProcessor under test."""
    return QueryProcessor(llm=mock_llm)


@pytest.mark.asyncio
async def test_process_query_success(query_processor: QueryProcessor, mock_llm: AsyncMock) -> None:
    # Arrange
    query = "What is RAG?"
    mock_response_dict = {
        "category": "factual",
        "expanded_queries": [
            "What is retrieval augmented generation?",
            "How does RAG work?",
            "Benefits of RAG",
        ],
    }
    mock_llm.generate.return_value = LLMResponse(
        content=json.dumps(mock_response_dict), model="test-model"
    )

    # Act
    expanded, category = await query_processor.process_query(query)

    # Assert
    assert len(expanded) == 4
    assert query in expanded
    assert "What is retrieval augmented generation?" in expanded
    assert "How does RAG work?" in expanded
    assert "Benefits of RAG" in expanded
    assert category == "factual"
    mock_llm.generate.assert_called_once()


@pytest.mark.asyncio
async def test_process_query_handles_original_missing(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    query = "Original query"
    mock_response_dict = {"category": "analytical", "expanded_queries": ["Exp 1", "Exp 2"]}
    mock_llm.generate.return_value = LLMResponse(
        content=json.dumps(mock_response_dict), model="test-model"
    )

    # Act
    expanded, category = await query_processor.process_query(query)

    # Assert
    assert expanded[0] == query
    assert len(expanded) == 3
    assert category == "analytical"


@pytest.mark.asyncio
async def test_process_query_cleans_markdown_json(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    query = "test"
    mock_response_content = (
        "```json\n" + json.dumps({"category": "comparative", "expanded_queries": ["q1"]}) + "\n```"
    )
    mock_llm.generate.return_value = LLMResponse(content=mock_response_content, model="test-model")

    # Act
    expanded, category = await query_processor.process_query(query)

    # Assert
    assert category == "comparative"
    assert "q1" in expanded


@pytest.mark.asyncio
async def test_process_query_invalid_category(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    query = "test"
    mock_response_dict = {"category": "invalid_cat", "expanded_queries": ["q1"]}
    mock_llm.generate.return_value = LLMResponse(
        content=json.dumps(mock_response_dict), model="test-model"
    )

    # Act
    expanded, category = await query_processor.process_query(query)

    # Assert
    assert category == "other"


@pytest.mark.asyncio
async def test_process_query_raises_llm_error_on_bad_json(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    mock_llm.generate.return_value = LLMResponse(
        content="This is not valid JSON", model="test-model"
    )

    # Act & Assert
    with pytest.raises(LLMError, match="Failed to process query"):
        await query_processor.process_query("test")


@pytest.mark.asyncio
async def test_process_query_raises_llm_error_on_connection_failure(
    query_processor: QueryProcessor, mock_llm: AsyncMock
) -> None:
    # Arrange
    mock_llm.generate.side_effect = Exception("LLM crash")

    # Act & Assert
    with pytest.raises(LLMError, match="Failed to process query"):
        await query_processor.process_query("test")
