from prometheus_client import Counter, Histogram

class MetricsCollector:
    """
    Centralized collector for Prometheus metrics.
    Exposes request latency, token usage, and retrieval counts.
    """

    # HTTP metrics
    REQUEST_COUNT = Counter(
        "rag_api_requests_total",
        "Total number of API requests",
        ["method", "endpoint", "status"]
    )

    REQUEST_LATENCY = Histogram(
        "rag_api_request_latency_seconds",
        "API request latency in seconds",
        ["endpoint"]
    )

    # RAG internal metrics
    TOKEN_USAGE = Counter(
        "rag_token_usage_total",
        "Total tokens consumed",
        ["model", "token_type"]  # token_type: prompt, completion
    )

    RETRIEVAL_COUNT = Histogram(
        "rag_retrieval_count",
        "Number of documents retrieved per query",
        buckets=[0, 1, 3, 5, 10, 20, 50]
    )

    INGESTION_COUNT = Counter(
        "rag_ingestion_jobs_total",
        "Total number of ingestion jobs",
        ["status"]  # status: started, completed, failed
    )

    @staticmethod
    def record_request(method: str, endpoint: str, status: int) -> None:
        MetricsCollector.REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()

    @staticmethod
    def record_latency(endpoint: str, latency_seconds: float) -> None:
        MetricsCollector.REQUEST_LATENCY.labels(endpoint=endpoint).observe(latency_seconds)

    @staticmethod
    def record_tokens(model: str, prompt_tokens: int, completion_tokens: int) -> None:
        MetricsCollector.TOKEN_USAGE.labels(model=model, token_type="prompt").inc(prompt_tokens)
        MetricsCollector.TOKEN_USAGE.labels(model=model, token_type="completion").inc(completion_tokens)

    @staticmethod
    def record_retrieval(count: int) -> None:
        MetricsCollector.RETRIEVAL_COUNT.observe(count)

    @staticmethod
    def record_ingestion(status: str) -> None:
        MetricsCollector.INGESTION_COUNT.labels(status=status).inc()
