"""
Unit tests for permissions checking and RBAC logic in src/api/permissions.py.
We target 100% test coverage.
"""

import pytest
from fastapi import HTTPException, status

from src.api.permissions import (
    ADMIN,
    MANAGER,
    SUPER_ADMIN,
    USER,
    _role_level,
    require_active_user,
    require_min_role,
    require_role,
)
from src.core.models import User as UserModel


def test_role_level() -> None:
    # Act & Assert
    assert _role_level(USER) == 0
    assert _role_level(MANAGER) == 1
    assert _role_level(ADMIN) == 2
    assert _role_level(SUPER_ADMIN) == 3
    assert _role_level("UNKNOWN_ROLE") == -1


@pytest.mark.asyncio
async def test_require_role_success() -> None:
    # Arrange
    user = UserModel(role=ADMIN)
    dependency = require_role(ADMIN, SUPER_ADMIN)

    # Act
    result = await dependency(user)

    # Assert
    assert result == user


@pytest.mark.asyncio
async def test_require_role_denied() -> None:
    # Arrange
    user = UserModel(role=USER)
    dependency = require_role(ADMIN, SUPER_ADMIN)

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await dependency(user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Access denied" in exc_info.value.detail
    assert "Your role: USER" in exc_info.value.detail


@pytest.mark.asyncio
async def test_require_min_role_success() -> None:
    # Arrange
    user = UserModel(role=ADMIN)
    dependency = require_min_role(MANAGER)

    # Act & Assert
    # ADMIN is >= MANAGER, should pass
    result = await dependency(user)
    assert result == user


@pytest.mark.asyncio
async def test_require_min_role_denied() -> None:
    # Arrange
    user = UserModel(role=USER)
    dependency = require_min_role(MANAGER)

    # Act & Assert
    # USER is < MANAGER, should raise 403
    with pytest.raises(HTTPException) as exc_info:
        await dependency(user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Minimum required role: MANAGER" in exc_info.value.detail


@pytest.mark.asyncio
async def test_require_active_user_success() -> None:
    # Arrange
    user = UserModel(role=USER, is_active=True)
    dependency = require_active_user()

    # Act
    result = await dependency(user)

    # Assert
    assert result == user


@pytest.mark.asyncio
async def test_require_active_user_denied() -> None:
    # Arrange
    user = UserModel(role=USER, is_active=False)
    dependency = require_active_user()

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await dependency(user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "account has been deactivated" in exc_info.value.detail
