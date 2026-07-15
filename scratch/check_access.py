import asyncio
import io
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.models import DocumentAccess

# Force UTF-8 output
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding='utf-8')


async def main() -> None:
    dsn_str = settings.POSTGRES_DSN.get_secret_value()
    dsn = dsn_str.replace("@postgres:", "@localhost:")
    engine = create_async_engine(dsn)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(DocumentAccess))
        accesses = result.scalars().all()
        print(f"Total document access records: {len(accesses)}")
        for acc in accesses:
            print(f"- Doc ID: {acc.document_id}, Workspace ID: {acc.workspace_id}, Access Level: {acc.access_level}")

if __name__ == "__main__":
    asyncio.run(main())
