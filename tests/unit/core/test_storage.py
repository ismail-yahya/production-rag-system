import pytest
from unittest.mock import MagicMock, patch, ANY
from src.core.storage import StorageService

@pytest.fixture
def mock_boto():
    with patch("boto3.client") as mock:
        yield mock

def test_storage_init(mock_boto):
    """Verify storage service initializes with correct settings."""
    service = StorageService()
    assert service.bucket == "documents"
    mock_boto.assert_called_with(
        "s3",
        endpoint_url="http://localhost:9000",
        aws_access_key_id="minioadmin",
        aws_secret_access_key="minioadmin",
        config=ANY,
        region_name="us-east-1"
    )

def test_storage_upload(mock_boto):
    """Verify upload_file calls boto3 client."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()
    
    service.upload_file("local.txt", "remote.txt")
    mock_s3.upload_file.assert_called_with("local.txt", "documents", "remote.txt")

def test_storage_download(mock_boto):
    """Verify download_file calls boto3 client."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()
    
    service.download_file("remote.txt", "local.txt")
    mock_s3.download_file.assert_called_with("documents", "remote.txt", "local.txt")

def test_storage_delete(mock_boto):
    """Verify delete_file calls boto3 client."""
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    service = StorageService()
    
    service.delete_file("remote.txt")
    mock_s3.delete_object.assert_called_with(Bucket="documents", Key="remote.txt")
