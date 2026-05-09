from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID


class Source(BaseModel):
    """Represents a single source document snippet used in the answer."""

    model_config = ConfigDict(frozen=True)

    source_id: int
    document_id: UUID
    file_name: str
    section_title: str | None = None
    page_number: int | None = None
    relevance_score: float
    snippet: str


class RAGResponse(BaseModel):
    """
    The final response object returned by the RAG pipeline.
    
    This model is frozen to ensure immutability once created by the pipeline.
    """

    model_config = ConfigDict(frozen=True)

    answer: str
    sources: list[Source] = Field(default_factory=list)
    query_expansions: list[str] = Field(default_factory=list)
    retrieval_count: int
    model: str
    latency_ms: float


class QueryProcessingResult(BaseModel):
    """
    Structured output from the LLM when processing a user query.
    Contains both the classification category and expanded queries.
    """

    model_config = ConfigDict(frozen=True)

    category: str
    expanded_queries: list[str] = Field(default_factory=list)
