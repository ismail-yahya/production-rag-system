"""
Unit tests for StorageService async methods.

All synchronous boto3 calls are wrapped with asyncio.to_thread(), so
these tests verify that the public interface is properly awaitable.
"""
from unittest.mock import ANY, AsyncMock, MagicMock, patch

import pytest

from src.core.storage import StorageService


@pytest.fixture
def mock_boto():
    with patch("boto3.client") as mock:
        yield mock


def test_storage_init(mock_boto):
    """Verify storage service initializes with correct settings."""
    with patch("src.core.storage.settings") as mock_settings:
        mock_settings.MINIO_ENDPOINT = "localhost:9000"
        mock_settings.MINIO_ACCESS_KEY = None
        mock_settings.MINIO_SECRET_KEY = None
        mock_settings.MINIO_BUCKET_NAME = "documents"
        service = StorageService()
        assert service.bucket == "documents"
        mock_boto.assert_called_with(
            "s3",
            endpoint_url="http://localhost:9000",
            aws_access_key_id="minioadmin",
            aws_secret_access_key="minioadmin",
            config=ANY,
            region_name="us-east-1",
        )


@pytest.mark.asyncio
async def test_storage_upload_async(mock_boto):
    """Verify upload_file is awaitable and calls boto3 via to_thread."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()

    with patch("asyncio.to_thread", new=AsyncMock(return_value=None)) as mock_to_thread:
        await service.upload_file("local.txt", "remote.txt")
        mock_to_thread.assert_called_once_with(
            mock_s3.upload_file, "local.txt", "documents", "remote.txt"
        )


@pytest.mark.asyncio
async def test_storage_download_async(mock_boto):
    """Verify download_file is awaitable and calls boto3 via to_thread."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()

    with patch("asyncio.to_thread", new=AsyncMock(return_value=None)) as mock_to_thread:
        await service.download_file("remote.txt", "local.txt")
        mock_to_thread.assert_called_once_with(
            mock_s3.download_file, "documents", "remote.txt", "local.txt"
        )


@pytest.mark.asyncio
async def test_storage_delete_async(mock_boto):
    """Verify delete_file is awaitable and calls delete_object via to_thread."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()

    with patch("asyncio.to_thread", new=AsyncMock(return_value=None)) as mock_to_thread:
        await service.delete_file("remote.txt")
        # to_thread is called with a partial wrapping delete_object
        mock_to_thread.assert_called_once()
        # Verify the underlying method is called with correct args
        # by executing the partial directly
        partial_fn = mock_to_thread.call_args[0][0]
        partial_fn()
        mock_s3.delete_object.assert_called_once_with(Bucket="documents", Key="remote.txt")


@pytest.mark.asyncio
async def test_storage_upload_propagates_exceptions(mock_boto):
    """Verify that upload exceptions propagate to the caller."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()

    with patch("asyncio.to_thread", new=AsyncMock(side_effect=OSError("disk full"))):
        with pytest.raises(OSError, match="disk full"):
            await service.upload_file("local.txt", "remote.txt")
