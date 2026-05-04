import json
import uuid
import redis
from datetime import datetime, UTC
from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.api.dependencies import get_admin
from src.api.routers.schemas import (
    AdminStatsResponse,
    EvalResult,
    EvalResultsResponse,
    EvalRunResponse,
)
from src.core.config import settings
from src.core.models import Tenant
from src.workers.eval_worker import run_ragas_eval

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_system_stats(
    admin: Annotated[Tenant, Depends(get_admin)],
) -> AdminStatsResponse:
    """
    Retrieve aggregate system metrics for ingestion and retrieval.
    Stub implementation for now.
    """
    # TODO(#43): Implement real stats aggregation from DB
    return AdminStatsResponse(
        total_documents=0,
        total_chunks=0,
        total_queries=0,
        average_latency_ms=0.0,
    )


@router.post("/eval/run", response_model=EvalRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_evaluation(
    admin: Annotated[Tenant, Depends(get_admin)],
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
    admin: Annotated[Tenant, Depends(get_admin)],
) -> EvalResultsResponse:
    """
    Retrieve the latest evaluation scores.
    """
    r = redis.from_url(settings.REDIS_BACKEND_URL, decode_responses=True)
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
