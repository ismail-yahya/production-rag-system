from collections.abc import MutableMapping
from typing import Any

import structlog


def redact_sensitive_info(
    logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Redacts sensitive keys from the event dictionary to prevent PII leakage."""
    sensitive_keys = {"api_key", "password", "token", "secret", "credentials", "api_key_hash"}
    for key in list(event_dict.keys()):
        if any(sk in key.lower() for sk in sensitive_keys):
            event_dict[key] = "[REDACTED]"
    return event_dict


def setup_logging() -> None:
    """
    Configures structlog for JSON output with security redactions.
    This should be called once at application startup.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_sensitive_info,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(20),  # Default to INFO
        cache_logger_on_first_use=True,
    )


# Export a default logger for convenience
logger = structlog.get_logger()
