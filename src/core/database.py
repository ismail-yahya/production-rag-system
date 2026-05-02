from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings

# Create async engine
# future=True is default in 2.0, but explicit is fine
engine = create_async_engine(
    settings.POSTGRES_DSN.get_secret_value(),
    echo=False,
    future=True,
    pool_pre_ping=True,
)

# Create session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database sessions.
    Used in FastAPI Depends or as a context manager.
    """
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
