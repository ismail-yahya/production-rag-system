import contextlib
import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_tenant
from src.api.repositories import DocumentRepository, IngestionJobRepository
from src.api.routers.schemas import DocumentListResponse, DocumentResponse, IngestResponse
from src.core.database import get_session
from src.core.models import Tenant
from src.core.storage import storage_service
from src.workers.ingestion_worker import ingest_document

router = APIRouter(prefix="/v1", tags=["ingestion"])


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: Annotated[UploadFile, File()],
    tenant: Annotated[Tenant, Depends(get_tenant)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IngestResponse:
    """
    Upload a document for asynchronous ingestion.
    Persists the file to object storage and enqueues a background task.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")

    doc_id = uuid.uuid4()
    ext = os.path.splitext(file.filename)[1]
    storage_path = f"{tenant.id}/{doc_id}{ext}"

    # Use a temporary directory that works across platforms for local dev
    # but primarily targets the /tmp volume in Docker.
    temp_dir = "/tmp/rag_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{doc_id}{ext}")

    content = await file.read()
    import hashlib
    content_hash = hashlib.sha256(content).hexdigest()

    # Create database records
    doc_repo = DocumentRepository(session)
    job_repo = IngestionJobRepository(session)

    # Check for duplicates
    existing_doc = await doc_repo.get_by_hash(content_hash, tenant.id)
    if existing_doc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"File already exists (ID: {existing_doc.id})",
        )

    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        # Upload to MinIO/S3
        storage_service.upload_file(temp_path, storage_path)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to storage: {str(e)}",
        ) from e

    await doc_repo.create(
        id=doc_id,
        tenant_id=tenant.id,
        file_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(content),
        storage_path=storage_path,
        status="pending",
        content_hash=content_hash,
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
        tenant_id=str(tenant.id),
        document_id=str(doc_id),
    )

    # Clean up local temp file after upload
    if os.path.exists(temp_path):
        os.remove(temp_path)

    return IngestResponse(
        document_id=doc_id,
        status="pending",
        message="Document accepted for processing",
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    tenant: Annotated[Tenant, Depends(get_tenant)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentListResponse:
    """List all documents for the authenticated tenant."""
    doc_repo = DocumentRepository(session)
    documents = await doc_repo.list_by_tenant(tenant.id)
    return DocumentListResponse(documents=[DocumentResponse.model_validate(d) for d in documents])


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    tenant: Annotated[Tenant, Depends(get_tenant)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DocumentResponse:
    """Retrieve metadata and status for a specific document."""
    doc_repo = DocumentRepository(session)
    document = await doc_repo.get_by_id(document_id, tenant.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentResponse.model_validate(document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    tenant: Annotated[Tenant, Depends(get_tenant)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Remove a document from the database and object storage."""
    doc_repo = DocumentRepository(session)
    document = await doc_repo.get_by_id(document_id, tenant.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete from storage
    with contextlib.suppress(Exception):
        storage_service.delete_file(document.storage_path)

    await doc_repo.delete(document_id, tenant.id)
    await session.commit()
