from collections.abc import AsyncGenerator
from typing import Any

import openai
from openai import AsyncOpenAI
from pydantic import SecretStr

from src.core import LLMError
from src.llm.base import BaseLLM, LLMMessage, LLMResponse


class OpenAILLM(BaseLLM):
    """OpenAI implementation of the BaseLLM interface."""

    def __init__(self, api_key: SecretStr | None) -> None:
        """
        Initialize the OpenAI LLM provider.

        Args:
            api_key: The OpenAI API key as a SecretStr.
        """
        if api_key is None:
            raise LLMError("OpenAI API key is required but was not provided.")

        try:
            self._client = AsyncOpenAI(api_key=api_key.get_secret_value())
        except Exception as e:
            raise LLMError(f"Failed to initialize OpenAI client: {e}") from e

    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        """Generate a complete response using the OpenAI API."""
        try:
            formatted_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

            # Default model if not specified
            model = kwargs.pop("model", "gpt-4o")

            response = await self._client.chat.completions.create(
                model=model,
                messages=formatted_messages,  # type: ignore[arg-type]
                **kwargs,
            )

            content = response.choices[0].message.content or ""
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            return LLMResponse(content=content, model=response.model, usage=usage)
        except openai.OpenAIError as e:
            raise LLMError(f"OpenAI API error during generate: {e}") from e
        except Exception as e:
            raise LLMError(f"Unexpected error during generate: {e}") from e

    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        """Stream a response from the OpenAI API token by token."""
        try:
            formatted_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

            model = kwargs.pop("model", "gpt-4o")

            stream_response = await self._client.chat.completions.create(
                model=model,
                messages=formatted_messages,  # type: ignore[arg-type]
                stream=True,
                **kwargs,
            )

            async for chunk in stream_response:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        except openai.OpenAIError as e:
            raise LLMError(f"OpenAI API error during stream: {e}") from e
        except Exception as e:
            raise LLMError(f"Unexpected error during stream: {e}") from e
