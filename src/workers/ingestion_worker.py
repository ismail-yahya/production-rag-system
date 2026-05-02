import asyncio
import uuid
from typing import Any

import structlog
from celery import Task

from src.core.config import settings
from src.core.exceptions import IngestionError
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

    try:
        # Ensure document_id is a valid UUID object for the pipeline
        doc_uuid = uuid.UUID(document_id)

        # Execute the async pipeline.
        # asyncio.run() is appropriate for Celery workers executing discrete I/O bound tasks.
        chunk_count = asyncio.run(
            self.pipeline.run(
                file_path=file_path,
                tenant_id=tenant_id,
                document_id=doc_uuid,
                metadata=metadata,
            )
        )

        log.info("Background ingestion task completed successfully", chunk_count=chunk_count)

        return {"status": "success", "document_id": document_id, "chunk_count": chunk_count}

    except IngestionError as e:
        log.warning("Ingestion error occurred, retrying...", error=str(e), retry=self.request.retries)
        # Exponential backoff or simple retry
        raise self.retry(exc=e)

    except Exception as e:
        log.error("Unexpected failure in ingestion task", error=str(e), exc_info=True)
        # We return a failed status rather than retrying for unknown exceptions
        return {"status": "failed", "document_id": document_id, "error": str(e)}
