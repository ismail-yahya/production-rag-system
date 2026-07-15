"""
Integration tests for the chat history and tenant settings configuration routes.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import hash_password, create_access_token
from src.core.models import User, ChatThread, ChatMessage, TenantConfig


@pytest.mark.asyncio
async def test_chat_history_endpoints(
    client: AsyncClient,
    db_session: AsyncSession,
    test_tenant,
) -> None:
    # 1. Arrange: Create a user and auth headers
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=test_tenant.id,
        email="chatuser@example.com",
        name="Chat Tester",
        role="USER",
        password_hash=hash_password("password123"),
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id, user.tenant_id, user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Act: Create a chat thread
    create_payload = {"title": "Grounding VPN Setup"}
    create_resp = await client.post("/v1/chat/threads", json=create_payload, headers=headers)

    # Assert
    assert create_resp.status_code == 201
    thread_data = create_resp.json()
    assert thread_data["title"] == "Grounding VPN Setup"
    thread_id = thread_data["id"]

    # 3. Act: List chat threads
    list_resp = await client.get("/v1/chat/threads", headers=headers)
    assert list_resp.status_code == 200
    threads = list_resp.json()
    assert len(threads) == 1
    assert threads[0]["id"] == thread_id

    # 4. Act: Get messages (initially empty)
    msgs_resp = await client.get(f"/v1/chat/threads/{thread_id}/messages", headers=headers)
    assert msgs_resp.status_code == 200
    assert len(msgs_resp.json()) == 0

    # 5. Act: Add a message manually inside DB to test retrieval
    msg = ChatMessage(
        thread_id=uuid.UUID(thread_id),
        role="user",
        content="Is MFA required for VPN?",
    )
    db_session.add(msg)
    await db_session.commit()

    msgs_resp = await client.get(f"/v1/chat/threads/{thread_id}/messages", headers=headers)
    assert msgs_resp.status_code == 200
    msgs = msgs_resp.json()
    assert len(msgs) == 1
    assert msgs[0]["content"] == "Is MFA required for VPN?"

    # 6. Act: Delete chat thread
    del_resp = await client.delete(f"/v1/chat/threads/{thread_id}", headers=headers)
    assert del_resp.status_code == 204

    # 7. Assert deleted
    list_resp = await client.get("/v1/chat/threads", headers=headers)
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_tenant_settings_endpoints(
    client: AsyncClient,
    db_session: AsyncSession,
    test_tenant,
) -> None:
    # 1. Arrange: Create a SUPER_ADMIN user and a normal USER
    super_admin_id = uuid.uuid4()
    super_admin = User(
        id=super_admin_id,
        tenant_id=test_tenant.id,
        email="superadmin@example.com",
        name="Super Admin",
        role="SUPER_ADMIN",
        password_hash=hash_password("password123"),
        is_active=True,
    )

    normal_user_id = uuid.uuid4()
    normal_user = User(
        id=normal_user_id,
        tenant_id=test_tenant.id,
        email="normal@example.com",
        name="Normal User",
        role="USER",
        password_hash=hash_password("password123"),
        is_active=True,
    )
    db_session.add_all([super_admin, normal_user])
    await db_session.commit()

    admin_token = create_access_token(super_admin.id, super_admin.tenant_id, super_admin.role)
    user_token = create_access_token(normal_user.id, normal_user.tenant_id, normal_user.role)

    # 2. Act: Get Tenant Config (normal user is allowed)
    config_resp = await client.get("/v1/settings/config", headers={"Authorization": f"Bearer {user_token}"})
    assert config_resp.status_code == 200
    config_data = config_resp.json()
    assert config_data["llm_model"] == "gpt-4o"  # Default

    # 3. Act: Update Tenant Config as Normal User (expect 403 Forbidden)
    update_payload = {"llm_model": "claude-3-5-sonnet"}
    forbidden_resp = await client.patch(
        "/v1/settings/config",
        json=update_payload,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert forbidden_resp.status_code == 403

    # 4. Act: Update Tenant Config as SUPER_ADMIN (expect 200 OK)
    success_resp = await client.patch(
        "/v1/settings/config",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert success_resp.status_code == 200
    updated_data = success_resp.json()
    assert updated_data["llm_model"] == "claude-3-5-sonnet"

    # 5. Act: Retrieve again and verify update persisted
    verify_resp = await client.get("/v1/settings/config", headers={"Authorization": f"Bearer {user_token}"})
    assert verify_resp.json()["llm_model"] == "claude-3-5-sonnet"
