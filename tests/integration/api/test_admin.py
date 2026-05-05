import contextlib
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import Tenant


@pytest.fixture
async def admin_tenant(db_session: AsyncSession):
    """Creates an admin test tenant in the database."""
    tenant_id = uuid4()
    api_key = f"admin-key-{tenant_id}"
    tenant = Tenant(
        id=tenant_id,
        name="System Administrator",
        api_key_hash=api_key,
        is_active=True
    )
    from unittest.mock import AsyncMock
    db_session.add(tenant)
    await db_session.commit()
    
    if isinstance(db_session, AsyncMock):
        db_session.execute.return_value.scalar_one_or_none.return_value = tenant
        
    with contextlib.suppress(Exception):
        await db_session.refresh(tenant)
    return tenant

@pytest.mark.asyncio
async def test_admin_stats_unauthorized(client, test_tenant):
    # Arrange: use non-admin tenant
    headers = {"Authorization": f"Bearer {test_tenant.api_key_hash}"}
    
    # Act
    response = await client.get("/v1/admin/stats", headers=headers)
    
    # Assert
    assert response.status_code == 403
    assert "Administrative privileges required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_admin_stats_success(client, admin_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {admin_tenant.api_key_hash}"}
    
    # Act
    response = await client.get("/v1/admin/stats", headers=headers)
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "total_documents" in data

@pytest.mark.asyncio
async def test_admin_eval_run(client, admin_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {admin_tenant.api_key_hash}"}
    
    with patch("src.api.routers.admin.run_ragas_eval") as mock_task:
        mock_task.delay.return_value = MagicMock(id=str(uuid4()))
        
        # Act
        response = await client.post("/v1/admin/eval/run", headers=headers)
        
        # Assert
        assert response.status_code == 202
        assert response.json()["status"] == "pending"

@pytest.mark.asyncio
async def test_admin_eval_results_empty(client, admin_tenant):
    # Arrange
    headers = {"Authorization": f"Bearer {admin_tenant.api_key_hash}"}
    
    with patch("redis.from_url") as mock_redis:
        mock_client = MagicMock()
        mock_redis.return_value = mock_client
        mock_client.get.return_value = None
        
        # Act
        response = await client.get("/v1/admin/eval/results", headers=headers)
        
        # Assert
        assert response.status_code == 200
        assert response.json()["results"] == []
