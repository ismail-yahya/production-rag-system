"""
Integration tests for RBAC enforcement at the routing layer.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import create_access_token
from src.core.models import User


@pytest.mark.asyncio
async def test_rbac_user_vs_admin_endpoints(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange: Create a regular USER and an ADMIN user
    regular_user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="user_role@example.com",
        name="Regular User",
        role="USER",
        is_active=True,
    )
    admin_user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin_role@example.com",
        name="Admin User",
        role="ADMIN",
        is_active=True,
    )
    db_session.add(regular_user)
    db_session.add(admin_user)
    await db_session.commit()

    token_user = create_access_token(regular_user.id, test_tenant.id, regular_user.role)
    token_admin = create_access_token(admin_user.id, test_tenant.id, admin_user.role)

    # 1. USER tries to list users -> should receive 403 Forbidden
    response_user = await client.get("/v1/users", headers={"Authorization": f"Bearer {token_user}"})
    assert response_user.status_code == 403
    assert "Access denied" in response_user.json()["detail"]

    # 2. ADMIN lists users -> should succeed (200 OK)
    response_admin = await client.get("/v1/users", headers={"Authorization": f"Bearer {token_admin}"})
    assert response_admin.status_code == 200
    assert response_admin.json()["total"] >= 2

    # 3. USER tries to create a user -> 403 Forbidden
    create_payload = {
        "email": "newuser@example.com",
        "name": "New User",
        "password": "somePassword123",
        "role": "USER",
    }
    response_create_user = await client.post(
        "/v1/users", json=create_payload, headers={"Authorization": f"Bearer {token_user}"}
    )
    assert response_create_user.status_code == 403

    # 4. ADMIN creates a user -> 201 Created
    response_create_admin = await client.post(
        "/v1/users", json=create_payload, headers={"Authorization": f"Bearer {token_admin}"}
    )
    assert response_create_admin.status_code == 201
    assert response_create_admin.json()["email"] == "newuser@example.com"


@pytest.mark.asyncio
async def test_deactivated_user_blocked(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange: Create a deactivated USER
    inactive_user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="inactive@example.com",
        name="Inactive User",
        role="USER",
        is_active=False,
    )
    db_session.add(inactive_user)
    await db_session.commit()

    token_inactive = create_access_token(inactive_user.id, test_tenant.id, inactive_user.role)

    # Act: Request profile
    response = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token_inactive}"})

    # Assert
    assert response.status_code == 401
    assert "deactivated" in response.json()["detail"]
