from collections.abc import AsyncGenerator
from typing import Any

import pytest

from src.llm.base import BaseLLM, LLMMessage, LLMResponse


def test_base_llm_is_abstract() -> None:
    """Test that BaseLLM cannot be instantiated directly."""
    with pytest.raises(TypeError):
        BaseLLM()  # type: ignore


def test_llm_message() -> None:
    """Test LLMMessage instantiation and attributes."""
    msg = LLMMessage(role="user", content="hello")
    assert msg.role == "user"
    assert msg.content == "hello"


def test_llm_response() -> None:
    """Test LLMResponse instantiation and attributes."""
    resp = LLMResponse(content="hi", model="gpt-4", usage={"total_tokens": 10})
    assert resp.content == "hi"
    assert resp.model == "gpt-4"
    assert resp.usage == {"total_tokens": 10}


class DummyLLM(BaseLLM):
    """Dummy implementation of BaseLLM for testing."""

    async def generate(self, messages: list[LLMMessage], **kwargs: Any) -> LLMResponse:
        return LLMResponse(content="dummy_generate", model="dummy")

    async def stream(self, messages: list[LLMMessage], **kwargs: Any) -> AsyncGenerator[str, None]:
        yield "dummy_stream"


@pytest.mark.asyncio
async def test_dummy_llm_generate() -> None:
    """Test the generate method of a concrete BaseLLM subclass."""
    llm = DummyLLM()
    resp = await llm.generate([])
    assert isinstance(resp, LLMResponse)
    assert resp.content == "dummy_generate"
    assert resp.model == "dummy"


@pytest.mark.asyncio
async def test_dummy_llm_stream() -> None:
    """Test the stream method of a concrete BaseLLM subclass."""
    llm = DummyLLM()
    chunks = [chunk async for chunk in llm.stream([])]
    assert chunks == ["dummy_stream"]
