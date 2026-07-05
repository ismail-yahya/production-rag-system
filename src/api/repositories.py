import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import Document, IngestionJob, TaskExecution


class DocumentRepository:
    """
    Repository for Document-related database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs: Any) -> Document:
        """
        Create a new document record.
        """
        document = Document(**kwargs)
        self.session.add(document)
        await self.session.flush()
        return document

    async def get_by_id(self, document_id: uuid.UUID, tenant_id: uuid.UUID) -> Document | None:
        """
        Retrieve a document by ID and tenant ID for scoping.
        """
        stmt = select(Document).where(Document.id == document_id, Document.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_hash(self, content_hash: str, tenant_id: uuid.UUID) -> Document | None:
        """
        Retrieve a document by content hash and tenant ID.
        Used for deduplication.
        """
        stmt = select(Document).where(
            Document.content_hash == content_hash, Document.tenant_id == tenant_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_tenant(self, tenant_id: uuid.UUID) -> Sequence[Document]:
        """
        List all documents for a given tenant.
        """
        stmt = (
            select(Document)
            .where(Document.tenant_id == tenant_id)
            .order_by(Document.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, document_id: uuid.UUID, **kwargs: Any) -> Document | None:
        """
        Update a document record.
        """
        if not kwargs:
            return await self.session.get(Document, document_id)

        stmt = (
            update(Document).where(Document.id == document_id).values(**kwargs).returning(Document)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete(self, document_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
        """
        Delete a document record.
        """
        stmt = delete(Document).where(Document.id == document_id, Document.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]


class IngestionJobRepository:
    """
    Repository for IngestionJob-related database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs: Any) -> IngestionJob:
        """
        Create a new ingestion job record.
        """
        job = IngestionJob(**kwargs)
        self.session.add(job)
        await self.session.flush()
        return job

    async def get_by_id(self, job_id: uuid.UUID) -> IngestionJob | None:
        """
        Retrieve an ingestion job by ID.
        """
        stmt = select(IngestionJob).where(IngestionJob.id == job_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_document_id(self, document_id: uuid.UUID) -> IngestionJob | None:
        """
        Retrieve the latest ingestion job for a document.
        """
        stmt = (
            select(IngestionJob)
            .where(IngestionJob.document_id == document_id)
            .order_by(IngestionJob.started_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update(self, job_id: uuid.UUID, **kwargs: Any) -> IngestionJob | None:
        """
        Update an ingestion job record.
        Automatically sets completed_at if status is final.
        """
        if not kwargs:
            return await self.session.get(IngestionJob, job_id)

        if "completed_at" not in kwargs and kwargs.get("status") in ["indexed", "failed"]:
            kwargs["completed_at"] = datetime.now(UTC)

        stmt = (
            update(IngestionJob)
            .where(IngestionJob.id == job_id)
            .values(**kwargs)
            .returning(IngestionJob)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def try_start_job(self, document_id: uuid.UUID, celery_task_id: str) -> IngestionJob | None:
        """
        Atomic transition: pending/failed -> processing.
        Uses SELECT ... FOR UPDATE SKIP LOCKED to avoid blocking.
        Commits immediately to release the lock.
        """
        stmt = (
            select(IngestionJob)
            .where(IngestionJob.document_id == document_id)
            .with_for_update(skip_locked=True)
        )
        result = await self.session.execute(stmt)
        job = result.scalar_one_or_none()

        if job and job.status in ("pending", "failed"):
            job.status = "processing"
            job.celery_task_id = celery_task_id
            job.started_at = datetime.now(UTC)
            job.last_heartbeat_at = datetime.now(UTC)
            await self.session.commit()
            return job
        await self.session.rollback()
        return None


class TaskExecutionRepository:
    """
    Repository for TaskExecution-related database operations (Idempotency Manager).
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def acquire(self, task_name: str, task_args_hash: str, celery_task_id: str) -> bool:
        """
        Attempts to acquire a task lock.
        Returns True if successful (lock acquired), False otherwise.
        """
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = (
            pg_insert(TaskExecution)
            .values(
                task_name=task_name,
                task_args_hash=task_args_hash,
                celery_task_id=celery_task_id,
                status="processing",
                started_at=datetime.now(UTC),
            )
            .on_conflict_do_nothing(constraint="uq_task_executions_name_hash")
            .returning(TaskExecution.id)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.scalar_one_or_none() is not None

    async def release(
        self,
        task_name: str,
        task_args_hash: str,
        status: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        """
        Releases/updates a task lock.
        """
        stmt = (
            update(TaskExecution)
            .where(
                TaskExecution.task_name == task_name,
                TaskExecution.task_args_hash == task_args_hash,
            )
            .values(
                status=status,
                result=result,
                error=error,
                completed_at=datetime.now(UTC),
            )
        )
        await self.session.execute(stmt)
        await self.session.commit()
