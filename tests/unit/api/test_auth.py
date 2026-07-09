"""
Unit tests for authentication utilities in src/api/auth.py and dependencies.py.

We target 100% test coverage for:
- src/api/auth.py
- src/api/dependencies.py (get_current_user, get_tenant, get_admin)
"""

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from src.api.auth import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    decode_token,
    generate_api_key,
    hash_password,
    verify_api_key,
    verify_password,
)
from src.api.dependencies import get_admin, get_current_user, get_tenant
from src.core.exceptions import SecurityError
from src.core.models import ApiKey, Tenant, User


# ---------------------------------------------------------------------------
# Password utilities tests
# ---------------------------------------------------------------------------


def test_password_hashing_and_verification() -> None:
    # Arrange
    plain = "my-secure-password"

    # Act
    hashed = hash_password(plain)
    verify_ok = verify_password(plain, hashed)
    verify_fail = verify_password("wrong-password", hashed)

    # Assert
    assert hashed != plain
    assert hashed.startswith("$2b$")
    assert verify_ok is True
    assert verify_fail is False


def test_verify_password_handles_exceptions() -> None:
    # Act
    result = verify_password("plain", "not-a-bcrypt-hash")

    # Assert
    assert result is False


# ---------------------------------------------------------------------------
# API key utilities tests
# ---------------------------------------------------------------------------


def test_generate_and_verify_api_key() -> None:
    # Act
    raw_key, key_hash = generate_api_key()
    verify_ok = verify_api_key(raw_key, key_hash)
    verify_fail = verify_api_key("wrong-raw-key", key_hash)

    # Assert
    assert len(raw_key) == 64  # 32 bytes hex
    assert key_hash.startswith("$2b$")
    assert verify_ok is True
    assert verify_fail is False


def test_verify_api_key_handles_exceptions() -> None:
    # Act
    result = verify_api_key("raw", "not-a-bcrypt-hash")

    # Assert
    assert result is False


# ---------------------------------------------------------------------------
# JWT utilities tests
# ---------------------------------------------------------------------------


@patch("src.api.auth.settings")
def test_get_jwt_secret_raises_if_none(mock_settings: MagicMock) -> None:
    # Arrange
    mock_settings.JWT_SECRET_KEY = None
    mock_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60
    mock_settings.JWT_ALGORITHM = "HS256"

    # Act & Assert
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY is not set"):
        create_access_token(uuid.uuid4(), uuid.uuid4(), "USER")


def test_create_and_decode_access_token() -> None:
    # Arrange
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    role = "MANAGER"
    extra_claims = {"custom": "claim"}

    # Act
    token = create_access_token(user_id, tenant_id, role, extra_claims=extra_claims)
    payload = decode_access_token(token)

    # Assert
    assert payload["sub"] == str(user_id)
    assert payload["tid"] == str(tenant_id)
    assert payload["role"] == role
    assert payload["type"] == ACCESS_TOKEN_TYPE
    assert payload["custom"] == "claim"


def test_create_and_decode_refresh_token() -> None:
    # Arrange
    user_id = uuid.uuid4()

    # Act
    token = create_refresh_token(user_id)
    payload = decode_refresh_token(token)

    # Assert
    assert payload["sub"] == str(user_id)
    assert payload["type"] == REFRESH_TOKEN_TYPE


def test_decode_token_invalid_signature_raises_security_error() -> None:
    # Arrange
    token = "invalid.jwt.token"

    # Act & Assert
    with pytest.raises(SecurityError, match="Invalid or expired token"):
        decode_token(token)


def test_decode_access_token_with_refresh_token_raises_security_error() -> None:
    # Arrange
    user_id = uuid.uuid4()
    refresh_token = create_refresh_token(user_id)

    # Act & Assert
    with pytest.raises(SecurityError, match="Token is not a valid access token"):
        decode_access_token(refresh_token)


def test_decode_refresh_token_with_access_token_raises_security_error() -> None:
    # Arrange
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    access_token = create_access_token(user_id, tenant_id, "USER")

    # Act & Assert
    with pytest.raises(SecurityError, match="Token is not a valid refresh token"):
        decode_refresh_token(access_token)


# ---------------------------------------------------------------------------
# FastAPI dependency authentication tests (get_current_user)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_current_user_jwt_success() -> None:
    # Arrange
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    role = "USER"
    token = create_access_token(user_id, tenant_id, role)

    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    mock_session = AsyncMock()

    user_mock = User(id=user_id, tenant_id=tenant_id, name="Test User", role=role, is_active=True)
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = user_mock

    # Act
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        user = await get_current_user(mock_auth, mock_session)

    # Assert
    assert user == user_mock
    mock_user_repo.get_by_id.assert_called_once_with(user_id, tenant_id)


@pytest.mark.asyncio
async def test_get_current_user_jwt_inactive_user_raises_401() -> None:
    # Arrange
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    token = create_access_token(user_id, tenant_id, "USER")

    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    mock_session = AsyncMock()

    user_mock = User(id=user_id, tenant_id=tenant_id, name="Test User", role="USER", is_active=False)
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = user_mock

    # Act & Assert
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "deactivated" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_jwt_missing_user_raises_401() -> None:
    # Arrange
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    token = create_access_token(user_id, tenant_id, "USER")

    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    mock_session = AsyncMock()

    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = None

    # Act & Assert
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "not found" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_api_key_success() -> None:
    # Arrange
    raw_key, key_hash = generate_api_key()
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=raw_key)
    mock_session = AsyncMock()

    api_key_obj = ApiKey(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        key_hash=key_hash,
        is_active=True,
    )

    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [api_key_obj]
    mock_session.execute.return_value = mock_execute_result

    user_mock = User(
        id=api_key_obj.user_id,
        tenant_id=api_key_obj.tenant_id,
        name="API Key User",
        role="USER",
        is_active=True,
    )
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = user_mock

    mock_api_key_repo = AsyncMock()

    # Act
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo), \
         patch("src.api.repositories.ApiKeyRepository", return_value=mock_api_key_repo):
        user = await get_current_user(mock_auth, mock_session)

    # Assert
    assert user == user_mock
    mock_api_key_repo.record_usage.assert_called_once_with(api_key_obj.id)


