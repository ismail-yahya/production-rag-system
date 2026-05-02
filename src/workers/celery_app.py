from celery import Celery

from src.core.config import settings

celery_app = Celery(
    "production_rag_system",
    broker=settings.REDIS_BROKER_URL,
    backend=settings.REDIS_BACKEND_URL,
    include=["src.workers.ingestion_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max for ingestion jobs
    worker_prefetch_multiplier=1,  # Ensure fair distribution of heavy ingestion tasks
)
