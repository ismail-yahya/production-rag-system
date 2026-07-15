import asyncio
import os
import sys
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Ensure project root is in python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.config import settings
from src.core.models import Tenant, User, Workspace, WorkspaceMember, TenantConfig
from src.api.auth import hash_password

async def main():
    print("Connecting to database...")
    dsn = settings.POSTGRES_DSN.get_secret_value()
    if "@postgres:" in dsn:
        dsn = dsn.replace("@postgres:", "@localhost:")
    engine = create_async_engine(dsn)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)

    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    workspace_id = uuid.UUID("00000000-0000-0000-0000-000000000003")

    async with async_session() as session:
        # 1. Seed Tenant
        result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            print("Seeding Tenant 'Aether Group'...")
            tenant = Tenant(
                id=tenant_id,
                name="Aether Group",
                api_key_hash="e2e-test-key",
                is_active=True
            )
            session.add(tenant)
            await session.flush()
        else:
            print("Tenant already exists.")

        # 2. Seed User
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            print("Seeding User 'Ismail Yahya'...")
            user = User(
                id=user_id,
                tenant_id=tenant_id,
                email="ismail.yahya@company.com",
                name="Ismail Yahya",
                password_hash=hash_password("password123"),
                role="SUPER_ADMIN",
                is_active=True
            )
            session.add(user)
            await session.flush()
        else:
            print("User already exists.")

        # 3. Seed Workspace
        result = await session.execute(select(Workspace).where(Workspace.id == workspace_id))
        workspace = result.scalar_one_or_none()
        if not workspace:
            print("Seeding Workspace 'Central Workspace'...")
            workspace = Workspace(
                id=workspace_id,
                tenant_id=tenant_id,
                name="Central Workspace",
                workspace_type="CENTRAL",
                created_by=user_id,
                is_active=True
            )
            session.add(workspace)
            await session.flush()
        else:
            print("Workspace already exists.")

        # 4. Seed Workspace Membership
        result = await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id
            )
        )
        membership = result.scalar_one_or_none()
        if not membership:
            print("Adding User to Workspace Member list...")
            membership = WorkspaceMember(
                workspace_id=workspace_id,
                user_id=user_id,
                member_role="ADMIN"
            )
            session.add(membership)
            await session.flush()
        else:
            print("Workspace membership already exists.")

        # 5. Seed TenantConfig
        result = await session.execute(select(TenantConfig).where(TenantConfig.tenant_id == tenant_id))
        tenant_config = result.scalar_one_or_none()
        if not tenant_config:
            print("Seeding TenantConfig...")
            tenant_config = TenantConfig(
                tenant_id=tenant_id,
                llm_provider="gemini",
                llm_model="gemini-3-flash-preview",
                temperature=0.2,
                query_expansion=True
            )
            session.add(tenant_config)
            await session.flush()
        else:
            print("TenantConfig already exists.")

        await session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    # Ensure correct environment config
    asyncio.run(main())
