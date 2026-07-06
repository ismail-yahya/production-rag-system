import os

from langsmith import traceable as ls_traceable

from src.core.config import settings

# Configure LangSmith environment variables from our Settings
# This ensures that any component using @traceable is correctly instrumented.
if settings.LANGSMITH_API_KEY:
    # Set the tracing flag (support both LANGCHAIN and LANGSMITH styles)
    is_tracing = "true"
    if settings.LANGSMITH_TRACING is not None:
        is_tracing = settings.LANGSMITH_TRACING.lower()

    os.environ["LANGCHAIN_TRACING_V2"] = is_tracing
    os.environ["LANGSMITH_TRACING"] = is_tracing

    # Set API Key
    api_key = settings.LANGSMITH_API_KEY.get_secret_value()
    os.environ["LANGCHAIN_API_KEY"] = api_key
    os.environ["LANGSMITH_API_KEY"] = api_key

    # Set Project Name
    project_name = settings.LANGSMITH_PROJECT or settings.LANGCHAIN_PROJECT
    os.environ["LANGCHAIN_PROJECT"] = project_name
    os.environ["LANGSMITH_PROJECT"] = project_name

    # Set Endpoint if provided
    if settings.LANGSMITH_ENDPOINT:
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
        os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
else:
    # Disable tracing if no API key is provided
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    os.environ["LANGSMITH_TRACING"] = "false"

# Re-export the LangSmith traceable decorator
traceable = ls_traceable
