import asyncio
import os
import uuid
from typing import Any

import structlog
from celery import Task

from src.api.repositories import DocumentRepository, IngestionJobRepository
from src.core.config import settings
from src.core.exceptions import IngestionError
from src.core.storage import storage_service
from src.embeddings.factory import EmbedderFactory
from src.ingestion.chunkers.character_chunker import RecursiveCharacterChunker
from src.ingestion.pipeline import IngestionPipeline
from src.vectorstore.factory import VectorStoreFactory
from src.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class IngestionTask(Task):
    """
    Custom Celery Task for document ingestion.
    Caches the IngestionPipeline for reuse across tasks in the same worker process.
    """

    pass


from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import pool

@celery_app.task(
    name="src.workers.ingestion_worker.ingest_document",
    base=IngestionTask,
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def ingest_document(
    self: IngestionTask,
    file_path: str,
    tenant_id: str,
    document_id: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Celery task that wraps the IngestionPipeline for background document processing.
    """
    log = logger.bind(task_id=self.request.id, document_id=document_id, tenant_id=tenant_id)
    log.info("Starting background ingestion task")

    async def _run_ingestion() -> dict[str, Any]:
        # Create an isolated engine for this task run with NullPool
        # to avoid event loop attachment errors across consecutive asyncio.run() calls.
        local_engine = create_async_engine(
            settings.POSTGRES_DSN.get_secret_value(),
            echo=False,
            future=True,
            poolclass=pool.NullPool,
        )
        local_session_factory = async_sessionmaker(
            bind=local_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        # Helper for DB updates
        async def _update_status(status_str: str, **kwargs: Any) -> None:
            from datetime import UTC, datetime
            
            async with local_session_factory() as session:
                job_repo = IngestionJobRepository(session)
                doc_repo = DocumentRepository(session)
                
                doc_kwargs = {"status": status_str}
                # Safely handle chunk_count which is a Document field, not IngestionJob
                if "chunk_count" in kwargs:
                    doc_kwargs["chunk_count"] = kwargs.pop("chunk_count")
                
                if status_str == "indexed":
                    doc_kwargs["indexed_at"] = datetime.now(UTC)
                    
                job = await job_repo.get_by_document_id(uuid.UUID(document_id))
                if job:
                    # Update job status (remaining kwargs should be IngestionJob fields like error_message)
                    await job_repo.update(job.id, status=status_str, **kwargs)
                
                await doc_repo.update(uuid.UUID(document_id), **doc_kwargs)
                await session.commit()

        local_path = None
        try:
            # 1. Update job status to processing
            await _update_status("processing")
            
            # 2. Download file from storage to local temporary path
            temp_dir = "/tmp/rag_worker"
            os.makedirs(temp_dir, exist_ok=True)
            local_path = os.path.join(temp_dir, f"{document_id}_{os.path.basename(file_path)}")
            
            log.info("Downloading file from storage", storage_path=file_path, local_path=local_path)
            storage_service.download_file(file_path, local_path)

            # 3. Initialize providers inside the loop to ensure they attach to the correct loop.
            embedder = EmbedderFactory.create(settings.EMBEDDING_PROVIDER, settings)
            vector_store = VectorStoreFactory.create("qdrant", settings)
            chunker = RecursiveCharacterChunker(
                chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP
            )
            pipeline = IngestionPipeline(
                chunker=chunker, embedder=embedder, vector_store=vector_store
            )

            doc_uuid = uuid.UUID(document_id)
            chunk_count = await pipeline.run(
                file_path=local_path,
                tenant_id=tenant_id,
                document_id=doc_uuid,
                metadata=metadata,
            )

            # 4. Final status update
            await _update_status("indexed", chunk_count=chunk_count)

            log.info("Background ingestion task completed successfully", chunk_count=chunk_count)
            return {"status": "success", "document_id": document_id, "chunk_count": chunk_count}

        except IngestionError as e:
            log.warning("Ingestion error occurred", error=str(e), retry=self.request.retries)
            if self.request.retries >= self.max_retries:
                await _update_status("failed", error_message=str(e))
            raise e

        except Exception as e:
            log.error("Unexpected failure in ingestion task", error=str(e), exc_info=True)
            await _update_status("failed", error_message=str(e))
            return {"status": "failed", "document_id": document_id, "error": str(e)}
        finally:
            if local_path and os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass
            # Crucial: Dispose local engine to release resources cleanly
            await local_engine.dispose()

    # Use a fresh event loop for every task execution to prevent loop conflicts
    # in the Celery prefork worker processes.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_run_ingestion())
    except IngestionError as e:
        raise self.retry(exc=e) from e
    finally:
        loop.close()
