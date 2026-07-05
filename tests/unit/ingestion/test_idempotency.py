import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.repositories import IngestionJobRepository, TaskExecutionRepository
from src.core.models import Document, IngestionJob, TaskExecution
from src.ingestion.chunkers.base import BaseChunker, Chunk
from src.ingestion.loaders.base import BaseLoader, RawDocument
from src.ingestion.pipeline import IngestionPipeline
from src.vectorstore.base import BaseVectorStore
from src.workers.cleanup_worker import recover_stuck_jobs, cleanup_old_task_executions
from src.workers.ingestion_worker import ingest_document


@pytest.mark.asyncio
async def test_pipeline_deterministic_chunk_ids():
    # Arrange
    mock_chunker = MagicMock(spec=BaseChunker)
    mock_chunker.chunk = AsyncMock()
    
    mock_embedder = MagicMock()
    mock_embedder.embed_texts = AsyncMock()

    mock_vector_store = MagicMock(spec=BaseVectorStore)
    mock_vector_store.upsert = AsyncMock()

    pipeline = IngestionPipeline(
        chunker=mock_chunker,
        embedder=mock_embedder,
        vector_store=mock_vector_store,
    )

    mock_loader = MagicMock(spec=BaseLoader)
    mock_loader.load = AsyncMock()
    pipeline.loaders[".pdf"] = mock_loader

    doc_id = uuid.uuid4()
    mock_loader.load.return_value = RawDocument(content="Hello world from RAG system", metadata={})
    mock_chunker.chunk.return_value = [
        Chunk(content="Hello world", metadata={}, index=0),
        Chunk(content="from RAG system", metadata={}, index=1),
    ]
    mock_embedder.embed_texts.return_value = [[0.1, 0.2], [0.3, 0.4]]

    # Act
    # First execution
    await pipeline.run("test.pdf", tenant_id="tenant-1", document_id=doc_id)
    first_call_docs = mock_vector_store.upsert.call_args[0][0]

    # Reset mock and run second execution
    mock_vector_store.upsert.reset_mock()
    await pipeline.run("test.pdf", tenant_id="tenant-1", document_id=doc_id)
    second_call_docs = mock_vector_store.upsert.call_args[0][0]

    # Assert
    assert len(first_call_docs) == 2
    assert len(second_call_docs) == 2
    # Verify deterministic UUIDs are exactly the same across runs
    assert first_call_docs[0].id == second_call_docs[0].id
    assert first_call_docs[1].id == second_call_docs[1].id
    # Verify UUID5 generation format
    expected_id_0 = uuid.uuid5(doc_id, "chunk_0")
    assert first_call_docs[0].id == expected_id_0


@pytest.mark.asyncio
async def test_try_start_job_success():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    repo = IngestionJobRepository(mock_session)
    doc_id = uuid.uuid4()
    job = IngestionJob(document_id=doc_id, status="pending")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = job
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Act
    started_job = await repo.try_start_job(doc_id, "task-123")

    # Assert
    assert started_job is not None
    assert started_job.status == "processing"
    assert started_job.celery_task_id == "task-123"
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_try_start_job_already_processing():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    repo = IngestionJobRepository(mock_session)
    doc_id = uuid.uuid4()
    job = IngestionJob(document_id=doc_id, status="processing")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = job
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Act
    started_job = await repo.try_start_job(doc_id, "task-123")

    # Assert
    assert started_job is None
    mock_session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_task_execution_idempotency_acquire_and_release():
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    repo = TaskExecutionRepository(mock_session)

    # Mock execute for acquire (returns execution ID indicating success)
    mock_result_acquire = MagicMock()
    mock_result_acquire.scalar_one_or_none.return_value = uuid.uuid4()
    mock_session.execute.return_value = mock_result_acquire

    # Act - Acquire
    acquired = await repo.acquire("my_task", "somehash123", "celery-id-1")

    # Assert - Acquire
    assert acquired is True
    mock_session.commit.assert_called_once()

    # Reset mock for release
    mock_session.commit.reset_mock()

    # Act - Release
    await repo.release("my_task", "somehash123", "success", result={"ok": True})

    # Assert - Release
    mock_session.commit.assert_called_once()


