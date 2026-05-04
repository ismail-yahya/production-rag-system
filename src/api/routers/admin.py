import uuid
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
from src.core.models import Tenant

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
    Stub implementation for now.
    """
    # TODO(#44): Integrate with src/evaluation/ragas_evaluator.py
    return EvalRunResponse(
        job_id=uuid.uuid4(),
        status="pending",
        message="Evaluation run triggered successfully",
    )


@router.get("/eval/results", response_model=EvalResultsResponse)
async def get_evaluation_results(
    admin: Annotated[Tenant, Depends(get_admin)],
) -> EvalResultsResponse:
    """
    Retrieve the latest evaluation scores.
    Stub implementation for now.
    """
    # TODO(#45): Retrieve real results from DB/Logs
    return EvalResultsResponse(
        dataset_id=None,
        results=[
            EvalResult(metric_name="faithfulness", score=0.0, description="Stub score"),
            EvalResult(metric_name="answer_relevancy", score=0.0, description="Stub score"),
        ],
        evaluated_at=datetime.now(UTC),
    )
