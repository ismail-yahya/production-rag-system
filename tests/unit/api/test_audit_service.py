"""
Unit tests for AuditService.

Key properties to test:
1. log() calls AuditLogRepository.create() with correct arguments.
2. log() silently absorbs repository exceptions — never raises to caller.
3. All ACTION_* constants are importable and are strings.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.services.audit_service import (
    ACTION_DELETE,
    ACTION_LOGIN,
    ACTION_LOGOUT,
    ACTION_PERMISSION_CHANGE,
    ACTION_QUERY,
    ACTION_UPLOAD,
    ACTION_USER_CREATED,
    ACTION_USER_DEACTIVATED,
    AuditService,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    return MagicMock()


# ---------------------------------------------------------------------------
# Action constant tests
# ---------------------------------------------------------------------------


def test_action_constants_are_strings():
    """All ACTION_* constants must be plain strings."""
    for constant in [
        ACTION_UPLOAD,
        ACTION_DELETE,
        ACTION_QUERY,
        ACTION_LOGIN,
        ACTION_LOGOUT,
        ACTION_PERMISSION_CHANGE,
        ACTION_USER_CREATED,
        ACTION_USER_DEACTIVATED,
    ]:
        assert isinstance(constant, str)
        assert len(constant) > 0


# ---------------------------------------------------------------------------
# log() — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_log_calls_repository(mock_session):
    """log() should call AuditLogRepository.create() with the correct arguments."""
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_repo = AsyncMock()
    with patch("src.api.services.audit_service.AuditLogRepository", return_value=mock_repo):
        await AuditService.log(
            session=mock_session,
            tenant_id=tenant_id,
            user_id=user_id,
            action=ACTION_UPLOAD,
            resource_type="document",
            resource_id="doc-123",
            metadata={"file": "test.pdf"},
            ip_address="127.0.0.1",
        )

    mock_repo.create.assert_awaited_once_with(
        tenant_id=tenant_id,
        user_id=user_id,
        action=ACTION_UPLOAD,
        resource_type="document",
        resource_id="doc-123",
        metadata_json={"file": "test.pdf"},
        ip_address="127.0.0.1",
    )


@pytest.mark.asyncio
async def test_log_with_none_user_id(mock_session):
    """log() should accept None user_id (for system-level actions)."""
    tenant_id = uuid.uuid4()

    mock_repo = AsyncMock()
    with patch("src.api.services.audit_service.AuditLogRepository", return_value=mock_repo):
        await AuditService.log(
            session=mock_session,
            tenant_id=tenant_id,
            user_id=None,
            action=ACTION_QUERY,
        )

    mock_repo.create.assert_awaited_once()
    call_kwargs = mock_repo.create.call_args[1]
    assert call_kwargs["user_id"] is None


@pytest.mark.asyncio
async def test_log_with_minimal_args(mock_session):
    """log() with only required args should not raise."""
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_repo = AsyncMock()
    with patch("src.api.services.audit_service.AuditLogRepository", return_value=mock_repo):
        await AuditService.log(
            session=mock_session,
            tenant_id=tenant_id,
            user_id=user_id,
            action=ACTION_DELETE,
        )

    call_kwargs = mock_repo.create.call_args[1]
    assert call_kwargs["resource_type"] is None
    assert call_kwargs["resource_id"] is None
    assert call_kwargs["metadata_json"] is None
    assert call_kwargs["ip_address"] is None


# ---------------------------------------------------------------------------
# log() — silent failure contract
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_log_absorbs_repository_exception(mock_session):
    """
    When AuditLogRepository.create() raises, log() must NOT propagate the exception.
    The caller's workflow must continue uninterrupted.
    """
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_repo = AsyncMock()
    mock_repo.create.side_effect = Exception("DB connection lost")

    with patch("src.api.services.audit_service.AuditLogRepository", return_value=mock_repo):
        # This must NOT raise — audit failures are best-effort
        await AuditService.log(
            session=mock_session,
            tenant_id=tenant_id,
            user_id=user_id,
            action=ACTION_UPLOAD,
        )
    # If we reach here, the exception was correctly absorbed


@pytest.mark.asyncio
async def test_log_absorbs_instantiation_exception():
    """
    Even if AuditLogRepository cannot be instantiated, log() must not raise.
    """
    mock_session = MagicMock()

    with patch(
        "src.api.services.audit_service.AuditLogRepository",
        side_effect=RuntimeError("import error"),
    ):
        await AuditService.log(
            session=mock_session,
            tenant_id=uuid.uuid4(),
            user_id=None,
            action=ACTION_QUERY,
        )
    # Reaching here = exception was absorbed correctly
