import os

from langsmith import traceable as ls_traceable

from src.core.config import settings

# Configure LangSmith environment variables from our Settings
# This ensures that any component using @traceable is correctly instrumented.
if settings.LANGSMITH_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY.get_secret_value()
    os.environ["LANGCHAIN_PROJECT"] = getattr(
        settings, "LANGCHAIN_PROJECT", "production-rag-system"
    )
else:
    # Disable tracing if no API key is provided
    os.environ["LANGCHAIN_TRACING_V2"] = "false"

# Re-export the LangSmith traceable decorator
traceable = ls_traceable
