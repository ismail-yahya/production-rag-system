import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from uuid import uuid4

from src.api.main import app
from src.api.dependencies import get_session, get_rag_pipeline
from src.core.config import settings
from src.core.models import Tenant
from src.core.database import engine as real_engine
from src.rag.pipeline import RAGPipeline
from unittest.mock import AsyncMock, MagicMock

# Use the real database for integration tests but we'll use a transaction per test
# to ensure isolation if possible. Or just clean up.

@pytest_asyncio.fixture
async def db_session():
    """Provides a transactional database session for each test."""
    async_session = async_sessionmaker(
        bind=real_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session
        # Rollback to keep the DB clean
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session):
    """Provides an AsyncClient for testing the FastAPI app."""
    
    # Override get_session to use our transactional session
    async def override_get_session():
        yield db_session
        
    app.dependency_overrides[get_session] = override_get_session
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_tenant(db_session: AsyncSession):
    """Creates a test tenant in the database."""
    tenant_id = uuid4()
    api_key = f"test-key-{tenant_id}"
    tenant = Tenant(
        id=tenant_id,
        name="Test Tenant",
        api_key_hash=api_key, # In MVP, hash is the key
        is_active=True
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant

@pytest.fixture
def mock_rag_pipeline():
    """Provides a RAGPipeline with mocked LLM and Embedder."""
    mock_pipeline = MagicMock(spec=RAGPipeline)
    mock_pipeline.query = AsyncMock()
    mock_pipeline.stream_query = AsyncMock()
    return mock_pipeline

@pytest_asyncio.fixture
async def client_with_mock_pipeline(client, mock_rag_pipeline):
    """Provides an AsyncClient with RAGPipeline mocked."""
    app.dependency_overrides[get_rag_pipeline] = lambda: mock_rag_pipeline
    yield client
    app.dependency_overrides.pop(get_rag_pipeline, None)
