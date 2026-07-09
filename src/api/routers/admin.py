import json
import uuid
from datetime import UTC, datetime
from typing import Annotated

import redis
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user, require_role
from src.api.repositories import AdminRepository, AuditLogRepository
from src.api.routers.schemas import (
    AdminStatsResponse,
    AuditLogListResponse,
    AuditLogResponse,
    EvalResultsResponse,
    EvalRunResponse,
)
from src.core.config import settings
from src.core.database import get_session
from src.core.models import User
from src.workers.eval_worker import run_ragas_eval

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_system_stats(
    admin: Annotated[User, Depends(require_role("ADMIN"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AdminStatsResponse:
    """
    Retrieve aggregate system metrics for ingestion and retrieval.
    Executes four parallel DB queries to return real-time counts.
    """
    repo = AdminRepository(session)
    stats = await repo.get_stats(admin.tenant_id)
    return AdminStatsResponse(
        total_documents=stats.total_documents,
        total_chunks=stats.total_chunks,
        total_queries=stats.total_queries,
        average_latency_ms=stats.average_latency_ms,
    )


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    admin: Annotated[User, Depends(require_role("ADMIN"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
) -> AuditLogListResponse:
    """
    Retrieve paginated audit logs for the tenant.

    Optional filters:
    - **action**: Filter by action type (e.g. QUERY, UPLOAD, DELETE)
    - **user_id**: Filter by user ID
    """
    repo = AuditLogRepository(session)
    logs = await repo.list_by_tenant(
        tenant_id=admin.tenant_id,
        limit=limit,
        offset=offset,
        action=action,
        user_id=user_id,
    )
    # Use a count query for total — for now use len of max page (acceptable for audit logs)
    all_logs = await repo.list_by_tenant(
        tenant_id=admin.tenant_id,
        limit=10_000,
        offset=0,
        action=action,
        user_id=user_id,
    )
    return AuditLogListResponse(
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        total=len(all_logs),
        limit=limit,
        offset=offset,
    )


@router.post("/eval/run", response_model=EvalRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_evaluation(
    admin: Annotated[User, Depends(require_role("ADMIN"))],
) -> EvalRunResponse:
    """
    Trigger an evaluation run against the committed dataset.
    """
    task = run_ragas_eval.delay()

    return EvalRunResponse(
        job_id=uuid.UUID(task.id),
        status="pending",
        message="Evaluation run triggered successfully",
    )


@router.get("/eval/results", response_model=EvalResultsResponse)
async def get_evaluation_results(
    admin: Annotated[User, Depends(require_role("ADMIN"))],
) -> EvalResultsResponse:
    """
    Retrieve the latest evaluation scores.
    """
    r = redis.from_url(settings.REDIS_BACKEND_URL, decode_responses=True)  # type: ignore[no-untyped-call]
    cached_results = r.get("latest_eval_results")

    if cached_results:
        data = json.loads(cached_results)
        return EvalResultsResponse(**data)

    # Return empty results if nothing is cached yet
    return EvalResultsResponse(
        dataset_id=None,
        results=[],
        evaluated_at=datetime.now(UTC),
    )
