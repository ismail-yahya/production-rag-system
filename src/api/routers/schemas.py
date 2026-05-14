import uuid
from datetime import datetime
from enum import Enum
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


class QueryMode(str, Enum):
    """Available query modes."""

    STANDARD = "standard"
    STRICT = "strict"


class SearchType(str, Enum):
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