@pytest.mark.asyncio
async def test_get_current_user_api_key_inactive_user_raises_401() -> None:
    # Arrange
    raw_key, key_hash = generate_api_key()
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=raw_key)
    mock_session = AsyncMock()

    api_key_obj = ApiKey(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        key_hash=key_hash,
        is_active=True,
    )

    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [api_key_obj]
    mock_session.execute.return_value = mock_execute_result

    user_mock = User(
        id=api_key_obj.user_id,
        tenant_id=api_key_obj.tenant_id,
        name="API Key User",
        role="USER",
        is_active=False,
    )
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = user_mock

    # Act & Assert
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "deactivated" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_api_key_missing_user_raises_401() -> None:
    # Arrange
    raw_key, key_hash = generate_api_key()
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=raw_key)
    mock_session = AsyncMock()

    api_key_obj = ApiKey(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        key_hash=key_hash,
        is_active=True,
    )

    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [api_key_obj]
    mock_session.execute.return_value = mock_execute_result

    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_id.return_value = None

    # Act & Assert
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "not found" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_legacy_tenant_api_key_success() -> None:
    # Arrange
    legacy_key = "legacy-raw-api-key"
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=legacy_key)
    mock_session = AsyncMock()

    # 1. API key scan fails
    mock_keys_result = MagicMock()
    mock_keys_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_keys_result

    # 2. Mock legacy tenant query returns a tenant
    tenant_mock = Tenant(id=uuid.uuid4(), name="Legacy Test Admin", api_key_hash=legacy_key)
    mock_tenant_result = MagicMock()
    mock_tenant_result.scalar_one_or_none.return_value = tenant_mock

    # Chain executions
    mock_session.execute.side_effect = [mock_keys_result, mock_tenant_result]

    # Mock user creation / retrieval
    user_mock = User(
        id=uuid.uuid4(),
        tenant_id=tenant_mock.id,
        email=f"legacy_admin_{tenant_mock.id}@system.local",
        name=tenant_mock.name,
        role="ADMIN",
    )
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_email.return_value = None
    mock_user_repo.create.return_value = user_mock

    # Act
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        user = await get_current_user(mock_auth, mock_session)

    # Assert
    assert user == user_mock
    mock_user_repo.create.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_get_current_user_legacy_tenant_user_exists_role_mismatch_updates() -> None:
    # Arrange
    legacy_key = "legacy-raw-api-key"
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=legacy_key)
    mock_session = AsyncMock()

    # 1. API key scan fails
    mock_keys_result = MagicMock()
    mock_keys_result.scalars.return_value.all.return_value = []

    # 2. Mock legacy tenant query returns a tenant
    tenant_mock = Tenant(id=uuid.uuid4(), name="Legacy Test Admin", api_key_hash=legacy_key)
    mock_tenant_result = MagicMock()
    mock_tenant_result.scalar_one_or_none.return_value = tenant_mock

    mock_session.execute.side_effect = [mock_keys_result, mock_tenant_result]

    user_mock = User(
        id=uuid.uuid4(),
        tenant_id=tenant_mock.id,
        email=f"legacy_admin_{tenant_mock.id}@system.local",
        name=tenant_mock.name,
        role="USER",  # mismatch (name has "Admin" so role should be ADMIN)
    )
    mock_user_repo = AsyncMock()
    mock_user_repo.get_by_email.return_value = user_mock

    # Act
    with patch("src.api.repositories.UserRepository", return_value=mock_user_repo):
        user = await get_current_user(mock_auth, mock_session)

    # Assert
    assert user.role == "ADMIN"
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_get_current_user_all_auth_paths_fail_raises_401() -> None:
    # Arrange
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials="completely-invalid")
    mock_session = AsyncMock()

    # Make all DB execution calls return None
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid or inactive API key" in exc_info.value.detail


# ---------------------------------------------------------------------------
# FastAPI dependency legacy tests (get_tenant, get_admin)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_tenant_success() -> None:
    # Arrange
    api_key = "legacy-raw-api-key"
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials=api_key)
    mock_session = AsyncMock()

    tenant_mock = Tenant(id=uuid.uuid4(), name="Test Tenant", api_key_hash=api_key, is_active=True)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = tenant_mock
    mock_session.execute.return_value = mock_result

    # Act
    tenant = await get_tenant(mock_auth, mock_session)

    # Assert
    assert tenant == tenant_mock


@pytest.mark.asyncio
async def test_get_tenant_not_found_raises_401() -> None:
    # Arrange
    mock_auth = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-key")
    mock_session = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_tenant(mock_auth, mock_session)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid or inactive API key" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_admin_success() -> None:
    # Arrange
    tenant_mock = Tenant(id=uuid.uuid4(), name="System Administrator", api_key_hash="key", is_active=True)

    # Act
    result = await get_admin(tenant_mock)

    # Assert
    assert result == tenant_mock


@pytest.mark.asyncio
async def test_get_admin_insufficient_privileges_raises_403() -> None:
    # Arrange
    tenant_mock = Tenant(id=uuid.uuid4(), name="Regular Customer", api_key_hash="key", is_active=True)

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_admin(tenant_mock)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Administrative privileges required" in exc_info.value.detail
