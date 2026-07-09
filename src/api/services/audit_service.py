"""
Audit Service — append-only ledger for all security-relevant actions.

Usage in route handlers:
    await AuditService.log(
        session=session,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="UPLOAD",
        resource_type="document",
        resource_id=str(doc_id),
    )

The `log()` method swallows all exceptions internally. A failure to write an
audit entry must NEVER cause the originating request to fail — audit writes
are best-effort and must not degrade the user experience.
"""

import uuid
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.repositories import AuditLogRepository

logger = structlog.get_logger(__name__)

# Valid action constants — use these instead of raw strings.
ACTION_UPLOAD = "UPLOAD"
ACTION_DELETE = "DELETE"
ACTION_QUERY = "QUERY"
ACTION_LOGIN = "LOGIN"
ACTION_LOGOUT = "LOGOUT"
ACTION_PERMISSION_CHANGE = "PERMISSION_CHANGE"
ACTION_USER_CREATED = "USER_CREATED"
ACTION_USER_DEACTIVATED = "USER_DEACTIVATED"


class AuditService:
    """
    Thin service layer over AuditLogRepository.

    All methods are static/class-level — there is no instance state.
    Callers inject the AsyncSession directly so the write participates
    in the same transaction as the originating business operation.
    """

    @staticmethod
    async def log(
        session: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> None:
        """
        Write a single audit log entry.

        This method silently absorbs all exceptions. If the audit write
        fails (e.g. DB connectivity), a WARNING is logged but the
        calling request is NOT affected.

        Args:
            session: The active AsyncSession from the current request.
            tenant_id: The tenant performing the action.
            user_id: The user performing the action (None for system actions).
            action: One of the ACTION_* constants defined in this module.
            resource_type: The type of resource affected (e.g. "document").
            resource_id: The ID of the resource affected.
            metadata: Arbitrary JSON-serialisable context for the action.
            ip_address: The client IP address (from request).
        """
        try:
            repo = AuditLogRepository(session)
            await repo.create(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                metadata_json=metadata,
                ip_address=ip_address,
            )
        except Exception as exc:
            # Audit failures must NEVER propagate — log at WARNING and continue.
            logger.warning(
                "audit_log_write_failed",
                action=action,
                tenant_id=str(tenant_id),
                user_id=str(user_id) if user_id else None,
                error=str(exc),
            )
