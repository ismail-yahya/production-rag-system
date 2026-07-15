import uuid
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.api.auth import hash_password, create_access_token
from src.core.models import User, Tenant, TenantConfig, Workspace, WorkspaceMember, Document, IngestionJob, DocumentAccess


@pytest.fixture(autouse=True)
def patch_mock_db_session(db_session):
    """
    If the database is offline and conftest.py fell back to a mock db_session (AsyncMock),
    we patch it to support:
      1. add_all() by routing calls to add().
      2. Querying TenantConfig, IngestionJob in the execute() mock router.
      3. Updating workspace_members in-memory.
    """
    if isinstance(db_session, AsyncMock):
        # 1. Mock add_all
        def mock_add_all(objs):
            for obj in objs:
                db_session.add(obj)
        db_session.add_all.side_effect = mock_add_all

        # 2. Track added objects for query routing
        added_objects = []
        original_add = db_session.add.side_effect

        def wrapped_add(obj):
            added_objects.append(obj)
            if original_add:
                return original_add(obj)

        db_session.add.side_effect = wrapped_add

        # 3. Intercept execute() calls
        original_execute = db_session.execute.side_effect

        async def wrapped_execute(stmt, *args, **kwargs):
            sql_str = str(stmt).lower()
            try:
                params = stmt.compile().params
            except Exception:
                params = {}

            # Handle TenantConfig queries
            if "from tenant_configs" in sql_str or "tenant_configs." in sql_str:
                configs = [obj for obj in added_objects if isinstance(obj, TenantConfig)]
                filtered_configs = []
                for cfg in configs:
                    matches = True
                    for k, val in params.items():
                        if val is None:
                            continue
                        attr = k.split("_")[0]
                        if hasattr(cfg, attr):
                            cfg_val = getattr(cfg, attr)
                            if cfg_val != val and str(cfg_val) != str(val):
                                matches = False
                                break
                    if matches:
                        filtered_configs.append(cfg)

                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = filtered_configs[0] if filtered_configs else None
                mock_result.scalars.return_value.all.return_value = filtered_configs
                return mock_result

            # Handle IngestionJob queries
            elif "from ingestion_jobs" in sql_str or "ingestion_jobs." in sql_str:
                jobs = [obj for obj in added_objects if isinstance(obj, IngestionJob)]
                filtered_jobs = []
                for j in jobs:
                    matches = True
                    for k, val in params.items():
                        if val is None:
                            continue
                        attr = k.split("_")[0]
                        if hasattr(j, attr):
                            j_val = getattr(j, attr)
                            if j_val != val and str(j_val) != str(val):
                                matches = False
                                break
                    if matches:
                        filtered_jobs.append(j)

                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = filtered_jobs[0] if filtered_jobs else None
                mock_result.scalars.return_value.all.return_value = filtered_jobs
                return mock_result

            # Handle WorkspaceMember updates
            elif "update workspace_members" in sql_str:
                target_ws_id = None
                target_user_id = None
                new_role = params.get("member_role")

                # Extract IDs from parameters
                for k, v in params.items():
                    if k.startswith("workspace_id"):
                        target_ws_id = v
                    elif k.startswith("user_id"):
                        target_user_id = v

                updated_member = None
                for obj in added_objects:
                    if isinstance(obj, WorkspaceMember):
                        if (str(obj.workspace_id) == str(target_ws_id) or target_ws_id is None) and \
                           (str(obj.user_id) == str(target_user_id) or target_user_id is None):
                            if new_role:
                                obj.member_role = new_role
                            updated_member = obj
                            break

                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = updated_member
                mock_result.rowcount = 1 if updated_member else 0
                return mock_result

            # Fallback to conftest.py mock implementation
            return await original_execute(stmt, *args, **kwargs)

        db_session.execute.side_effect = wrapped_execute

    yield db_session


@pytest.fixture(autouse=True)
def mock_redis_in_memory():
    """
    In-memory mock Redis for testing token revocation and checking.
    Intercepts redis.asyncio.from_url to support setex, exists, and rate limit pipeline operations.
    """
    blacklisted_tokens = set()

    class MockPipeline:
        def incr(self, key, amount=1):
            return self
        def expire(self, key, time):
            return self
        async def execute(self):
            return [1, 60]
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class MockRedis:
        async def exists(self, key: str) -> bool:
            return key in blacklisted_tokens

        async def setex(self, key: str, ttl: int, value: str) -> None:
            blacklisted_tokens.add(key)

        def pipeline(self, *args, **kwargs):
            return MockPipeline()

    mock_client = MockRedis()
    with patch("redis.asyncio.from_url", return_value=mock_client):
        yield mock_client


@pytest.mark.asyncio
async def test_tenant_registration_onboarding(client: AsyncClient, db_session: AsyncSession) -> None:
    # Arrange
    register_payload = {
        "name": "Acme Corporation",
        "email": "superadmin@acme.com",
        "password": "superSecurePassword123!",
        "admin_name": "Acme Admin"
    }

    # Act
    resp = await client.post("/v1/auth/register", json=register_payload)

    # Assert
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_name"] == "Acme Corporation"
    assert data["email"] == "superadmin@acme.com"
    assert data["role"] == "SUPER_ADMIN"
    assert "tenant_id" in data
    assert "user_id" in data

    # Verify database state
    tenant_id = uuid.UUID(data["tenant_id"])
    user_id = uuid.UUID(data["user_id"])

    tenant_stmt = select(Tenant).where(Tenant.id == tenant_id)
    tenant_res = await db_session.execute(tenant_stmt)
    tenant_obj = tenant_res.scalar_one_or_none()
    assert tenant_obj is not None
    assert tenant_obj.name == "Acme Corporation"

    user_stmt = select(User).where(User.id == user_id)
    user_res = await db_session.execute(user_stmt)
    user_obj = user_res.scalar_one_or_none()
    assert user_obj is not None
    assert user_obj.email == "superadmin@acme.com"
    assert user_obj.role == "SUPER_ADMIN"

    config_stmt = select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
    config_res = await db_session.execute(config_stmt)
    config_obj = config_res.scalar_one_or_none()
    assert config_obj is not None
    assert config_obj.llm_provider == "openai"


