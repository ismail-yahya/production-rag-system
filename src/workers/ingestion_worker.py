import asyncio
import os
import uuid
from typing import Any

import structlog
from celery import Task

from src.core.config import settings
from src.core.exceptions import IngestionError
from src.embeddings.factory import EmbedderFactory
from src.ingestion.chunkers.character_chunker import RecursiveCharacterChunker
from src.api.repositories import DocumentRepository, IngestionJobRepository
from src.core.database import async_session_factory
from src.core.storage import storage_service
from src.ingestion.pipeline import IngestionPipeline
from src.vectorstore.factory import VectorStoreFactory
from src.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class IngestionTask(Task):
    """
    Custom Celery Task for document ingestion.
    Caches the IngestionPipeline for reuse across tasks in the same worker process.
    """

    _pipeline: IngestionPipeline | None = None

    @property
    def pipeline(self) -> IngestionPipeline:
        """Lazily initialize and return the IngestionPipeline."""
        if self._pipeline is None:
            # Initialize required services using their respective factories
            embedder = EmbedderFactory.create(settings.EMBEDDING_PROVIDER, settings)
            vector_store = VectorStoreFactory.create("qdrant", settings)

            # RecursiveCharacterChunker is the default chunker for this pipeline
            chunker = RecursiveCharacterChunker(
                chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP
            )

            self._pipeline = IngestionPipeline(
                chunker=chunker, embedder=embedder, vector_store=vector_store
            )
        return self._pipeline


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

    Args:
        file_path: Absolute path to the file on disk.
        tenant_id: ID of the tenant owning the document.
        document_id: UUID string of the document record.
        metadata: Optional additional metadata to attach to chunks.

    Returns:
        dict: Summary of the ingestion results including chunk count.

    Raises:
        self.retry: If an IngestionError occurs, the task is retried.
    """
    log = logger.bind(task_id=self.request.id, document_id=document_id, tenant_id=tenant_id)

    log.info("Starting background ingestion task")

    # 1. Update job status to processing
    # Note: Since this is synchronous context for Celery, we need a helper to run async DB ops
    async def _update_status(status_str: str, **kwargs: Any) -> None:
        async with async_session_factory() as session:
            job_repo = IngestionJobRepository(session)
            doc_repo = DocumentRepository(session)
            
            job = await job_repo.get_by_document_id(uuid.UUID(document_id))
            if job:
                await job_repo.update(job.id, status=status_str, **kwargs)
            
            # Also update the document status
            await doc_repo.update(uuid.UUID(document_id), status=status_str)
            await session.commit()

    try:
        asyncio.run(_update_status("processing"))
        
        # 2. Download file from storage to local temporary path
        temp_dir = "/tmp/rag_worker"
        os.makedirs(temp_dir, exist_ok=True)
        local_path = os.path.join(temp_dir, f"{document_id}_{os.path.basename(file_path)}")
        
        log.info("Downloading file from storage", storage_path=file_path, local_path=local_path)
        storage_service.download_file(file_path, local_path)

        # 3. Execute the async pipeline.
        doc_uuid = uuid.UUID(document_id)
        chunk_count = asyncio.run(
            self.pipeline.run(
                file_path=local_path,
                tenant_id=tenant_id,
                document_id=doc_uuid,
                metadata=metadata,
            )
        )

        # 4. Cleanup and final status update
        if os.path.exists(local_path):
            os.remove(local_path)
            
        asyncio.run(_update_status("indexed", chunk_count=chunk_count))

        log.info("Background ingestion task completed successfully", chunk_count=chunk_count)
        return {"status": "success", "document_id": document_id, "chunk_count": chunk_count}

    except IngestionError as e:
        log.warning("Ingestion error occurred, retrying...", error=str(e), retry=self.request.retries)
        if self.request.retries >= self.max_retries:
            asyncio.run(_update_status("failed", error_message=str(e)))
        raise self.retry(exc=e)

    except Exception as e:
        log.error("Unexpected failure in ingestion task", error=str(e), exc_info=True)
        asyncio.run(_update_status("failed", error_message=str(e)))
        return {"status": "failed", "document_id": document_id, "error": str(e)}
