import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.api.services.workspace_service import WorkspaceService
from src.core.models import User, Workspace, WorkspaceMember


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.mark.asyncio
async def test_create_workspace_success(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Test User", role="ADMIN")
    service = WorkspaceService(mock_session)

    workspace_mock = Workspace(id=uuid.uuid4(), name="Team A", workspace_type="TEAM")

    with patch.object(service.workspace_repo, "create", AsyncMock(return_value=workspace_mock)) as mock_create, \
         patch.object(service.workspace_repo, "add_member", AsyncMock()) as mock_add_member:

        # Act
        result = await service.create_workspace(
            tenant_id=user.tenant_id,
            name="Team A",
            workspace_type="TEAM",
            current_user=user,
            description="desc"
        )

        # Assert
        assert result == workspace_mock
        mock_create.assert_called_once_with(
            tenant_id=user.tenant_id,
            name="Team A",
            workspace_type="TEAM",
            created_by=user.id,
            description="desc"
        )
        mock_add_member.assert_called_once_with(workspace_mock.id, user.id, member_role="ADMIN")
        mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_create_workspace_unauthorized(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Regular User", role="USER")
    service = WorkspaceService(mock_session)

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await service.create_workspace(
            tenant_id=user.tenant_id,
            name="Team A",
            workspace_type="TEAM",
            current_user=user
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_workspace_success_as_admin(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Admin User", role="ADMIN")
    service = WorkspaceService(mock_session)
    workspace = Workspace(id=uuid.uuid4(), tenant_id=user.tenant_id, name="Workspace A", workspace_type="TEAM")

    with patch.object(service.workspace_repo, "get_by_id", AsyncMock(return_value=workspace)):
        # Act
        result = await service.get_workspace(workspace.id, user)
        # Assert
        assert result == workspace


@pytest.mark.asyncio
async def test_get_workspace_success_as_member(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Regular User", role="USER")
    service = WorkspaceService(mock_session)
    workspace = Workspace(id=uuid.uuid4(), tenant_id=user.tenant_id, name="Workspace A", workspace_type="TEAM")
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, member_role="MEMBER")

    with patch.object(service.workspace_repo, "get_by_id", AsyncMock(return_value=workspace)), \
         patch.object(service.workspace_repo, "get_member", AsyncMock(return_value=member)):
        # Act
        result = await service.get_workspace(workspace.id, user)
        # Assert
        assert result == workspace


@pytest.mark.asyncio
async def test_get_workspace_denied(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Regular User", role="USER")
    service = WorkspaceService(mock_session)
    workspace = Workspace(id=uuid.uuid4(), tenant_id=user.tenant_id, name="Workspace A", workspace_type="TEAM")

    with patch.object(service.workspace_repo, "get_by_id", AsyncMock(return_value=workspace)), \
         patch.object(service.workspace_repo, "get_member", AsyncMock(return_value=None)):
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await service.get_workspace(workspace.id, user)
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_workspace_success(mock_session):
    # Arrange
    user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Admin User", role="ADMIN")
    service = WorkspaceService(mock_session)
    workspace = Workspace(id=uuid.uuid4(), tenant_id=user.tenant_id, name="Workspace A", workspace_type="TEAM")

    with patch.object(service, "get_workspace", AsyncMock(return_value=workspace)), \
         patch.object(service.workspace_repo, "delete", AsyncMock(return_value=True)) as mock_delete:
        # Act
        await service.delete_workspace(workspace.id, user)
        # Assert
        mock_delete.assert_called_once_with(workspace.id, user.tenant_id)
        mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_add_member_success(mock_session):
    # Arrange
    current_user = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), name="Admin User", role="ADMIN")
    target_user = User(id=uuid.uuid4(), tenant_id=current_user.tenant_id, name="Target User", role="USER")
    workspace = Workspace(id=uuid.uuid4(), tenant_id=current_user.tenant_id, name="Workspace A", workspace_type="TEAM")
    service = WorkspaceService(mock_session)

    member_mock = WorkspaceMember(workspace_id=workspace.id, user_id=target_user.id, member_role="MEMBER")

    with patch.object(service, "get_workspace", AsyncMock(return_value=workspace)), \
         patch.object(service.user_repo, "get_by_id", AsyncMock(return_value=target_user)), \
         patch.object(service.workspace_repo, "get_member", AsyncMock(return_value=None)), \
         patch.object(service.workspace_repo, "add_member", AsyncMock(return_value=member_mock)) as mock_add:

        # Act
        result = await service.add_member(workspace.id, target_user.id, "MEMBER", current_user)
        # Assert
        assert result == member_mock
        mock_add.assert_called_once_with(workspace_id=workspace.id, user_id=target_user.id, member_role="MEMBER")
        mock_session.commit.assert_called_once()
