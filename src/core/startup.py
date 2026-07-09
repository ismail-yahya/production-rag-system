"""
Infrastructure startup checks for the RAG system.

This module is called from the FastAPI lifespan context manager.
It verifies all external dependencies are reachable before the API
begins accepting traffic, and idempotently creates required resources
(Qdrant collection, MinIO bucket) if they do not yet exist.

NOTE: Alembic migrations are NOT run here. They must be executed via
`alembic upgrade head` in a prestart container/script before the API
starts — running migrations inside the app with multiple workers causes
race conditions. This module only validates that migrations have been
applied by checking DB connectivity.
"""

import structlog

from src.core.config import settings

logger = structlog.get_logger(__name__)


async def check_database() -> None:
    """Verify PostgreSQL is reachable."""
    from sqlalchemy import text

    from src.core.database import engine

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("startup_check_passed", service="postgresql")
    except Exception as exc:
        logger.error("startup_check_failed", service="postgresql", error=str(exc))
        raise RuntimeError(f"PostgreSQL is not reachable: {exc}") from exc


async def check_redis() -> None:
    """Verify Redis is reachable."""
    from redis import asyncio as aioredis

    try:
        client = aioredis.from_url(settings.REDIS_BROKER_URL, decode_responses=True)  # type: ignore[no-untyped-call]
        await client.ping()
        await client.aclose()
        logger.info("startup_check_passed", service="redis")
    except Exception as exc:
        logger.error("startup_check_failed", service="redis", error=str(exc))
        raise RuntimeError(f"Redis is not reachable: {exc}") from exc


async def check_qdrant() -> None:
    """Verify Qdrant is reachable."""
    from qdrant_client import AsyncQdrantClient

    try:
        client = AsyncQdrantClient(url=settings.QDRANT_URL)
        await client.get_collections()
        await client.close()
        logger.info("startup_check_passed", service="qdrant")
    except Exception as exc:
        logger.error("startup_check_failed", service="qdrant", error=str(exc))
        raise RuntimeError(f"Qdrant is not reachable: {exc}") from exc


async def ensure_qdrant_collection() -> None:
    """
    Idempotently create the Qdrant collection if it does not exist.
    Replaces the manual `scripts/setup_qdrant.py` step.
    """
    from qdrant_client import AsyncQdrantClient
    from qdrant_client.models import Distance, VectorParams

    client = AsyncQdrantClient(url=settings.QDRANT_URL)
    try:
        existing = await client.get_collections()
        collection_names = {c.name for c in existing.collections}

        if settings.QDRANT_COLLECTION_NAME not in collection_names:
            await client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=settings.EMBEDDING_DIMENSION,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(
                "qdrant_collection_created",
                collection=settings.QDRANT_COLLECTION_NAME,
                dimension=settings.EMBEDDING_DIMENSION,
            )
        else:
            logger.info(
                "qdrant_collection_exists",
                collection=settings.QDRANT_COLLECTION_NAME,
            )
    finally:
        await client.close()


async def ensure_minio_bucket() -> None:
    """
    Idempotently create the MinIO bucket if it does not exist.
    Replaces any manual bucket creation step.
    """
    import asyncio

    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError

    def _create_bucket_if_missing() -> None:
        s3 = boto3.client(
            "s3",
            endpoint_url=f"http{'s' if settings.MINIO_USE_SSL else ''}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=(
                settings.MINIO_ACCESS_KEY.get_secret_value()
                if settings.MINIO_ACCESS_KEY
                else "minioadmin"
            ),
            aws_secret_access_key=(
                settings.MINIO_SECRET_KEY.get_secret_value()
                if settings.MINIO_SECRET_KEY
                else "minioadmin"
            ),
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        try:
            s3.head_bucket(Bucket=settings.MINIO_BUCKET_NAME)
            logger.info("minio_bucket_exists", bucket=settings.MINIO_BUCKET_NAME)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code in ("404", "NoSuchBucket"):
                s3.create_bucket(Bucket=settings.MINIO_BUCKET_NAME)
                logger.info("minio_bucket_created", bucket=settings.MINIO_BUCKET_NAME)
            else:
                raise

    try:
        # boto3 is synchronous — run in thread to avoid blocking the event loop.
        await asyncio.to_thread(_create_bucket_if_missing)
    except Exception as exc:
        logger.error("startup_check_failed", service="minio", error=str(exc))
        raise RuntimeError(f"MinIO is not reachable: {exc}") from exc

    logger.info("startup_check_passed", service="minio")


async def run_startup_checks() -> None:
    """
    Entry point called from the FastAPI lifespan handler.
    Runs all infrastructure checks sequentially and fails fast on any error.
    The application will NOT start if any check fails.
    """
    logger.info("startup_checks_begin")

    await check_database()
    await check_redis()
    await check_qdrant()
    await ensure_qdrant_collection()
    await ensure_minio_bucket()

    logger.info("startup_checks_complete", status="all_passed")