@patch("src.workers.ingestion_worker.create_async_engine")
@patch("src.workers.ingestion_worker.storage_service")
@patch("src.workers.ingestion_worker.EmbedderFactory")
@patch("src.workers.ingestion_worker.VectorStoreFactory")
@patch("src.workers.ingestion_worker.RecursiveCharacterChunker")
@patch("src.workers.ingestion_worker.IngestionPipeline")
def test_worker_ingestion_skip_locked(
    mock_pipeline_cls,
    mock_chunker_cls,
    mock_vector_store_factory,
    mock_embedder_factory,
    mock_storage_service,
    mock_create_engine,
):
    # Arrange
    # Mock database session and repositories
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.__aenter__.return_value = mock_session
    mock_session_maker = MagicMock(return_value=mock_session)
    
    mock_engine = AsyncMock()
    mock_create_engine.return_value = mock_engine

    # Mock try_start_job to return None (simulating SKIP LOCKED or already processing)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    doc_id = str(uuid.uuid4())

    # Mock Celery request on the IngestionTask class
    with patch("src.workers.ingestion_worker.IngestionTask.request", new_callable=PropertyMock) as mock_request:
        mock_request.return_value.id = "my-task-id"

        # We patch async_sessionmaker inside ingestion_worker to return our mock session maker
        with patch("src.workers.ingestion_worker.async_sessionmaker", return_value=mock_session_maker):
            # Act - call __wrapped__ without passing self since it is already bound
            result = ingest_document.__wrapped__(
                file_path="tenant/file.pdf",
                tenant_id="tenant-1",
                document_id=doc_id,
            )

    # Assert
    assert result["status"] == "skipped"
    assert result["reason"] == "already_processing_or_indexed"
    # Ensure pipeline run was NEVER called
    mock_pipeline_cls.return_value.run.assert_not_called()


@patch("src.workers.cleanup_worker.create_async_engine")
def test_recover_stuck_jobs(mock_create_engine):
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.__aenter__.return_value = mock_session
    mock_session_maker = MagicMock(return_value=mock_session)
    
    mock_engine = AsyncMock()
    mock_create_engine.return_value = mock_engine

    doc_id = uuid.uuid4()
    job = IngestionJob(document_id=doc_id, status="processing", last_heartbeat_at=datetime.now(UTC) - timedelta(minutes=45))
    doc = Document(id=doc_id, status="processing")

    # Mock database responses
    mock_query_result = MagicMock()
    mock_query_result.scalars.return_value.all.return_value = [job]
    
    mock_doc_result = MagicMock()
    mock_doc_result.scalar_one_or_none.return_value = doc

    # First call is for stuck jobs query, second is for document query
    mock_session.execute.side_effect = [mock_query_result, mock_doc_result]

    with patch("src.workers.cleanup_worker.async_sessionmaker", return_value=mock_session_maker):
        # Act
        result = recover_stuck_jobs()

    # Assert
    assert result["status"] == "success"
    assert result["recovered_count"] == 1
    assert job.status == "failed"
    assert job.error_message == "Worker crash detected (heartbeat timeout)"
    assert doc.status == "failed"
    mock_session.commit.assert_called_once()


@patch("src.workers.cleanup_worker.create_async_engine")
def test_cleanup_old_task_executions(mock_create_engine):
    # Arrange
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.__aenter__.return_value = mock_session
    mock_session_maker = MagicMock(return_value=mock_session)
    
    mock_engine = AsyncMock()
    mock_create_engine.return_value = mock_engine

    mock_delete_result = MagicMock()
    mock_delete_result.rowcount = 5
    mock_session.execute.return_value = mock_delete_result

    with patch("src.workers.cleanup_worker.async_sessionmaker", return_value=mock_session_maker):
        # Act
        result = cleanup_old_task_executions()

    # Assert
    assert result["status"] == "success"
    assert result["deleted_count"] == 5
    mock_session.commit.assert_called_once()
