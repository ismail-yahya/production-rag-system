import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class Tenant(Base):
    """
    Represents an isolated data partition.
    Every retrieval operation is filtered by tenant_id.
    """

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (Index("ix_tenants_api_key_hash", "api_key_hash"),)

    def __repr__(self) -> str:
        return f"<Tenant(name='{self.name}', id='{self.id}')>"


class Document(Base):
    """
    Tracks each uploaded file from receipt through indexing.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    chunk_count: Mapped[int | None] = mapped_column(nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_documents_tenant_id", "tenant_id"),
        Index("ix_documents_status", "status"),
        # Partial index: Worker scans only pending documents, not the full table.
        Index(
            "ix_documents_pending",
            "tenant_id",
            "created_at",
            postgresql_where=text("status = 'pending'"),
        ),
        # Scoped uniqueness: same file is only a duplicate within the same tenant.
        UniqueConstraint("tenant_id", "content_hash", name="uq_documents_tenant_hash"),
    )

    def __repr__(self) -> str:
        return f"<Document(name='{self.file_name}', id='{self.id}')>"


class Chunk(Base):
    """
    Records chunk-level metadata in PostgreSQL.
    The actual content and vector live in Qdrant.
    """

    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    total_chunks: Mapped[int] = mapped_column(nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    section_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (
        # Composite indexes cover single-column lookups too — no redundant single-column
        # indexes needed. Both composites start with tenant_id for tenant-scoped queries.
        Index("ix_chunks_tenant_doc", "tenant_id", "document_id"),
        Index("ix_chunks_tenant_index", "tenant_id", "chunk_index"),
    )


class IngestionJob(Base):
    """
    Provides visibility into background task execution.
    """

    __tablename__ = "ingestion_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_ingestion_jobs_document_id", "document_id"),
        Index("ix_ingestion_jobs_status", "status"),
        # Partial index: Celery worker polls only active (processing) jobs.
        Index(
            "ix_ingestion_jobs_processing",
            "document_id",
            "started_at",
            postgresql_where=text("status = 'processing'"),
        ),
    )


class QueryLog(Base):
    """
    Tracks search queries for performance analysis and retrieval optimization.
    """

    __tablename__ = "query_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    query_text: Mapped[str] = mapped_column(String, nullable=False)
    retrieved_chunk_ids: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (
        Index("ix_query_logs_tenant_id", "tenant_id"),
        Index("ix_query_logs_slow", "latency_ms", postgresql_where=text("latency_ms > 500")),
    )


class EvalDataset(Base):
    """
    Stores question/ground-truth pairs for evaluation.
    """

    __tablename__ = "eval_datasets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question: Mapped[str] = mapped_column(String, nullable=False)
    ground_truth_answer: Mapped[str] = mapped_column(String, nullable=False)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (Index("ix_eval_datasets_question_type", "question_type"),)


class TaskExecution(Base):
    """
    Tracks Celery task execution for idempotency.
    """

    __tablename__ = "task_executions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    task_args_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("task_name", "task_args_hash", name="uq_task_executions_name_hash"),
    )
