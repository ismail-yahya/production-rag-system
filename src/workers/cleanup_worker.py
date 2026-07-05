import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import select, delete, pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.models import IngestionJob, TaskExecution, Document
from src.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="src.workers.cleanup_worker.recover_stuck_jobs")  # type: ignore[untyped-decorator]
def recover_stuck_jobs() -> dict[str, Any]:
    """
    Periodic task to check for ingestion jobs that have been stuck in 'processing'
    with no heartbeat update for over 30 minutes, transitioning them to 'failed'.
    """
    logger.info("recover_stuck_jobs_started")

    async def _run() -> dict[str, Any]:
        engine = create_async_engine(
            settings.POSTGRES_DSN.get_secret_value(),
            echo=False,
            future=True,
            poolclass=pool.NullPool,
        )
        session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        try:
            async with session_factory() as session:
                threshold = datetime.now(UTC) - timedelta(minutes=30)
                # Find stuck jobs
                stmt = select(IngestionJob).where(
                    IngestionJob.status == "processing",
                    IngestionJob.last_heartbeat_at < threshold,
                )
                result = await session.execute(stmt)
                stuck_jobs = result.scalars().all()

                recovered_count = 0
                for job in stuck_jobs:
                    logger.warning(
                        "Recovering stuck ingestion job",
                        job_id=str(job.id),
                        document_id=str(job.document_id),
                        last_heartbeat=job.last_heartbeat_at,
                    )
                    job.status = "failed"
                    job.error_message = "Worker crash detected (heartbeat timeout)"
                    job.completed_at = datetime.now(UTC)

                    # Also update the corresponding Document status to failed
                    doc_stmt = select(Document).where(Document.id == job.document_id)
                    doc_res = await session.execute(doc_stmt)
                    doc = doc_res.scalar_one_or_none()
                    if doc:
                        doc.status = "failed"

                    recovered_count += 1

                await session.commit()
                logger.info("recover_stuck_jobs_completed", recovered_count=recovered_count)
                return {"status": "success", "recovered_count": recovered_count}
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()


@celery_app.task(name="src.workers.cleanup_worker.cleanup_old_task_executions")  # type: ignore[untyped-decorator]
def cleanup_old_task_executions() -> dict[str, Any]:
    """
    Periodic task to delete TaskExecution records older than 7 days
    that are in a final state (success/failed).
    """
    logger.info("cleanup_old_task_executions_started")

    async def _run() -> dict[str, Any]:
        engine = create_async_engine(
            settings.POSTGRES_DSN.get_secret_value(),
            echo=False,
            future=True,
            poolclass=pool.NullPool,
        )
        session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        try:
            async with session_factory() as session:
                threshold = datetime.now(UTC) - timedelta(days=7)
                stmt = delete(TaskExecution).where(
                    TaskExecution.completed_at < threshold,
                    TaskExecution.status.in_(["success", "failed"]),
                )
                result = await session.execute(stmt)
                deleted_count = result.rowcount  # type: ignore[attr-defined]

                await session.commit()
                logger.info("cleanup_old_task_executions_completed", deleted_count=deleted_count)
                return {"status": "success", "deleted_count": deleted_count}
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()
