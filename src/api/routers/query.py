import json
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_rag_pipeline, get_tenant
from src.api.routers.schemas import QueryRequest, QueryResponse
from src.core.models import Tenant
from src.rag.pipeline import RAGPipeline

router = APIRouter(prefix="/v1", tags=["query"])


@router.post("/query", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    tenant: Annotated[Tenant, Depends(get_tenant)],
    pipeline: Annotated[RAGPipeline, Depends(get_rag_pipeline)],
) -> QueryResponse:
    """
    Submit a natural language query and return the full response.
    """
    result = await pipeline.query(
        question=request.question,
        tenant_id=tenant.id,
        mode=request.mode.value,
        filters=request.filters.model_dump() if request.filters else None,
        search_type=request.search_type.value,
        search_config=request.search_config.model_dump(exclude_none=True) if request.search_config else None,
    )

    # RAGResponse and QueryResponse are compatible
    return QueryResponse(**result.model_dump())


@router.post("/query/stream")
async def stream_query(
    request: QueryRequest,
    tenant: Annotated[Tenant, Depends(get_tenant)],
    pipeline: Annotated[RAGPipeline, Depends(get_rag_pipeline)],
) -> StreamingResponse:
    """
    Submit a natural language query and stream answer tokens via SSE.
    Events follow the pattern: token -> sources -> done.
    """

    async def event_generator():
        async for event in pipeline.stream_query(
            question=request.question,
            tenant_id=tenant.id,
            mode=request.mode.value,
            filters=request.filters.model_dump() if request.filters else None,
            search_type=request.search_type.value,
            search_config=request.search_config.model_dump(exclude_none=True) if request.search_config else None,
        ):
            yield f"data: {json.dumps(event)}\n\n"

        # Final terminal event as per TDD
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
