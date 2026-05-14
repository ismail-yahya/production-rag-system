import uuid
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_upload_document_success(client, test_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    file_content = b"fake pdf content"
    file_name = "test.pdf"

    # We need to mock storage_service and the celery task
    with (
        patch("src.api.routers.ingestion.storage_service") as mock_storage,
        patch("src.api.routers.ingestion.ingest_document") as mock_task,
    ):
        mock_storage.upload_file.return_value = None
        mock_task.delay.return_value = MagicMock(id="task-id")

        files = {"file": (file_name, BytesIO(file_content), "application/pdf")}

        # Act
        response = await client.post("/v1/ingest", files=files, headers=headers)

        # Assert
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "pending"
        assert "document_id" in data

        mock_storage.upload_file.assert_called_once()
        mock_task.delay.assert_called_once()


@pytest.mark.asyncio
async def test_list_documents(client, test_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}

    # Act
    response = await client.get("/v1/documents", headers=headers)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "documents" in data
    assert isinstance(data["documents"], list)


@pytest.mark.asyncio
async def test_get_document_not_found(client, test_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    fake_id = uuid.uuid4()

    # Act
    response = await client.get(f"/v1/documents/{fake_id}", headers=headers)

    # Assert
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found"


@pytest.mark.asyncio
async def test_upload_document_duplicate(client, test_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    file_content = b"duplicate pdf content"
    file_name = "duplicate.pdf"

    with (
        patch("src.api.routers.ingestion.storage_service") as mock_storage,
        patch("src.api.routers.ingestion.ingest_document") as mock_task,
    ):
        mock_storage.upload_file.return_value = None
        mock_task.delay.return_value = MagicMock(id="task-id")

        # First upload
        files = {"file": (file_name, BytesIO(file_content), "application/pdf")}
        response = await client.post("/v1/ingest", files=files, headers=headers)
        assert response.status_code == 202

        # Second upload (duplicate content)
        files = {"file": (file_name, BytesIO(file_content), "application/pdf")}
        response = await client.post("/v1/ingest", files=files, headers=headers)

        # Assert
        assert response.status_code == 409
        assert "File already exists" in response.json()["detail"]
