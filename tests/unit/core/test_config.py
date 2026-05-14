import os
from unittest.mock import patch

from src.core.config import Settings


def test_settings_default_values():
    """Verify default values are correctly set when env is missing."""
    with patch.dict(os.environ, {"POSTGRES_DSN": "postgresql+asyncpg://test"}):
        s = Settings(_env_file=None)
        assert s.ENVIRONMENT == "development"
        assert s.LLM_PROVIDER == "openai"
        assert s.POSTGRES_DSN.get_secret_value() == "postgresql+asyncpg://test"


def test_settings_env_override():
    """Verify environment variables override defaults."""
    env = {
        "ENVIRONMENT": "production",
        "LLM_PROVIDER": "anthropic",
        "POSTGRES_DSN": "postgresql+asyncpg://prod",
    }
    with patch.dict(os.environ, env):
        s = Settings(_env_file=None)
        assert s.ENVIRONMENT == "production"
        assert s.LLM_PROVIDER == "anthropic"
