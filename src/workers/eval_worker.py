import asyncio
import json
from typing import Any

import structlog

from src.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="src.workers.eval_worker.run_ragas_eval")  # type: ignore[untyped-decorator]
def run_ragas_eval() -> dict[str, Any]:
    """
    Celery task to run RAGAS evaluation in the background.
    """
    logger.info("eval_task_started")
    try:
        # Deferred import to avoid loading heavy langchain/openai deps at worker startup
        from scripts.evaluate import run_evaluation  # noqa: PLC0415

        # Run the modular evaluation logic
        # Defaulting to the baseline dataset for now
        scores = asyncio.run(run_evaluation("tests/eval_dataset.json"))

        # Store results in Redis for the API to retrieve
        from datetime import UTC, datetime

        import redis

        from src.core.config import settings

        r = redis.from_url(settings.REDIS_BACKEND_URL)  # type: ignore[no-untyped-call]
        results = {
            "results": [
                {"metric_name": k, "score": float(v), "description": "RAGAS automated metric"}
                for k, v in (scores or {}).items()
            ],
            "evaluated_at": datetime.now(UTC).isoformat(),
        }
        r.set("latest_eval_results", json.dumps(results))

        logger.info("eval_task_completed", scores=scores)
        return {"status": "success", "scores": scores}

    except Exception as e:
        logger.error("eval_task_failed", error=str(e))
        return {"status": "failed", "error": str(e)}
