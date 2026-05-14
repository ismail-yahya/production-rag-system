from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.database import get_session


@pytest.mark.asyncio
async def test_get_session():
    """Verify get_session yields a session and closes it."""
    mock_session = AsyncMock()
    # We need to mock the async_session_factory which is a callable that returns an async context manager
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    mock_factory.return_value.__aexit__.return_value = None

    with patch("src.core.database.async_session_factory", mock_factory):
        async for session in get_session():
            assert session == mock_session
        
        mock_session.close.assert_called_once()
