"""
Unit tests for get_accessible_document_ids in DocumentAccessRepository.
We target 100% test coverage.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.api.repositories import DocumentAccessRepository
from src.core.models import User


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.mark.asyncio
async def test_get_accessible_document_ids_admin(mock_session) -> None:
    # Arrange
    tenant_id = uuid.uuid4()
    user = User(id=uuid.uuid4(), tenant_id=tenant_id, role="ADMIN")
    repo = DocumentAccessRepository(mock_session)

    doc_id_1 = uuid.uuid4()
    doc_id_2 = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [doc_id_1, doc_id_2]
    mock_session.execute.return_value = mock_result

    # Act
    result = await repo.get_accessible_document_ids(user)

    # Assert
    assert result == {doc_id_1, doc_id_2}
    mock_session.execute.assert_called_once()
    # Check that it filtered by tenant_id
    executed_stmt = mock_session.execute.call_args[0][0]
    assert "tenant_id" in str(executed_stmt).lower()


@pytest.mark.asyncio
async def test_get_accessible_document_ids_super_admin(mock_session) -> None:
    # Arrange
    tenant_id = uuid.uuid4()
    user = User(id=uuid.uuid4(), tenant_id=tenant_id, role="SUPER_ADMIN")
    repo = DocumentAccessRepository(mock_session)

    doc_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [doc_id]
    mock_session.execute.return_value = mock_result

    # Act
    result = await repo.get_accessible_document_ids(user)

    # Assert
    assert result == {doc_id}
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_accessible_document_ids_user(mock_session) -> None:
    # Arrange
    tenant_id = uuid.uuid4()
    user = User(id=uuid.uuid4(), tenant_id=tenant_id, role="USER")
    repo = DocumentAccessRepository(mock_session)

    doc_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [doc_id]
    mock_session.execute.return_value = mock_result

    # Act
    result = await repo.get_accessible_document_ids(user)

    # Assert
    assert result == {doc_id}
    mock_session.execute.assert_called_once()
    executed_stmt = mock_session.execute.call_args[0][0]
    # Check that we query document_access table
    assert "document_access" in str(executed_stmt).lower()
    # And check that it filters workspaces by central, created_by, or membership
    stmt_str = str(executed_stmt).lower()
    assert "workspace_type" in stmt_str or "created_by" in stmt_str or "workspace_members" in stmt_str


@pytest.mark.asyncio
async def test_get_accessible_document_ids_manager(mock_session) -> None:
    # Arrange
    tenant_id = uuid.uuid4()
    user = User(id=uuid.uuid4(), tenant_id=tenant_id, role="MANAGER")
    repo = DocumentAccessRepository(mock_session)

    doc_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [doc_id]
    mock_session.execute.return_value = mock_result

    # Act
    result = await repo.get_accessible_document_ids(user)

    # Assert
    assert result == {doc_id}
    mock_session.execute.assert_called_once()
