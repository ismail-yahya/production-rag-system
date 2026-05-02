from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings powered by pydantic-settings.
    All fields are loaded from environment variables.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Core
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Infrastructure
    POSTGRES_DSN: SecretStr
    REDIS_BROKER_URL: str = "redis://localhost:6379/0"
    REDIS_BACKEND_URL: str = "redis://localhost:6379/1"
    
    # Provider Settings (Placeholders for Milestone 2)
    LLM_PROVIDER: str = "openai"
    EMBEDDING_PROVIDER: str = "openai"
    OPENAI_API_KEY: SecretStr | None = None
    ANTHROPIC_API_KEY: SecretStr | None = None
    COHERE_API_KEY: SecretStr | None = None
