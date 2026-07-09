import uuid
import pytest
from datetime import datetime, UTC
from unittest.mock import MagicMock

from src.api.auth import create_access_token
from src.core.models import User, Workspace, WorkspaceMember, Document, DocumentAccess


@pytest.mark.asyncio
async def test_workspace_isolation_query_filtering(
    client_with_mock_pipeline, db_session, test_tenant, mock_rag_pipeline
):
    # 1. Arrange: Create Workspaces
    workspace_a = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Workspace A",
        workspace_type="TEAM",
        is_active=True,
    )
    workspace_b = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Workspace B",
        workspace_type="TEAM",
        is_active=True,
    )
    db_session.add(workspace_a)
    db_session.add(workspace_b)

    # 2. Arrange: Create Users
    user1 = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="user1@example.com",
        name="User One",
        role="USER",
        is_active=True,
    )
    user2 = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="user2@example.com",
        name="User Two",
        role="USER",
        is_active=True,
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.flush()

    # Add users to their respective workspaces
    member_a = WorkspaceMember(
        workspace_id=workspace_a.id,
        user_id=user1.id,
        member_role="MEMBER",
    )
    member_b = WorkspaceMember(
        workspace_id=workspace_b.id,
        user_id=user2.id,
        member_role="MEMBER",
    )
    db_session.add(member_a)
    db_session.add(member_b)
    await db_session.flush()

    # 3. Arrange: Create Documents and grant access
    doc_a = Document(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        file_name="doc_a.pdf",
        file_type="application/pdf",
        storage_path="path/a.pdf",
        status="indexed",
        created_at=datetime.now(UTC),
        
    )
    doc_b = Document(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        file_name="doc_b.pdf",
        file_type="application/pdf",
        storage_path="path/b.pdf",
        status="indexed",
        created_at=datetime.now(UTC),
        
    )
    db_session.add(doc_a)
    db_session.add(doc_b)
    await db_session.flush()

    access_a = DocumentAccess(
        document_id=doc_a.id,
        workspace_id=workspace_a.id,
        access_level="READ",
    )
    access_b = DocumentAccess(
        document_id=doc_b.id,
        workspace_id=workspace_b.id,
        access_level="READ",
    )
    db_session.add(access_a)
    db_session.add(access_b)
    await db_session.commit()

    # Generate JWT tokens for users
    token_user1 = create_access_token(user1.id, test_tenant.id, user1.role)
    token_user2 = create_access_token(user2.id, test_tenant.id, user2.role)

    # Mock RAG response
    mock_rag_pipeline.query.return_value = MagicMock(
        answer="Mock RAG Answer",
        sources=[],
        query_expansions=[],
        retrieval_count=0,
        model="test-model",
        latency_ms=10.0,
        model_dump=lambda: {
            "answer": "Mock RAG Answer",
            "sources": [],
            "query_expansions": [],
            "retrieval_count": 0,
            "model": "test-model",
            "latency_ms": 10.0,
        },
    )

    # 4. Act: Query as User 1
    headers1 = {"Authorization": f"Bearer {token_user1}"}
    response1 = await client_with_mock_pipeline.post(
        "/v1/query",
        json={"question": "What is in Workspace A?"},
        headers=headers1,
    )
    assert response1.status_code == 200

    # Assert User 1 only passed doc_a.id to retriever
    call_args1 = mock_rag_pipeline.query.call_args[1]
    assert call_args1["filters"]["document_id"] == [str(doc_a.id)]

    # 5. Act: Query as User 2
    mock_rag_pipeline.query.reset_mock()
    headers2 = {"Authorization": f"Bearer {token_user2}"}
    response2 = await client_with_mock_pipeline.post(
        "/v1/query",
        json={"question": "What is in Workspace B?"},
        headers=headers2,
    )
    assert response2.status_code == 200

    # Assert User 2 only passed doc_b.id to retriever
    call_args2 = mock_rag_pipeline.query.call_args[1]
    assert call_args2["filters"]["document_id"] == [str(doc_b.id)]

    # 6. Act: User 2 tries to explicitly filter by doc_a.id (unauthorized document)
    mock_rag_pipeline.query.reset_mock()
    response3 = await client_with_mock_pipeline.post(
        "/v1/query",
        json={
            "question": "Try hack doc_a",
            "filters": {"document_ids": [str(doc_a.id)]},
        },
        headers=headers2,
    )
    assert response3.status_code == 200

    # Assert intersection reduced the document filter to empty []
    call_args3 = mock_rag_pipeline.query.call_args[1]
    assert call_args3["filters"]["document_id"] == []


@pytest.mark.asyncio
async def test_workspace_isolation_documents_endpoints(
    client_with_mock_pipeline, db_session, test_tenant
):
    # Setup workspaces, users, and documents
    workspace_a = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Workspace A",
        workspace_type="TEAM",
        is_active=True,
    )
    workspace_b = Workspace(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Workspace B",
        workspace_type="TEAM",
        is_active=True,
    )
    db_session.add(workspace_a)
    db_session.add(workspace_b)

    user1 = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="u1@example.com",
        name="User One",
        role="USER",
        is_active=True,
    )
    user2 = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="u2@example.com",
        name="User Two",
        role="USER",
        is_active=True,
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.flush()

    member_a = WorkspaceMember(workspace_id=workspace_a.id, user_id=user1.id, member_role="MEMBER")
    member_b = WorkspaceMember(workspace_id=workspace_b.id, user_id=user2.id, member_role="MEMBER")
    db_session.add(member_a)
    db_session.add(member_b)
    await db_session.flush()

    doc_a = Document(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        file_name="doc_a.pdf",
        file_type="application/pdf",
        storage_path="path/a.pdf",
        status="indexed",
        created_at=datetime.now(UTC),
        
    )
    doc_b = Document(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        file_name="doc_b.pdf",
        file_type="application/pdf",
        storage_path="path/b.pdf",
        status="indexed",
        created_at=datetime.now(UTC),
        
    )
    db_session.add(doc_a)
    db_session.add(doc_b)
    await db_session.flush()

    db_session.add(DocumentAccess(document_id=doc_a.id, workspace_id=workspace_a.id, access_level="READ"))
    db_session.add(DocumentAccess(document_id=doc_b.id, workspace_id=workspace_b.id, access_level="READ"))
    await db_session.commit()

    token_user1 = create_access_token(user1.id, test_tenant.id, user1.role)
    token_user2 = create_access_token(user2.id, test_tenant.id, user2.role)

    # 1. User 1 lists documents -> should see doc_a, not doc_b
    headers1 = {"Authorization": f"Bearer {token_user1}"}
    response = await client_with_mock_pipeline.get("/v1/documents", headers=headers1)
    assert response.status_code == 200
    docs = response.json()["documents"]
    doc_ids = [d["id"] for d in docs]
    assert str(doc_a.id) in doc_ids
    assert str(doc_b.id) not in doc_ids

    # 2. User 2 gets doc_a -> should return 404
    headers2 = {"Authorization": f"Bearer {token_user2}"}
    response = await client_with_mock_pipeline.get(f"/v1/documents/{doc_a.id}", headers=headers2)
    assert response.status_code == 404

    # 3. User 2 deletes doc_a -> should return 404
    response = await client_with_mock_pipeline.delete(f"/v1/documents/{doc_a.id}", headers=headers2)
    assert response.status_code == 404
