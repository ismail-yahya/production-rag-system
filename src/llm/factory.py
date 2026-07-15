from enum import StrEnum

from src.core import Settings
from src.llm.anthropic_llm import AnthropicLLM
from src.llm.base import BaseLLM
from src.llm.gemini_llm import GeminiLLM
from src.llm.ollama_llm import OllamaLLM
from src.llm.openai_llm import OpenAILLM


class LLMProvider(StrEnum):
    """Supported LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    GEMINI = "gemini"


class LLMFactory:
    """
    Factory for creating LLM provider instances.
    Follows the registry pattern to allow easy extension.
    """

    _registry: dict[LLMProvider, type[BaseLLM]] = {
        LLMProvider.OPENAI: OpenAILLM,
        LLMProvider.ANTHROPIC: AnthropicLLM,
        LLMProvider.OLLAMA: OllamaLLM,
        LLMProvider.GEMINI: GeminiLLM,
    }

    @classmethod
    def create(
        cls,
        provider: str | LLMProvider,
        settings: Settings,
        model_name: str | None = None,
        temperature: float | None = None,
    ) -> BaseLLM:
        """
        Create a concrete LLM provider instance based on the provider type.

        Args:
            provider: The provider identifier (string or LLMProvider enum).
            settings: Application settings containing API keys and other configurations.
            model_name: Optional custom model name to override provider defaults.
            temperature: Optional custom temperature.

        Returns:
            An instance of a class that implements the BaseLLM interface.

        Raises:
            ValueError: If the provider is not supported.
        """
        # Ensure we have a LLMProvider enum member
        if isinstance(provider, str):
            try:
                provider_enum = LLMProvider(provider.lower())
            except ValueError as e:
                raise ValueError(f"Unsupported LLM provider: {provider}") from e
        else:
            provider_enum = provider

        provider_cls = cls._registry.get(provider_enum)
        if not provider_cls:
            raise ValueError(f"Unsupported LLM provider: {provider_enum}")

        # Instantiate based on the provider's specific needs
        # This keeps the individual provider constructors clean
        if provider_enum == LLMProvider.OPENAI:
            kwargs = {}
            if model_name:
                kwargs["default_model"] = model_name
            if temperature is not None:
                kwargs["default_temperature"] = temperature
            return OpenAILLM(api_key=settings.OPENAI_API_KEY, **kwargs)

        if provider_enum == LLMProvider.ANTHROPIC:
            return AnthropicLLM(api_key=settings.ANTHROPIC_API_KEY)

        if provider_enum == LLMProvider.OLLAMA:
            # Ollama usually uses a base URL, can be extended to take it from Settings
            return OllamaLLM()

        if provider_enum == LLMProvider.GEMINI:
            kwargs = {}
            if model_name:
                kwargs["model_name"] = model_name
                kwargs["streaming_model_name"] = model_name
            if temperature is not None:
                kwargs["default_temperature"] = temperature
            return GeminiLLM(
                api_key=settings.GOOGLE_API_KEY,
                **kwargs
            )

        raise ValueError(f"Unsupported LLM provider: {provider_enum}")  # pragma: no cover
