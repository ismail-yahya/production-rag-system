import sys
import structlog


def setup_logging() -> None:
    """
    Configures structlog for JSON output.
    This should be called once at application startup.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(20),  # Default to INFO
        cache_logger_on_first_use=True,
    )


# Export a default logger for convenience
logger = structlog.get_logger()
