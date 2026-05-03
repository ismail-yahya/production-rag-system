from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings powered by pydantic-settings.
    All fields are loaded from environment variables.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # Core
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # External Provider API Keys
    OPENAI_API_KEY: SecretStr | None = None
    ANTHROPIC_API_KEY: SecretStr | None = None
    COHERE_API_KEY: SecretStr | None = None
    LANGSMITH_API_KEY: SecretStr | None = None
    GOOGLE_API_KEY: SecretStr | None = None

    # Vector Store (Qdrant)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION_NAME: str = "rag_chunks"

    # Redis (Celery Broker & Cache)
    REDIS_BROKER_URL: str = "redis://localhost:6379/0"
    REDIS_BACKEND_URL: str = "redis://localhost:6379/1"

    # PostgreSQL
    POSTGRES_DSN: SecretStr

    # Object Storage (MinIO)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: SecretStr | None = None
    MINIO_SECRET_KEY: SecretStr | None = None
    MINIO_BUCKET_NAME: str = "documents"
    MINIO_USE_SSL: bool = False

    # Provider Selection
    LLM_PROVIDER: str = "openai"
    EMBEDDING_PROVIDER: str = "openai"

    # Embedding Configuration
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    OPENAI_EMBEDDING_BATCH_SIZE: int = 100
    LOCAL_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"

    # Retrieval Configuration
    RETRIEVAL_TOP_K: int = 10
    RETRIEVAL_VECTOR_WEIGHT: float = 0.7
    RETRIEVAL_KEYWORD_WEIGHT: float = 0.3
    RETRIEVAL_FINAL_TOP_K: int = 5
    COHERE_RERANK_MODEL: str = "rerank-multilingual-v3.0"

    # Ingestion Configuration
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200


settings = Settings()
