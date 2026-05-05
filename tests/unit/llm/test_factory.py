from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr

from src.core.config import Settings
from src.llm.anthropic_llm import AnthropicLLM
from src.llm.base import BaseLLM
from src.llm.factory import LLMFactory, LLMProvider
from src.llm.gemini_llm import GeminiLLM
from src.llm.ollama_llm import OllamaLLM
from src.llm.openai_llm import OpenAILLM


@pytest.fixture
def mock_settings() -> Settings:
    settings = MagicMock(spec=Settings)
    settings.OPENAI_API_KEY = SecretStr("sk-test-openai")
    settings.ANTHROPIC_API_KEY = SecretStr("sk-test-anthropic")
    settings.GOOGLE_API_KEY = SecretStr("sk-test-google")
    return settings


def test_factory_create_openai(mock_settings: Settings) -> None:
    llm = LLMFactory.create(LLMProvider.OPENAI, mock_settings)
    assert isinstance(llm, BaseLLM)
    assert isinstance(llm, OpenAILLM)


def test_factory_create_anthropic(mock_settings: Settings) -> None:
    llm = LLMFactory.create(LLMProvider.ANTHROPIC, mock_settings)
    assert isinstance(llm, BaseLLM)
    assert isinstance(llm, AnthropicLLM)


def test_factory_create_ollama(mock_settings: Settings) -> None:
    llm = LLMFactory.create(LLMProvider.OLLAMA, mock_settings)
    assert isinstance(llm, BaseLLM)
    assert isinstance(llm, OllamaLLM)


def test_factory_create_gemini(mock_settings: Settings) -> None:
    llm = LLMFactory.create(LLMProvider.GEMINI, mock_settings)
    assert isinstance(llm, BaseLLM)
    assert isinstance(llm, GeminiLLM)


def test_factory_create_with_string_provider(mock_settings: Settings) -> None:
    llm = LLMFactory.create("openai", mock_settings)
    assert isinstance(llm, OpenAILLM)


def test_factory_create_unsupported_string(mock_settings: Settings) -> None:
    with pytest.raises(ValueError, match="Unsupported LLM provider: fake"):
        LLMFactory.create("fake", mock_settings)


def test_factory_create_unsupported_enum(mock_settings: Settings) -> None:
    # Simulating an enum member that isn't registered
    # Python enums don't let you easily create an invalid instance,
    # but we can pass an object that evaluates to true but isn't in registry.
    class FakeEnum:
        pass
    
    with pytest.raises(ValueError, match="Unsupported LLM provider"):
        # We need to bypass the type checking to test the runtime error
        LLMFactory.create(FakeEnum(), mock_settings)  # type: ignore
