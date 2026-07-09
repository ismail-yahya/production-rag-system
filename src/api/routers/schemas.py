import uuid
from datetime import datetime
from enum import StrEnum
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


class QueryMode(StrEnum):
    """Available query modes."""

    STANDARD = "standard"
    STRICT = "strict"


class SearchType(StrEnum):
    """Available search types."""

    LITERAL = "literal"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


class SearchConfig(BaseModel):
    """Advanced search configuration for fine-tuning retrieval."""

    vector_weight: float | None = None
    keyword_weight: float | None = None
    similarity_threshold: float | None = None
    top_k: int | None = None


class QueryFilters(BaseModel):
    """Optional filters for a query."""

    document_ids: list[uuid.UUID] | None = None
    tags: list[str] | None = None


class QueryRequest(BaseModel):
    """Request schema for the query endpoint."""

    question: str = Field(..., min_length=1, max_length=1000)
    filters: QueryFilters | None = None
    mode: QueryMode = QueryMode.STANDARD
    search_type: SearchType = SearchType.HYBRID
    search_config: SearchConfig | None = None


class QuerySource(BaseModel):
    """Represents a single source document snippet in the query response."""

    source_id: int
    document_id: uuid.UUID
    file_name: str
    section_title: str | None = None
    page_number: int | None = None
    relevance_score: float
    snippet: str


class QueryResponse(BaseModel):
    """Response schema for the query endpoint."""

    answer: str
    sources: list[QuerySource] = Field(default_factory=list)
    query_expansions: list[str] = Field(default_factory=list)
    retrieval_count: int
    model: str
    latency_ms: float


class AdminStatsResponse(BaseModel):
    """Response schema for aggregate system statistics."""

    total_documents: int
    total_chunks: int
    total_queries: int
    average_latency_ms: float


class EvalRunResponse(BaseModel):
    """Response schema for triggering an evaluation run."""

    job_id: uuid.UUID
    status: str
    message: str


class EvalResult(BaseModel):
    """Schema for a single evaluation metric result."""

    metric_name: str
    score: float
    description: str | None = None


class EvalResultsResponse(BaseModel):
    """Response schema for evaluation results."""

    dataset_id: uuid.UUID | None = None
    results: list[EvalResult]
    evaluated_at: datetime


class WorkspaceType(StrEnum):
    """Supported workspace types."""

    CENTRAL = "CENTRAL"
    TEAM = "TEAM"
    PERSONAL = "PERSONAL"


class WorkspaceMemberRole(StrEnum):
    """Supported roles for workspace membership."""

    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class WorkspaceCreate(BaseModel):
    """Request schema for workspace creation."""

    name: str = Field(..., min_length=1, max_length=255)
    workspace_type: WorkspaceType = WorkspaceType.TEAM
    description: str | None = Field(None, max_length=1000)


class WorkspaceResponse(BaseModel):
    """Response schema for workspace metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    workspace_type: str
    description: str | None = None
    created_by: uuid.UUID | None = None
    is_active: bool
    created_at: datetime


class WorkspaceMemberAdd(BaseModel):
    """Request schema for adding a member to a workspace."""

    user_id: uuid.UUID
    member_role: WorkspaceMemberRole = WorkspaceMemberRole.MEMBER


class WorkspaceMemberResponse(BaseModel):
    """Response schema for workspace membership."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    member_role: str
    joined_at: datetime


class DocumentAccessResponse(BaseModel):
    """Response schema for document access tracking."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    workspace_id: uuid.UUID
    access_level: str
    granted_at: datetime


class AuditLogResponse(BaseModel):
    """Response schema for system audit logs."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    metadata: dict[str, Any] | None = Field(None, alias="metadata_json")
    ip_address: str | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """Paginated response schema for audit log listings."""

    logs: list[AuditLogResponse]
    total: int
    limit: int
    offset: int

