import json
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user, get_rag_pipeline
from src.api.repositories import QueryLogRepository
from src.api.routers.schemas import QueryRequest, QueryResponse
from src.api.services.audit_service import ACTION_QUERY, AuditService
from src.api.services.workspace_service import WorkspaceService
from src.core.database import get_session
from src.core.models import User
from src.rag.pipeline import RAGPipeline

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/v1", tags=["query"])


@router.post("/query", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    http_request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    pipeline: Annotated[RAGPipeline, Depends(get_rag_pipeline)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueryResponse:
    """
    Submit a natural language query and return the full response.
    Only queries documents the user has access to based on their workspace memberships.
    """
    workspace_service = WorkspaceService(session)
    allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
    allowed_str_ids = [str(uid) for uid in allowed_ids]

    query_filters = request.filters.model_dump(exclude_none=True) if request.filters else {}
    req_doc_ids = query_filters.get("document_ids")

    if req_doc_ids:
        req_uuids = {uuid.UUID(str(uid)) for uid in req_doc_ids}
        intersected = req_uuids & allowed_ids
        query_filters["document_id"] = [str(uid) for uid in intersected]
    else:
        query_filters["document_id"] = allowed_str_ids

    query_filters.pop("document_ids", None)

    start_time = time.perf_counter()
    result = await pipeline.query(
        question=request.question,
        tenant_id=current_user.tenant_id,
        mode=request.mode.value,
        filters=query_filters,
        search_type=request.search_type.value,
        search_config=request.search_config.model_dump(exclude_none=True)
        if request.search_config
        else None,
    )
    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # Persist query log for admin stats aggregation
    query_log_repo = QueryLogRepository(session)
    await query_log_repo.create(
        tenant_id=current_user.tenant_id,
        query_text=request.question[:500],
        latency_ms=latency_ms,
        cache_hit=result.latency_ms < 50,  # heuristic: sub-50ms responses are cache hits
    )

    # Append-only audit entry — failure is silently absorbed
    client_ip = http_request.client.host if http_request.client else None
    await AuditService.log(
        session=session,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=ACTION_QUERY,
        resource_type="query",
        metadata={"question": request.question[:100], "mode": request.mode.value},
        ip_address=client_ip,
    )

    await session.commit()

    # RAGResponse and QueryResponse are compatible
    return QueryResponse(**result.model_dump())


@router.post("/query/stream")
async def stream_query(
    request: QueryRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    pipeline: Annotated[RAGPipeline, Depends(get_rag_pipeline)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    """
    Submit a natural language query and stream answer tokens via SSE.
    Events follow the pattern: token -> sources -> done.
    Only queries documents the user has access to based on their workspace memberships.
    """
    workspace_service = WorkspaceService(session)
    allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
    allowed_str_ids = [str(uid) for uid in allowed_ids]

    query_filters = request.filters.model_dump(exclude_none=True) if request.filters else {}
    req_doc_ids = query_filters.get("document_ids")

    if req_doc_ids:
        req_uuids = {uuid.UUID(str(uid)) for uid in req_doc_ids}
        intersected = req_uuids & allowed_ids
        query_filters["document_id"] = [str(uid) for uid in intersected]
    else:
        query_filters["document_id"] = allowed_str_ids

    query_filters.pop("document_ids", None)

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in pipeline.stream_query(
            question=request.question,
            tenant_id=current_user.tenant_id,
            mode=request.mode.value,
            filters=query_filters,
            search_type=request.search_type.value,
            search_config=request.search_config.model_dump(exclude_none=True)
            if request.search_config
            else None,
        ):
            yield f"data: {json.dumps(event)}\n\n"

        # Final terminal event as per TDD
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
