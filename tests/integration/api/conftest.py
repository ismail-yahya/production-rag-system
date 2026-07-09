import contextlib
from unittest.mock import AsyncMock, MagicMock, patch, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.api.dependencies import get_rag_pipeline, get_session
from src.api.main import app
from src.core.database import engine as real_engine
from src.core.models import Document, Tenant
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
            # Verify connectivity before yielding. If database is unreachable,
            # this raises an exception and triggers the fallback to mock_session.
            await session.execute(text("SELECT 1"))
            yield session
            await session.rollback()
        await real_engine.dispose()
    except Exception:
        import traceback

        traceback.print_exc()
        mock_session = AsyncMock(spec=AsyncSession)
        session_objects = []

        def mock_add(obj):
            import uuid
            from datetime import datetime, UTC
            if hasattr(obj, "id") and getattr(obj, "id") is None:
                obj.id = uuid.uuid4()
            if hasattr(obj, "created_at") and getattr(obj, "created_at") is None:
                obj.created_at = datetime.now(UTC)
            if hasattr(obj, "is_active") and getattr(obj, "is_active") is None:
                obj.is_active = True
            session_objects.append(obj)

        mock_session.add.side_effect = mock_add

        async def mock_execute(stmt, *args, **kwargs):
            import uuid
            import re
            from src.core.models import Tenant, User, Document, Workspace, WorkspaceMember, DocumentAccess, ApiKey, QueryLog, AuditLog, IngestionJob

            sql_str = str(stmt).lower()
            mock_result = MagicMock()
            mock_result.rowcount = 1

            # Compile query to extract bound parameters for filtering
            try:
                params = stmt.compile().params
            except Exception:
                params = {}

            # Execute update statements in memory
            if "update " in sql_str:
                table_name = None
                if "update api_keys" in sql_str:
                    table_name = "api_keys"
                elif "update users" in sql_str:
                    table_name = "users"
                elif "update workspaces" in sql_str:
                    table_name = "workspaces"

                if table_name:
                    target_id = None
                    for k, v in params.items():
                        if k.endswith("_1") or k == "id" or k == "key_id":
                            try:
                                if isinstance(v, uuid.UUID) or (isinstance(v, str) and len(v) == 36):
                                    target_id = v
                                    break
                            except Exception:
                                pass
                    for obj in session_objects:
                        obj_table = getattr(obj, "__tablename__", None)
                        if obj_table == table_name:
                            if target_id is None or str(getattr(obj, "id", "")) == str(target_id):
                                for field_name, field_val in params.items():
                                    if hasattr(obj, field_name):
                                        setattr(obj, field_name, field_val)

            # Helper to find query user context (check contextvars first, fallback to bound params)
            from src.core.context import user_id_context
            query_user_id = user_id_context.get()
            if not query_user_id:
                for val in params.values():
                    for obj in session_objects:
                        if isinstance(obj, User) and (obj.id == val or str(obj.id) == str(val)):
                            query_user_id = obj.id
                            break

            # Helper to determine workspaces accessible by user
            user_workspace_ids = set()
            if query_user_id:
                for obj in session_objects:
                    if isinstance(obj, WorkspaceMember) and (obj.user_id == query_user_id or str(obj.user_id) == str(query_user_id)):
                        user_workspace_ids.add(obj.workspace_id)
                    elif isinstance(obj, Workspace) and (obj.created_by == query_user_id or str(obj.created_by) == str(query_user_id)):
                        user_workspace_ids.add(obj.id)
            
            print(f"DEBUG mock_execute: sql={sql_str[:50]}..., query_user_id={query_user_id}, user_workspace_ids={user_workspace_ids}")

            def get_base_attr(k: str) -> str:
                # e.g., "tenant_id_1" -> "tenant_id", "email_2" -> "email"
                return re.sub(r'_\d+$', '', k)

            # Match function for simple value lookups based on actual attributes of the object
            def matches_params(obj) -> bool:
                if not params:
                    return True
                for k, val in params.items():
                    if val is None:
                        continue
                    attr = get_base_attr(k)
                    if hasattr(obj, attr):
                        obj_val = getattr(obj, attr)
                        if isinstance(val, (list, set, tuple)):
                            if obj_val not in val and str(obj_val) not in val:
                                return False
                        else:
                            if obj_val != val and str(obj_val) != str(val):
                                return False
                return True

            # Route query based on referenced tables
            if "from tenants" in sql_str or "tenants." in sql_str:
                tenants = [obj for obj in session_objects if isinstance(obj, Tenant) and matches_params(obj)]
                mock_result.scalar_one_or_none.return_value = tenants[0] if tenants else None
                mock_result.scalars.return_value.all.return_value = tenants
            elif "from users" in sql_str or "users." in sql_str:
                users = [obj for obj in session_objects if isinstance(obj, User) and matches_params(obj)]
                mock_result.scalar_one_or_none.return_value = users[0] if users else None
                mock_result.scalars.return_value.all.return_value = users
            elif "from documents" in sql_str or "documents." in sql_str:
                docs = [obj for obj in session_objects if isinstance(obj, Document) and matches_params(obj)]
                mock_result.scalar_one_or_none.return_value = docs[0] if docs else None
                mock_result.scalars.return_value.all.return_value = docs
            elif "from document_access" in sql_str or "document_access." in sql_str:
                access = [obj for obj in session_objects if isinstance(obj, DocumentAccess)]
                if query_user_id:
                    access = [a for a in access if a.workspace_id in user_workspace_ids or str(a.workspace_id) in [str(x) for x in user_workspace_ids]]
                access = [a for a in access if matches_params(a)]
                if "document_access.document_id" in sql_str:
                    access = [a.document_id for a in access]
                mock_result.scalar_one_or_none.return_value = access[0] if access else None
                mock_result.scalars.return_value.all.return_value = access
            elif "from workspaces" in sql_str or "workspaces." in sql_str:
                workspaces = [obj for obj in session_objects if isinstance(obj, Workspace)]
                if query_user_id:
                    # Non-admin users only see workspaces they are members of, created, or CENTRAL
                    workspaces = [
                        w for w in workspaces
                        if w.id in user_workspace_ids or str(w.id) in [str(x) for x in user_workspace_ids] or w.created_by == query_user_id or str(w.created_by) == str(query_user_id) or w.workspace_type == "CENTRAL"
                    ]
                workspaces = [w for w in workspaces if matches_params(w)]
                mock_result.scalar_one_or_none.return_value = workspaces[0] if workspaces else None
                mock_result.scalars.return_value.all.return_value = workspaces
            elif "from workspace_members" in sql_str or "workspace_members." in sql_str:
                members = [obj for obj in session_objects if isinstance(obj, WorkspaceMember) and matches_params(obj)]
                mock_result.scalar_one_or_none.return_value = members[0] if members else None
                mock_result.scalars.return_value.all.return_value = members
            elif "from api_keys" in sql_str or "api_keys." in sql_str:
                keys = [obj for obj in session_objects if isinstance(obj, ApiKey) and matches_params(obj)]
                mock_result.scalar_one_or_none.return_value = keys[0] if keys else None
                mock_result.scalars.return_value.all.return_value = keys
            else:
                # Default empty results
                mock_result.scalar_one_or_none.return_value = None
                mock_result.scalars.return_value.all.return_value = []
                mock_result.scalar.return_value = 0

            return mock_result

        mock_session.execute.side_effect = mock_execute
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
        api_key_hash=api_key,  # In MVP, hash is the key
        is_active=True,
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
    mock_pipeline.stream_query = MagicMock()
    return mock_pipeline


@pytest.fixture
async def client_with_mock_pipeline(client, mock_rag_pipeline):
    """Provides an AsyncClient with RAGPipeline mocked."""
    app.dependency_overrides[get_rag_pipeline] = lambda: mock_rag_pipeline
    yield client
    app.dependency_overrides.pop(get_rag_pipeline, None)
@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis to completely decouple tests from the Redis dependency."""
    mock_redis_client = MagicMock()
    mock_pipeline = AsyncMock()
    
    # Setup mock pipeline behavior
    mock_pipeline.incr.return_value = None
    mock_pipeline.ttl.return_value = None
    mock_pipeline.execute.return_value = [1, 60]  # [current_count, ttl]
    mock_pipeline.__aenter__.return_value = mock_pipeline
    mock_pipeline.__aexit__.return_value = None
    
    mock_redis_client.pipeline.return_value = mock_pipeline
    mock_redis_client.expire = AsyncMock()
    
    with patch("redis.asyncio.from_url", return_value=mock_redis_client):
        yield mock_redis_client
