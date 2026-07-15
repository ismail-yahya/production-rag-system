import asyncio
import io
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.models import Workspace, WorkspaceMember

# Force UTF-8 output
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding='utf-8')


async def main() -> None:
    dsn_str = settings.POSTGRES_DSN.get_secret_value()
    dsn = dsn_str.replace("@postgres:", "@localhost:")
    engine = create_async_engine(dsn)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Check workspaces
        result_ws = await session.execute(select(Workspace))
        workspaces = result_ws.scalars().all()
        print("--- Workspaces ---")
        for ws in workspaces:
            print(f"WS ID: {ws.id}, Name: {ws.name}, Type: {ws.workspace_type}, Created By: {ws.created_by}, Tenant: {ws.tenant_id}")
            
        # Check members
        result_mem = await session.execute(select(WorkspaceMember))
        members = result_mem.scalars().all()
        print("\n--- Workspace Members ---")
        for m in members:
            print(f"WS ID: {m.workspace_id}, User ID: {m.user_id}, Role: {m.member_role}")

if __name__ == "__main__":
    asyncio.run(main())
