import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import (
    ApiKey,
    AuditLog,
    ChatMessage,
    ChatThread,
    Document,
    DocumentAccess,
    IngestionJob,
    QueryLog,
    TaskExecution,
    TenantConfig,
    User,
    Workspace,
    WorkspaceMember,
)


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

    async def list_by_ids(
        self, document_ids: Sequence[uuid.UUID], tenant_id: uuid.UUID
    ) -> Sequence[Document]:
        """
        List documents by their IDs, scoped to tenant.
        """
        if not document_ids:
            return []
        stmt = (
            select(Document)
            .where(Document.id.in_(document_ids), Document.tenant_id == tenant_id)
            .order_by(Document.created_at.desc())
        )
        result = await self.session.execute(stmt)
        ret = result.scalars().all()
        print(f"DEBUG list_by_ids: query returned {len(ret)} documents for ids {document_ids}")
        return ret

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

    async def try_start_job(
        self, document_id: uuid.UUID, celery_task_id: str
    ) -> IngestionJob | None:
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

        if job and (
            job.status in ("pending", "failed")
            or (job.status == "processing" and job.celery_task_id == celery_task_id)
        ):
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


# =============================================================================
# Enterprise Repositories — Phase 2 Addition
# =============================================================================


class UserRepository:
    """
    Repository for User-related database operations.
    All queries are scoped to a specific tenant_id to enforce data isolation.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        email: str,
        name: str,
        role: str = "USER",
        password_hash: str | None = None,
    ) -> User:
        """Create a new user record within a tenant."""
        user = User(
            tenant_id=tenant_id,
            email=email,
            name=name,
            role=role,
            password_hash=password_hash,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_by_id(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> User | None:
        """Retrieve a user by ID, scoped to tenant."""
        stmt = select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str, tenant_id: uuid.UUID) -> User | None:
        """Retrieve a user by email within a tenant. Used for login."""
        stmt = select(User).where(
            User.email == email,
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_api_key_hash(self, key_hash: str) -> User | None:
        """
        Retrieve the user associated with an API key hash.
        Used to authenticate Bearer API-Key requests.
        Performs a JOIN between api_keys and users tables.
        """
        stmt = (
            select(User)
            .join(ApiKey, ApiKey.user_id == User.id)
            .where(
                ApiKey.key_hash == key_hash,
                ApiKey.is_active.is_(True),
                User.is_active.is_(True),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_tenant(self, tenant_id: uuid.UUID) -> Sequence[User]:
        """List all users for a given tenant, ordered by creation date."""
        stmt = select(User).where(User.tenant_id == tenant_id).order_by(User.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, user_id: uuid.UUID, tenant_id: uuid.UUID, **kwargs: Any) -> User | None:
        """Update a user record. Automatically updates updated_at."""
        if not kwargs:
            return await self.session.get(User, user_id)

        kwargs["updated_at"] = datetime.now(UTC)

        stmt = (
            update(User)
            .where(User.id == user_id, User.tenant_id == tenant_id)
            .values(**kwargs)
            .returning(User)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def record_login(self, user_id: uuid.UUID) -> None:
        """Update last_login_at timestamp after successful authentication."""
        stmt = update(User).where(User.id == user_id).values(last_login_at=datetime.now(UTC))
        await self.session.execute(stmt)


class ApiKeyRepository:
    """
    Repository for ApiKey-related database operations.
    Raw key values are NEVER stored — only bcrypt hashes.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        key_hash: str,
        name: str,
    ) -> ApiKey:
        """Create a new API key record with a pre-computed bcrypt hash."""
        api_key = ApiKey(
            user_id=user_id,
            tenant_id=tenant_id,
            key_hash=key_hash,
            name=name,
            created_at=datetime.now(UTC),
        )
        self.session.add(api_key)
        await self.session.flush()
        return api_key

    async def get_by_id(self, key_id: uuid.UUID, user_id: uuid.UUID) -> ApiKey | None:
        """Retrieve an API key by ID, scoped to the owning user."""
        stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> Sequence[ApiKey]:
        """List all API keys for a user, ordered newest first."""
        stmt = select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def deactivate(self, key_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Soft-delete an API key by setting is_active = False.
        Returns True if a row was updated.
        """
        stmt = (
            update(ApiKey)
            .where(ApiKey.id == key_id, ApiKey.user_id == user_id)
            .values(is_active=False)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]

    async def record_usage(self, key_id: uuid.UUID) -> None:
        """Update last_used_at timestamp when an API key is used for authentication."""
        stmt = update(ApiKey).where(ApiKey.id == key_id).values(last_used_at=datetime.now(UTC))
        await self.session.execute(stmt)

    async def rotate(
        self,
        key_id: uuid.UUID,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        new_key_hash: str,
        new_name: str,
    ) -> ApiKey | None:
        """
        Atomically rotate an API key.

        Deactivates the existing key and creates a replacement with the supplied
        hash in a single flush. Returns the new ApiKey, or None if the old key
        was not found or does not belong to the user.
        """
        # Deactivate the old key (scoped to the user so one user can't rotate another's key)
        deactivated = await self.deactivate(key_id, user_id)
        if not deactivated:
            return None

        # Create the replacement key
        new_key = await self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            key_hash=new_key_hash,
            name=new_name,
        )
        await self.session.flush()
        return new_key


class WorkspaceRepository:
    """
    Repository for Workspace-related database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        name: str,
        workspace_type: str,
        created_by: uuid.UUID | None = None,
        description: str | None = None,
    ) -> Workspace:
        """Create a new workspace within a tenant."""
        workspace = Workspace(
            tenant_id=tenant_id,
            name=name,
            workspace_type=workspace_type,
            created_by=created_by,
            description=description,
            is_active=True,
            created_at=datetime.now(UTC),
        )
        self.session.add(workspace)
        await self.session.flush()
        return workspace

    async def get_by_id(self, workspace_id: uuid.UUID, tenant_id: uuid.UUID) -> Workspace | None:
        """Retrieve a workspace by ID, scoped to tenant."""
        stmt = select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.tenant_id == tenant_id,
            Workspace.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_tenant(self, tenant_id: uuid.UUID) -> Sequence[Workspace]:
        """List all active workspaces for a given tenant."""
        stmt = (
            select(Workspace)
            .where(Workspace.tenant_id == tenant_id, Workspace.is_active.is_(True))
            .order_by(Workspace.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_by_user(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> Sequence[Workspace]:
        """
        List all workspaces the user is member of or created by the user,
        plus any CENTRAL workspaces.
        """
        member_subquery = select(WorkspaceMember.workspace_id).where(
            WorkspaceMember.user_id == user_id
        )
        stmt = (
            select(Workspace)
            .where(
                Workspace.tenant_id == tenant_id,
                Workspace.is_active.is_(True),
                (
                    Workspace.id.in_(member_subquery)
                    | (Workspace.created_by == user_id)
                    | (Workspace.workspace_type == "CENTRAL")
                ),
            )
            .order_by(Workspace.created_at.desc())
            .distinct()
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(
        self, workspace_id: uuid.UUID, tenant_id: uuid.UUID, **kwargs: Any
    ) -> Workspace | None:
        """Update a workspace record."""
        if not kwargs:
            return await self.get_by_id(workspace_id, tenant_id)

        stmt = (
            update(Workspace)
            .where(Workspace.id == workspace_id, Workspace.tenant_id == tenant_id)
            .values(**kwargs)
            .returning(Workspace)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete(self, workspace_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
        """Soft delete a workspace by setting is_active = False."""
        stmt = (
            update(Workspace)
            .where(Workspace.id == workspace_id, Workspace.tenant_id == tenant_id)
            .values(is_active=False)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]

    async def add_member(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, member_role: str = "MEMBER"
    ) -> WorkspaceMember:
        """Add a user as a member of a workspace."""
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            member_role=member_role,
            joined_at=datetime.now(UTC),
        )
        self.session.add(member)
        await self.session.flush()
        return member

    async def remove_member(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Remove a user from a workspace."""
        stmt = delete(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]

    async def get_members(self, workspace_id: uuid.UUID) -> Sequence[WorkspaceMember]:
        """Get all members of a workspace."""
        stmt = select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_member(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember | None:
        """Get a specific workspace member profile."""
        stmt = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_member_role(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, member_role: str
    ) -> WorkspaceMember | None:
        """Update a workspace member's role."""
        stmt = (
            update(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
            .values(member_role=member_role)
            .returning(WorkspaceMember)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


    async def get_or_create_personal_workspace(self, user: User) -> Workspace:
        """Get or create the user's personal workspace."""
        stmt = select(Workspace).where(
            Workspace.tenant_id == user.tenant_id,
            Workspace.workspace_type == "PERSONAL",
            Workspace.created_by == user.id,
            Workspace.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        workspace = result.scalar_one_or_none()
        if not workspace:
            workspace = await self.create(
                tenant_id=user.tenant_id,
                name=f"{user.name}'s Workspace",
                workspace_type="PERSONAL",
                created_by=user.id,
                description=f"Personal workspace for {user.name}",
            )
            # Add creator as ADMIN of their own personal workspace
            await self.add_member(workspace.id, user.id, member_role="ADMIN")
        return workspace


class DocumentAccessRepository:
    """
    Repository for DocumentAccess-related database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def grant_access(
        self, document_id: uuid.UUID, workspace_id: uuid.UUID, access_level: str = "READ"
    ) -> DocumentAccess:
        """Grant a workspace access to a document."""
        access = DocumentAccess(
            document_id=document_id,
            workspace_id=workspace_id,
            access_level=access_level,
            granted_at=datetime.now(UTC),
        )
        self.session.add(access)
        await self.session.flush()
        return access

    async def revoke_access(self, document_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
        """Revoke a workspace's access to a document."""
        stmt = delete(DocumentAccess).where(
            DocumentAccess.document_id == document_id, DocumentAccess.workspace_id == workspace_id
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]

    async def list_by_document(self, document_id: uuid.UUID) -> Sequence[DocumentAccess]:
        """List all workspace access records for a document."""
        stmt = select(DocumentAccess).where(DocumentAccess.document_id == document_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_by_workspace(self, workspace_id: uuid.UUID) -> Sequence[DocumentAccess]:
        """List all document access records for a workspace."""
        stmt = select(DocumentAccess).where(DocumentAccess.workspace_id == workspace_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_accessible_document_ids(self, user: User) -> set[uuid.UUID]:
        """
        Get all document IDs accessible by the user within their tenant.
        - ADMIN / SUPER_ADMIN has access to all documents in their tenant.
        - Others have access to:
          - Documents associated with workspaces where the user is a member.
          - Documents associated with workspaces created by the user.
          - Documents associated with CENTRAL workspaces (public).
        """
        if user.role in ("ADMIN", "SUPER_ADMIN"):
            stmt = select(Document.id).where(Document.tenant_id == user.tenant_id)
            result = await self.session.execute(stmt)
            return set(result.scalars().all())

        # For USER and MANAGER roles:
        # 1. Workspaces the user is member of
        member_workspaces = select(WorkspaceMember.workspace_id).where(
            WorkspaceMember.user_id == user.id
        )

        # 2. Accessible active workspaces (member of, created by, or CENTRAL)
        accessible_workspaces = select(Workspace.id).where(
            Workspace.tenant_id == user.tenant_id,
            Workspace.is_active.is_(True),
            (
                Workspace.id.in_(member_workspaces)
                | (Workspace.created_by == user.id)
                | (Workspace.workspace_type == "CENTRAL")
            ),
        )

        # 3. Documents linked to these workspaces
        stmt = select(DocumentAccess.document_id).where(
            DocumentAccess.workspace_id.in_(accessible_workspaces)
        )
        result = await self.session.execute(stmt)
        ret = set(result.scalars().all())
        print(f"DEBUG get_accessible_document_ids: returning {ret}")
        return ret


class AuditLogRepository:
    """
    Repository for AuditLog database operations.
    IMPORTANT: This table is append-only. Only create operations are permitted.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        metadata_json: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        """Create a new audit log entry."""
        audit_log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata_json,
            ip_address=ip_address,
            created_at=datetime.now(UTC),
        )
        self.session.add(audit_log)
        await self.session.flush()
        return audit_log

    async def list_by_tenant(
        self,
        tenant_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
        action: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> Sequence[AuditLog]:
        """List audit logs for a tenant, with optional action and user_id filtering."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.tenant_id == tenant_id)
            .order_by(AuditLog.created_at.desc())
        )
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if user_id:
            stmt = stmt.where(AuditLog.user_id == user_id)

        stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()


class QueryLogRepository:
    """
    Repository for QueryLog database operations.
    Inserts a record for every processed query — used by AdminRepository
    to compute total_queries and average_latency_ms.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        query_text: str,
        latency_ms: int | None = None,
        cache_hit: bool = False,
    ) -> QueryLog:
        """Create a new query log entry."""
        log = QueryLog(
            tenant_id=tenant_id,
            query_text=query_text,
            latency_ms=latency_ms,
            cache_hit=cache_hit,
            created_at=datetime.now(UTC),
        )
        self.session.add(log)
        await self.session.flush()
        return log


@dataclass
class AdminStatsData:
    """Aggregate statistics for a tenant."""

    total_documents: int
    total_chunks: int
    total_queries: int
    average_latency_ms: float


class AdminRepository:
    """
    Repository for admin aggregate statistics.

    All queries are scoped to a single tenant.
    The four counters are fetched in parallel using asyncio.gather().
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_stats(self, tenant_id: uuid.UUID) -> AdminStatsData:
        """
        Fetch aggregate statistics for a tenant in four parallel queries.

        Args:
            tenant_id: The tenant to aggregate stats for.

        Returns:
            AdminStatsData with total_documents, total_chunks,
            total_queries, and average_latency_ms.
        """

        doc_stmt = select(func.count()).select_from(Document).where(Document.tenant_id == tenant_id)
        chunk_stmt = select(func.coalesce(func.sum(Document.chunk_count), 0)).where(
            Document.tenant_id == tenant_id
        )
        query_stmt = (
            select(func.count()).select_from(QueryLog).where(QueryLog.tenant_id == tenant_id)
        )
        latency_stmt = select(func.avg(QueryLog.latency_ms)).where(QueryLog.tenant_id == tenant_id)

        doc_res = await self.session.execute(doc_stmt)
        chunk_res = await self.session.execute(chunk_stmt)
        query_res = await self.session.execute(query_stmt)
        latency_res = await self.session.execute(latency_stmt)

        return AdminStatsData(
            total_documents=doc_res.scalar_one() or 0,
            total_chunks=chunk_res.scalar_one() or 0,
            total_queries=query_res.scalar_one() or 0,
            average_latency_ms=float(latency_res.scalar_one() or 0.0),
        )


class ChatRepository:
    """
    Repository for ChatThread and ChatMessage database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_thread(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        workspace_id: uuid.UUID | None = None,
    ) -> ChatThread:
        """Create a new chat thread."""
        thread = ChatThread(
            tenant_id=tenant_id,
            user_id=user_id,
            title=title,
            workspace_id=workspace_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        self.session.add(thread)
        await self.session.flush()
        return thread

    async def list_threads(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, workspace_id: uuid.UUID | None = None
    ) -> Sequence[ChatThread]:
        """List chat threads scoped to tenant and user, optional workspace filtering."""
        stmt = select(ChatThread).where(
            ChatThread.tenant_id == tenant_id, ChatThread.user_id == user_id
        )
        if workspace_id:
            stmt = stmt.where(ChatThread.workspace_id == workspace_id)
        stmt = stmt.order_by(ChatThread.updated_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_thread_by_id(
        self, thread_id: uuid.UUID, tenant_id: uuid.UUID, user_id: uuid.UUID
    ) -> ChatThread | None:
        """Get a specific chat thread."""
        stmt = select(ChatThread).where(
            ChatThread.id == thread_id,
            ChatThread.tenant_id == tenant_id,
            ChatThread.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_thread(
        self, thread_id: uuid.UUID, tenant_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Delete a chat thread and all its messages."""
        stmt = delete(ChatThread).where(
            ChatThread.id == thread_id,
            ChatThread.tenant_id == tenant_id,
            ChatThread.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined, no-any-return]

    async def get_messages(self, thread_id: uuid.UUID) -> Sequence[ChatMessage]:
        """Get all messages in a chat thread ordered by creation date."""
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def add_message(
        self,
        thread_id: uuid.UUID,
        role: str,
        content: str,
        sources: dict[str, Any] | None = None,
    ) -> ChatMessage:
        """Add a message to a thread and update thread updated_at."""
        message = ChatMessage(
            thread_id=thread_id,
            role=role,
            content=content,
            sources=sources,
            created_at=datetime.now(UTC),
        )
        self.session.add(message)

        # Update thread's updated_at timestamp
        thread_stmt = (
            update(ChatThread)
            .where(ChatThread.id == thread_id)
            .values(updated_at=datetime.now(UTC))
        )
        await self.session.execute(thread_stmt)
        await self.session.flush()
        return message


class TenantConfigRepository:
    """
    Repository for TenantConfig database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_config(self, tenant_id: uuid.UUID) -> TenantConfig | None:
        """Retrieve the configuration for a tenant."""
        stmt = select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_config(self, tenant_id: uuid.UUID, **kwargs: Any) -> TenantConfig:
        """Create or update a tenant's configuration settings."""
        existing = await self.get_config(tenant_id)
        if existing:
            stmt = (
                update(TenantConfig)
                .where(TenantConfig.tenant_id == tenant_id)
                .values(**kwargs, updated_at=datetime.now(UTC))
                .returning(TenantConfig)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one()
        else:
            config = TenantConfig(tenant_id=tenant_id, **kwargs, updated_at=datetime.now(UTC))
            self.session.add(config)
            await self.session.flush()
            return config
