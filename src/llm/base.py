from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from pydantic import BaseModel, ConfigDict


class LLMMessage(BaseModel):
    """Represents a single message in an LLM conversation."""

    model_config = ConfigDict(frozen=True)

    role: str
    content: str


class LLMResponse(BaseModel):
    """Represents the final, complete response from an LLM."""

    model_config = ConfigDict(frozen=True)

    content: str
    model: str
    usage: dict[str, int] | None = None


class BaseLLM(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        """
        Generate a complete response from the LLM.

        Args:
            messages: A list of LLMMessage objects representing the conversation history.
            **kwargs: Additional provider-specific parameters (e.g., temperature, max_tokens).

        Returns:
            An LLMResponse object containing the generated content and metadata.
        """
        pass  # pragma: no cover

    @abstractmethod
    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM token by token.

        Args:
            messages: A list of LLMMessage objects representing the conversation history.
            **kwargs: Additional provider-specific parameters.

        Yields:
            String chunks of the generated response.
        """
        pass  # pragma: no cover
