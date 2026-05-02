from collections.abc import AsyncGenerator
from typing import Any

import anthropic
from anthropic import AsyncAnthropic
from pydantic import SecretStr

from src.core.exceptions import LLMError
from src.llm.base import BaseLLM, LLMMessage, LLMResponse


class AnthropicLLM(BaseLLM):
    """Anthropic implementation of the BaseLLM interface."""

    def __init__(self, api_key: SecretStr | None) -> None:
        """
        Initialize the Anthropic LLM provider.
        
        Args:
            api_key: The Anthropic API key as a SecretStr.
        """
        if api_key is None:
            raise LLMError("Anthropic API key is required but was not provided.")
            
        try:
            self._client = AsyncAnthropic(api_key=api_key.get_secret_value())
        except Exception as e:
            raise LLMError(f"Failed to initialize Anthropic client: {e}")

    def _prepare_kwargs(self, messages: list[LLMMessage], kwargs: dict[str, Any]) -> dict[str, Any]:
        """Extract the system message and prepare kwargs for the Anthropic API."""
        prepared = kwargs.copy()
        
        # Default model and max_tokens if not specified
        if "model" not in prepared:
            prepared["model"] = "claude-3-haiku-20240307"
        if "max_tokens" not in prepared:
            prepared["max_tokens"] = 1024
            
        system_prompt = ""
        anthropic_messages = []
        
        for msg in messages:
            if msg.role == "system":
                # Anthropic API takes the system prompt separately
                if system_prompt:
                    system_prompt += "\n\n"
                system_prompt += msg.content
            else:
                anthropic_messages.append({"role": msg.role, "content": msg.content})
                
        if system_prompt:
            prepared["system"] = system_prompt
            
        prepared["messages"] = anthropic_messages
        return prepared

    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        """Generate a complete response using the Anthropic API."""
        try:
            api_kwargs = self._prepare_kwargs(messages, kwargs)
            
            response = await self._client.messages.create(**api_kwargs)
            
            # Anthropic response.content is a list of blocks, usually one text block
            content = "".join(block.text for block in response.content if block.type == "text")
            
            usage = None
            if hasattr(response, "usage") and response.usage:
                usage = {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
                }
                
            return LLMResponse(
                content=content,
                model=response.model,
                usage=usage
            )
        except anthropic.AnthropicError as e:
            raise LLMError(f"Anthropic API error during generate: {e}")
        except Exception as e:
            raise LLMError(f"Unexpected error during generate: {e}")

    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        """Stream a response from the Anthropic API token by token."""
        try:
            api_kwargs = self._prepare_kwargs(messages, kwargs)
            
            async with self._client.messages.stream(**api_kwargs) as stream:
                async for text in stream.text_stream:
                    yield text
                    
        except anthropic.AnthropicError as e:
            raise LLMError(f"Anthropic API error during stream: {e}")
        except Exception as e:
            raise LLMError(f"Unexpected error during stream: {e}")
