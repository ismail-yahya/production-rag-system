import structlog

from src.core.logging import redact_sensitive_info, setup_logging


def test_redact_sensitive_info():
    """Verify redaction of sensitive keys."""
    event_dict = {
        "event": "login",
        "api_key": "sk-123",
        "password": "secret_pass",
        "user_email": "test@example.com"
    }
    redacted = redact_sensitive_info(None, None, event_dict)
    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["user_email"] == "test@example.com"

def test_redact_sensitive_info_substring():
    """Verify redaction of keys containing sensitive substrings."""
    event_dict = {
        "api_key_hash": "hash123",
        "user_credentials": "creds"
    }
    redacted = redact_sensitive_info(None, None, event_dict)
    assert redacted["api_key_hash"] == "[REDACTED]"
    assert redacted["user_credentials"] == "[REDACTED]"

def test_setup_logging():
    """Verify logging setup runs without error."""
    setup_logging()
    logger = structlog.get_logger()
    assert logger is not None
