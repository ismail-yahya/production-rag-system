from collections.abc import AsyncGenerator
from typing import Any

import google.generativeai as genai
from pydantic import SecretStr

from src.core import LLMError
from src.llm.base import BaseLLM, LLMMessage, LLMResponse


class GeminiLLM(BaseLLM):
    """Google Gemini implementation of the BaseLLM interface."""

    def __init__(self, api_key: SecretStr | None) -> None:
        """
        Initialize the Gemini LLM provider.
        
        Args:
            api_key: The Google API key as a SecretStr.
        """
        if api_key is None:
            raise LLMError("Google API key is required but was not provided.")
            
        try:
            genai.configure(api_key=api_key.get_secret_value())
        except Exception as e:
            raise LLMError(f"Failed to initialize Gemini client: {e}")

    def _prepare_messages(self, messages: list[LLMMessage]) -> list[dict[str, Any]]:
        """Format messages for Gemini API."""
        formatted = []
        for msg in messages:
            # Gemini uses "user" and "model" roles
            role = "model" if msg.role == "assistant" else "user"
            formatted.append({"role": role, "parts": [msg.content]})
        return formatted

    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        """Generate a complete response using the Gemini API."""
        try:
            model_name = kwargs.pop("model", "gemini-1.5-flash")
            
            # Extract system instruction if present
            system_instruction = None
            if messages and messages[0].role == "system":
                system_instruction = messages[0].content
                messages = messages[1:]
                
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction
            )
            
            formatted_messages = self._prepare_messages(messages)
            
            response = await model.generate_content_async(
                formatted_messages,
                **kwargs
            )
            
            content = response.text
            
            # Extract token usage metadata from Gemini response
            usage = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count,
                    "completion_tokens": response.usage_metadata.candidates_token_count,
                    "total_tokens": response.usage_metadata.total_token_count,
                }
                
            return LLMResponse(
                content=content,
                model=model_name,
                usage=usage
            )
        except Exception as e:
            raise LLMError(f"Gemini API error during generate: {e}")

    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        """Stream a response from the Gemini API token by token."""
        try:
            model_name = kwargs.pop("model", "gemini-1.5-flash")
            
            # Extract system instruction if present
            system_instruction = None
            if messages and messages[0].role == "system":
                system_instruction = messages[0].content
                messages = messages[1:]
                
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction
            )
            
            formatted_messages = self._prepare_messages(messages)
            
            response = await model.generate_content_async(
                formatted_messages,
                stream=True,
                **kwargs
            )
            
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            raise LLMError(f"Gemini API error during stream: {e}")
