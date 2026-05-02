from collections.abc import AsyncGenerator
from typing import Any

import ollama
from ollama import AsyncClient
from pydantic import SecretStr

from src.core import LLMError
from src.llm.base import BaseLLM, LLMMessage, LLMResponse


class OllamaLLM(BaseLLM):
    """Ollama implementation of the BaseLLM interface."""

    def __init__(self, api_key: SecretStr | None = None, base_url: str | None = None) -> None:
        """
        Initialize the Ollama LLM provider.
        
        Args:
            api_key: Not typically used for Ollama, but accepted for interface consistency.
            base_url: The Ollama server URL. Defaults to 'http://localhost:11434'.
        """
        try:
            host = base_url or "http://localhost:11434"
            self._client = AsyncClient(host=host)
        except Exception as e:
            raise LLMError(f"Failed to initialize Ollama client: {e}")

    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        """Generate a complete response using the Ollama API."""
        try:
            formatted_messages = [
                {"role": msg.role, "content": msg.content} for msg in messages
            ]
            
            # Default model if not specified
            model = kwargs.pop("model", "llama3")
            
            response = await self._client.chat(
                model=model,
                messages=formatted_messages,
                stream=False,
                **kwargs
            )
            
            content = response.get("message", {}).get("content", "")
            
            # Extract token usage metadata from Ollama response
            usage = None
            if "prompt_eval_count" in response or "eval_count" in response:
                prompt_tokens = response.get("prompt_eval_count", 0)
                completion_tokens = response.get("eval_count", 0)
                usage = {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                }
                
            return LLMResponse(
                content=content,
                model=response.get("model", model),
                usage=usage
            )
        except ollama.ResponseError as e:
            raise LLMError(f"Ollama API error during generate: {e}")
        except Exception as e:
            raise LLMError(f"Unexpected error during generate: {e}")

    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        """Stream a response from the Ollama API token by token."""
        try:
            formatted_messages = [
                {"role": msg.role, "content": msg.content} for msg in messages
            ]
            
            model = kwargs.pop("model", "llama3")
            
            stream_response = await self._client.chat(
                model=model,
                messages=formatted_messages,
                stream=True,
                **kwargs
            )
            
            # stream_response is an AsyncIterator when stream=True
            async for chunk in stream_response:
                content = chunk.get("message", {}).get("content")
                if content:
                    yield content
                    
        except ollama.ResponseError as e:
            raise LLMError(f"Ollama API error during stream: {e}")
        except Exception as e:
            raise LLMError(f"Unexpected error during stream: {e}")
