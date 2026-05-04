import json
import pytest
from unittest.mock import MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_query_success(client_with_mock_pipeline, test_tenant, mock_rag_pipeline):
    # Arrange
    question = "What is RAG?"
    mock_rag_pipeline.query.return_value = MagicMock(
        answer="RAG is Retrieval-Augmented Generation.",
        sources=[],
        query_expansions=[],
        retrieval_count=0,
        model="test-model",
        latency_ms=100.0,
        model_dump=lambda: {
            "answer": "RAG is Retrieval-Augmented Generation.",
            "sources": [],
            "query_expansions": [],
            "retrieval_count": 0,
            "model": "test-model",
            "latency_ms": 100.0,
        }
    )
    
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    payload = {"question": question, "mode": "standard"}

    # Act
    response = await client_with_mock_pipeline.post("/v1/query", json=payload, headers=headers)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "RAG is Retrieval-Augmented Generation."
    assert "sources" in data
    mock_rag_pipeline.query.assert_called_once()

@pytest.mark.asyncio
async def test_query_unauthorized(client_with_mock_pipeline):
    # Arrange
    headers = {"Authorization": "Bearer invalid-key"}
    payload = {"question": "Should fail", "mode": "standard"}

    # Act
    response = await client_with_mock_pipeline.post("/v1/query", json=payload, headers=headers)

    # Assert
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or inactive API key"

@pytest.mark.asyncio
async def test_query_stream_success(client_with_mock_pipeline, test_tenant, mock_rag_pipeline):
    # Arrange
    question = "Stream this."
    
    async def mock_stream_generator(*args, **kwargs):
        yield {"type": "token", "content": "Hello"}
        yield {"type": "token", "content": " world"}
        yield {"type": "sources", "sources": []}

    mock_rag_pipeline.stream_query.side_effect = mock_stream_generator
    
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    payload = {"question": question, "mode": "standard"}

    # Act
    response = await client_with_mock_pipeline.post("/v1/query/stream", json=payload, headers=headers)

    # Assert
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream"
    
    lines = [line.decode("utf-8") for line in await response.aread() if line]
    
    # SSE format: data: {...}\n\n
    events = [line.replace("data: ", "").strip() for line in lines if line.startswith("data: ")]
    assert len(events) == 4 # 3 from generator + 1 'done' event from route handler
    
    assert json.loads(events[0]) == {"type": "token", "content": "Hello"}
    assert json.loads(events[1]) == {"type": "token", "content": " world"}
    assert json.loads(events[2]) == {"type": "sources", "sources": []}
    assert json.loads(events[3]) == {"type": "done"}

@pytest.mark.asyncio
async def test_query_invalid_payload(client_with_mock_pipeline, test_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    payload = {"q": "Wrong key"} # Should be 'question'

    # Act
    response = await client_with_mock_pipeline.post("/v1/query", json=payload, headers=headers)

    # Assert
    assert response.status_code == 422 # Validation error
