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
    LANGCHAIN_PROJECT: str = "production-rag-system"
    GOOGLE_API_KEY: SecretStr | None = None
    # The programmer chose this model; do not change it unless explicitly requested.
    GEMINI_MODEL: str = "gemini-3-flash-preview"
    GEMINI_STREAMING_MODEL: str = "gemini-3-flash-preview"

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
    VECTOR_STORE_PROVIDER: str = "qdrant"

    # Embedding Configuration
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    OPENAI_EMBEDDING_BATCH_SIZE: int = 100
    COHERE_EMBEDDING_MODEL: str = "embed-multilingual-v3.0"
    LOCAL_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_DIMENSION: int = 1024  # Default for Cohere embed-multilingual-v3.0

    # Retrieval Configuration
    RETRIEVAL_TOP_K: int = 10
    RETRIEVAL_VECTOR_WEIGHT: float = 0.7
    RETRIEVAL_KEYWORD_WEIGHT: float = 0.3
    RETRIEVAL_FINAL_TOP_K: int = 5
    RETRIEVAL_SIMILARITY_THRESHOLD: float = 0.0
    RETRIEVAL_SEARCH_TYPE: str = "hybrid"
    COHERE_RERANK_MODEL: str = "rerank-multilingual-v3.0"
    RAG_CONTEXT_MAX_TOKENS: int = 6000

    # Ingestion Configuration
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200


settings = Settings()  # type: ignore[call-arg]
