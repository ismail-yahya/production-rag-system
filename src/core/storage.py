import os
from pathlib import Path

import boto3
from botocore.client import Config
from src.core.config import settings


class StorageService:
    """
    Utility service for interacting with MinIO/S3 object storage.
    """

    def __init__(self) -> None:
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY.get_secret_value() if settings.MINIO_ACCESS_KEY else "minioadmin",
            aws_secret_access_key=settings.MINIO_SECRET_KEY.get_secret_value() if settings.MINIO_SECRET_KEY else "minioadmin",
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",  # MinIO default
        )
        self.bucket = settings.MINIO_BUCKET_NAME

    def upload_file(self, local_path: str, storage_path: str) -> None:
        """Upload a file from local disk to storage."""
        self.s3.upload_file(local_path, self.bucket, storage_path)

    def download_file(self, storage_path: str, local_path: str) -> None:
        """Download a file from storage to local disk."""
        self.s3.download_file(self.bucket, storage_path, local_path)

    def delete_file(self, storage_path: str) -> None:
        """Delete a file from storage."""
        self.s3.delete_object(Bucket=self.bucket, Key=storage_path)

storage_service = StorageService()
