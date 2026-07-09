import contextlib
import os
import tempfile
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user, get_semantic_cache
from src.api.repositories import DocumentRepository, IngestionJobRepository
from src.api.routers.schemas import DocumentListResponse, DocumentResponse, IngestResponse
from src.api.services.audit_service import ACTION_DELETE, ACTION_UPLOAD, AuditService
from src.api.services.workspace_service import WorkspaceService
from src.core.cache import SemanticCache
from src.core.database import get_session
from src.core.file_validator import validate_file
from src.core.models import User
from src.core.storage import storage_service
from src.workers.ingestion_worker import ingest_document

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1", tags=["ingestion"])


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: Annotated[UploadFile, File()],
    http_request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    cache: SemanticCache | None = Depends(get_semantic_cache),
    workspace_id: uuid.UUID | None = None,
) -> IngestResponse:
    """
    Upload a document for asynchronous ingestion.
    Persists the file to object storage, grants access to the specified/personal workspace,
    and enqueues a background task.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")

    workspace_service = WorkspaceService(session)
    if workspace_id:
        # Verify workspace exists and user has write access to it
        await workspace_service.get_workspace(workspace_id, current_user)
        if not await workspace_service.has_write_access(workspace_id, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have write access to this workspace.",
            )
    else:
        # Get or create personal workspace
        workspace = await workspace_service.get_or_create_personal_workspace(current_user)
        workspace_id = workspace.id

    doc_id = uuid.uuid4()

    content = await file.read()

    # Validate the file: size, extension, MIME type, and magic bytes.
    # validate_file() raises IngestionError on failure → maps to HTTP 422.
    validated_mime = validate_file(content, file.filename, file.content_type)

    import hashlib

    content_hash = hashlib.sha256(content).hexdigest()

    ext = os.path.splitext(file.filename)[1].lower()
    storage_path = f"{current_user.tenant_id}/{doc_id}{ext}"

    # Use a temporary directory that works across platforms
    temp_dir = os.path.join(tempfile.gettempdir(), "rag_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{doc_id}{ext}")

    # Create database records
    doc_repo = DocumentRepository(session)
    job_repo = IngestionJobRepository(session)

    # Check for duplicates
    existing_doc = await doc_repo.get_by_hash(content_hash, current_user.tenant_id)
    if existing_doc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"File already exists (ID: {existing_doc.id})",
        )

    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        # Upload to MinIO/S3 (async — uses asyncio.to_thread internally)
        await storage_service.upload_file(temp_path, storage_path)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to storage: {str(e)}",
        ) from e

    await doc_repo.create(
        id=doc_id,
        tenant_id=current_user.tenant_id,
        file_name=file.filename,
        file_type=validated_mime,  # Use the validated MIME type, not the client-claimed one
        file_size_bytes=len(content),
        storage_path=storage_path,
        status="pending",
        content_hash=content_hash,
    )

    # Grant access to workspace
    await workspace_service.doc_access_repo.grant_access(
        document_id=doc_id,
        workspace_id=workspace_id,
        access_level="WRITE",
    )

    await job_repo.create(
        document_id=doc_id,
        status="pending",
    )

    await session.commit()

    # Dispatch background task
    # We pass the storage path. The worker will be responsible for downloading it.
    ingest_document.delay(
        file_path=storage_path,
        tenant_id=str(current_user.tenant_id),
        document_id=str(doc_id),
    )

    # Clean up local temp file after upload
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # Invalidate semantic cache so stale responses are not served after new content
    if cache:
        await cache.invalidate_tenant(current_user.tenant_id)

    # Append-only audit entry — failure is silently absorbed
    client_ip = http_request.client.host if http_request.client else None
    await AuditService.log(
        session=session,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=ACTION_UPLOAD,
        resource_type="document",
        resource_id=str(doc_id),
        metadata={"file_name": file.filename, "workspace_id": str(workspace_id)},
        ip_address=client_ip,
    )

    await session.commit()

    return IngestResponse(
        document_id=doc_id,
        status="pending",
        message="Document accepted for processing",
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentListResponse:
    """List all documents for the authenticated user's tenant."""
    workspace_service = WorkspaceService(session)
    allowed_ids = await workspace_service.get_accessible_document_ids(current_user)

    doc_repo = DocumentRepository(session)
    documents = await doc_repo.list_by_ids(list(allowed_ids), current_user.tenant_id)
    return DocumentListResponse(documents=[DocumentResponse.model_validate(d) for d in documents])


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentResponse:
    """Retrieve metadata and status for a specific document."""
    workspace_service = WorkspaceService(session)
    allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
    if document_id not in allowed_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc_repo = DocumentRepository(session)
    document = await doc_repo.get_by_id(document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentResponse.model_validate(document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    http_request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    cache: SemanticCache | None = Depends(get_semantic_cache),
) -> None:
    """Remove a document from the database, Qdrant, and object storage."""
    workspace_service = WorkspaceService(session)
    allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
    if document_id not in allowed_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc_repo = DocumentRepository(session)
    document = await doc_repo.get_by_id(document_id, current_user.tenant_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Check if user has write access to at least one workspace containing this document
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        access_records = await workspace_service.doc_access_repo.list_by_document(document_id)
        has_access = False
        for record in access_records:
            if await workspace_service.has_write_access(record.workspace_id, current_user):
                has_access = True
                break
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have write access to this document.",
            )

    # Delete from storage (async — uses asyncio.to_thread internally)
    with contextlib.suppress(Exception):
        await storage_service.delete_file(document.storage_path)

    # Delete from Qdrant Vector Store
    from src.core.config import settings
    from src.vectorstore.factory import VectorStoreFactory

    try:
        vector_store = VectorStoreFactory.create(settings.VECTOR_STORE_PROVIDER, settings)
        await vector_store.delete(
            filters={"document_id": str(document_id), "tenant_id": str(current_user.tenant_id)}
        )
    except Exception as e:
        logger.warning("failed_to_delete_from_qdrant", document_id=str(document_id), error=str(e))

    await doc_repo.delete(document_id, current_user.tenant_id)

    # Invalidate semantic cache so stale responses referencing deleted content are removed
    if cache:
        await cache.invalidate_tenant(current_user.tenant_id)

    # Append-only audit entry — failure is silently absorbed
    client_ip = http_request.client.host if http_request.client else None
    await AuditService.log(
        session=session,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=ACTION_DELETE,
        resource_type="document",
        resource_id=str(document_id),
        ip_address=client_ip,
    )

    await session.commit()
