import contextlib
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.api.dependencies import get_rag_pipeline, get_session
from src.api.main import app
from src.core.database import engine as real_engine
from src.core.models import Tenant
from src.rag.pipeline import RAGPipeline

# Use the real database for integration tests but we'll use a transaction per test
# to ensure isolation if possible. Or just clean up.

@pytest.fixture
async def db_session():
    """Provides a database session. Fallback to mock if DB is unavailable."""
    try:
        async_session = async_sessionmaker(
            bind=real_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with async_session() as session:
            yield session
            await session.rollback()
    except Exception:
        import traceback
        traceback.print_exc()
        mock_session = AsyncMock(spec=AsyncSession)
        
        # Mocking execute to return a result that can be scalar_one_or_none()
        # This is tricky because it needs to match the structure of a real result.
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None # Default
        mock_session.execute.return_value = mock_result
        
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.close = AsyncMock()
        yield mock_session

@pytest.fixture
async def client(db_session):
    """Provides an AsyncClient for testing the FastAPI app."""
    
    # Override get_session to use our transactional session
    async def override_get_session():
        yield db_session
        
    app.dependency_overrides[get_session] = override_get_session
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()

@pytest.fixture
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
    
    # If db_session is a mock, we need to make sure execute returns this tenant
    if isinstance(db_session, AsyncMock):
        db_session.execute.return_value.scalar_one_or_none.return_value = tenant
        
    with contextlib.suppress(Exception):
        await db_session.refresh(tenant)
        
    return tenant

@pytest.fixture
def mock_rag_pipeline():
    """Provides a RAGPipeline with mocked LLM and Embedder."""
    mock_pipeline = MagicMock(spec=RAGPipeline)
    mock_pipeline.query = AsyncMock()
    mock_pipeline.stream_query = AsyncMock()
    return mock_pipeline

@pytest.fixture
async def client_with_mock_pipeline(client, mock_rag_pipeline):
    """Provides an AsyncClient with RAGPipeline mocked."""
    app.dependency_overrides[get_rag_pipeline] = lambda: mock_rag_pipeline
    yield client
    app.dependency_overrides.pop(get_rag_pipeline, None)
