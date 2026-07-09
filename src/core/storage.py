import asyncio
from functools import partial

import boto3
from botocore.client import Config

from src.core.config import settings


class StorageService:
    """
    Async utility service for interacting with MinIO/S3 object storage.

    The underlying boto3 client is synchronous. All public methods wrap
    the blocking calls with asyncio.to_thread() so they can be safely
    awaited from an async context without blocking the event loop.
    """

    def __init__(self) -> None:
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY.get_secret_value()
            if settings.MINIO_ACCESS_KEY
            else "minioadmin",
            aws_secret_access_key=settings.MINIO_SECRET_KEY.get_secret_value()
            if settings.MINIO_SECRET_KEY
            else "minioadmin",
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",  # MinIO default
        )
        self.bucket = settings.MINIO_BUCKET_NAME

    async def upload_file(self, local_path: str, storage_path: str) -> None:
        """Upload a file from local disk to storage (non-blocking)."""
        await asyncio.to_thread(self.s3.upload_file, local_path, self.bucket, storage_path)

    async def download_file(self, storage_path: str, local_path: str) -> None:
        """Download a file from storage to local disk (non-blocking)."""
        await asyncio.to_thread(self.s3.download_file, self.bucket, storage_path, local_path)

    async def delete_file(self, storage_path: str) -> None:
        """Delete a file from storage (non-blocking)."""
        delete_fn = partial(self.s3.delete_object, Bucket=self.bucket, Key=storage_path)
        await asyncio.to_thread(delete_fn)


storage_service = StorageService()
