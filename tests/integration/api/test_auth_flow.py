"""
Integration tests for the authentication and API key management routes.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import hash_password, create_access_token
from src.core.models import User, ApiKey


@pytest.mark.asyncio
async def test_login_and_refresh_flow(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    password = "securePassword123"
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="testlogin@example.com",
        name="Login User",
        role="USER",
        password_hash=hash_password(password),
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Act 1: Successful Login
    login_payload = {
        "tenant_id": str(test_tenant.id),
        "email": user.email,
        "password": password,
    }
    login_resp = await client.post("/v1/auth/login", json=login_payload)

    # Assert 1
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Act 2: Failed Login (Wrong Password)
    bad_payload = {
        "tenant_id": str(test_tenant.id),
        "email": user.email,
        "password": "wrongPassword",
    }
    bad_resp = await client.post("/v1/auth/login", json=bad_payload)

    # Assert 2
    assert bad_resp.status_code == 401
    assert bad_resp.json()["detail"] == "Invalid email or password"

    # Act 3: Token Refresh
    refresh_payload = {
        "refresh_token": token_data["refresh_token"],
    }
    refresh_resp = await client.post("/v1/auth/refresh", json=refresh_payload)

    # Assert 3
    assert refresh_resp.status_code == 200
    refresh_data = refresh_resp.json()
    assert "access_token" in refresh_data
    assert "expires_in" in refresh_data


@pytest.mark.asyncio
async def test_api_key_management_flow(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="apikeyowner@example.com",
        name="Key Owner",
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    access_token = create_access_token(user.id, test_tenant.id, user.role)
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act 1: Create API Key
    create_payload = {"name": "Production Key"}
    create_resp = await client.post("/v1/auth/api-keys", json=create_payload, headers=headers)

    # Assert 1
    assert create_resp.status_code == 201
    key_data = create_resp.json()
    assert key_data["name"] == "Production Key"
    assert "raw_key" in key_data
    key_id = key_data["key_id"]

    # Act 2: List API Keys
    list_resp = await client.get("/v1/auth/api-keys", headers=headers)

    # Assert 2
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] == 1
    assert list_data["api_keys"][0]["key_id"] == key_id
    assert list_data["api_keys"][0]["name"] == "Production Key"
    assert list_data["api_keys"][0]["is_active"] is True

    # Act 3: Rotate API Key
    rotate_payload = {"name": "Rotated Production Key"}
    rotate_resp = await client.post(f"/v1/auth/api-keys/{key_id}/rotate", json=rotate_payload, headers=headers)

    # Assert 3
    assert rotate_resp.status_code == 201
    rotated_data = rotate_resp.json()
    assert rotated_data["name"] == "Rotated Production Key"
    assert "raw_key" in rotated_data
    new_key_id = rotated_data["key_id"]

    # Act 4: List API Keys again to verify old key is deactivated
    list_resp2 = await client.get("/v1/auth/api-keys", headers=headers)
    assert list_resp2.status_code == 200
    list_data2 = list_resp2.json()
    assert list_data2["total"] == 2
    
    # Old key should be inactive, new key active
    active_keys = [k for k in list_data2["api_keys"] if k["is_active"]]
    inactive_keys = [k for k in list_data2["api_keys"] if not k["is_active"]]
    assert len(active_keys) == 1
    assert len(inactive_keys) == 1
    assert active_keys[0]["key_id"] == new_key_id

    # Act 5: Deactivate API Key
    del_resp = await client.delete(f"/v1/auth/api-keys/{new_key_id}", headers=headers)
    assert del_resp.status_code == 204

    # List again to verify all are inactive
    list_resp3 = await client.get("/v1/auth/api-keys", headers=headers)
    assert len([k for k in list_resp3.json()["api_keys"] if k["is_active"]]) == 0