@pytest.mark.asyncio
async def test_logout_token_revocation(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="logouttest@example.com",
        name="Logout User",
        role="USER",
        password_hash=hash_password("password123"),
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id, test_tenant.id, user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Act 1: Call me endpoint (should succeed)
    me_resp = await client.get("/v1/users/me", headers=headers)
    assert me_resp.status_code == 200

    # Act 2: Logout
    logout_resp = await client.post("/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 204

    # Act 3: Call me endpoint again (should fail because token is blocklisted)
    me_resp_after = await client.get("/v1/users/me", headers=headers)
    assert me_resp_after.status_code == 401
    assert "revoked" in me_resp_after.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_user_by_id_and_password_update(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    admin = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin_user@example.com",
        name="Tenant Admin",
        role="ADMIN",
        password_hash=hash_password("adminpass123"),
        is_active=True,
    )
    regular_user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="regular_user@example.com",
        name="Regular User",
        role="USER",
        password_hash=hash_password("userpass123"),
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(regular_user)
    await db_session.commit()

    admin_token = create_access_token(admin.id, test_tenant.id, admin.role)
    user_token = create_access_token(regular_user.id, test_tenant.id, regular_user.role)

    # Act 1: Admin fetches regular user
    resp = await client.get(f"/v1/users/{regular_user.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "regular_user@example.com"

    # Act 2: Regular user tries to fetch admin (should fail due to RBAC)
    resp = await client.get(f"/v1/users/{admin.id}", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 403

    # Act 3: Self-service password change (correct old password)
    pwd_payload = {
        "old_password": "userpass123",
        "new_password": "newUserPass123!"
    }
    resp = await client.patch(f"/v1/users/{regular_user.id}/password", json=pwd_payload, headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 204

    # Act 4: Self-service password change (incorrect old password)
    pwd_payload_bad = {
        "old_password": "wrongOldPassword",
        "new_password": "newUserPass555!"
    }
    resp = await client.patch(f"/v1/users/{regular_user.id}/password", json=pwd_payload_bad, headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 400

    # Act 5: Administrative password reset (no old password required)
    reset_payload = {
        "new_password": "adminForcedPass123!"
    }
    resp = await client.patch(f"/v1/users/{regular_user.id}/password", json=reset_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_update_workspace_member_role(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    admin = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="ws_admin@example.com",
        name="WS Admin",
        role="ADMIN",
        is_active=True,
    )
    regular_user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="ws_member@example.com",
        name="WS Member",
        role="USER",
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(regular_user)
    await db_session.commit()

    workspace = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Test Project Workspace",
        workspace_type="TEAM",
        created_by=admin.id,
        is_active=True,
    )
    db_session.add(workspace)

    # Add creator as workspace ADMIN, and user as VIEWER
    admin_member = WorkspaceMember(workspace_id=workspace.id, user_id=admin.id, member_role="ADMIN", joined_at=datetime.now(UTC))
    user_member = WorkspaceMember(workspace_id=workspace.id, user_id=regular_user.id, member_role="VIEWER", joined_at=datetime.now(UTC))
    db_session.add(admin_member)
    db_session.add(user_member)
    await db_session.commit()

    admin_token = create_access_token(admin.id, test_tenant.id, admin.role)

    # Act: Update user role to MEMBER
    update_payload = {"member_role": "MEMBER"}
    resp = await client.patch(
        f"/v1/workspaces/{workspace.id}/members/{regular_user.id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    # Assert
    assert resp.status_code == 200
    assert resp.json()["member_role"] == "MEMBER"


@pytest.mark.asyncio
async def test_get_document_ingestion_job(client: AsyncClient, db_session: AsyncSession, test_tenant) -> None:
    # Arrange
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="doc_owner@example.com",
        name="Doc Owner",
        role="USER",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    workspace = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Personal Project",
        workspace_type="PERSONAL",
        created_by=user.id,
        is_active=True,
    )
    db_session.add(workspace)

    # Document
    doc = Document(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        file_name="report.pdf",
        file_type="application/pdf",
        storage_path=f"{test_tenant.id}/report.pdf",
        status="processing",
    )
    db_session.add(doc)

    # Link doc to workspace
    doc_access = DocumentAccess(document_id=doc.id, workspace_id=workspace.id, access_level="WRITE")
    db_session.add(doc_access)

    # Ingestion Job
    job = IngestionJob(
        document_id=doc.id,
        status="processing",
        celery_task_id="celery-task-xyz-123",
        retry_count=0,
        started_at=datetime.now(UTC)
    )
    db_session.add(job)
    await db_session.commit()

    user_token = create_access_token(user.id, test_tenant.id, user.role)

    # Act
    resp = await client.get(
        f"/v1/documents/{doc.id}/ingestion-job",
        headers={"Authorization": f"Bearer {user_token}"}
    )

    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "processing"
    assert data["celery_task_id"] == "celery-task-xyz-123"
    assert data["document_id"] == str(doc.id)
