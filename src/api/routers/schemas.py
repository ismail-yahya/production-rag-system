import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IngestResponse(BaseModel):
    """Response schema for the ingestion endpoint."""
    document_id: uuid.UUID
    status: str
    message: str


class DocumentResponse(BaseModel):
    """Response schema for document metadata."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    file_name: str
    file_type: str
    file_size_bytes: int | None = None
    status: str
    chunk_count: int | None = None
    created_at: datetime
    indexed_at: datetime | None = None
    metadata: dict[str, Any] | None = Field(None, alias="metadata_json")


class DocumentListResponse(BaseModel):
    """Response schema for a list of documents."""
    documents: list[DocumentResponse]
