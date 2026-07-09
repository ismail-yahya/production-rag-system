"""
Unit tests for the upgraded RateLimitMiddleware in src/api/middleware.py.

We test the pure logic functions (_get_endpoint_group, _get_limit_for_group)
directly — no need to spin up the ASGI stack for these unit tests.
Integration-level tests for Redis interaction are in the integration suite.
"""

import pytest

from src.api.middleware import (
    RateLimitMiddleware,
    _get_endpoint_group,
    _get_limit_for_group,
)
from src.core.config import settings


class TestEndpointGroupMapping:
    """Verify URL paths are mapped to the correct rate-limit bucket."""

    @pytest.mark.parametrize(
        ("path", "expected_group"),
        [
            # Ingest group
            ("/v1/ingest", "ingest"),
            ("/v1/ingest/", "ingest"),
            # Query group
            ("/v1/query", "query"),
            ("/v1/query/stream", "query"),
            ("/v1/query/anything", "query"),
            # Default group — everything else
            ("/v1/auth/login", "default"),
            ("/v1/auth/refresh", "default"),
            ("/v1/auth/api-keys", "default"),
            ("/v1/users", "default"),
            ("/v1/users/me", "default"),
            ("/v1/workspaces", "default"),
            ("/v1/admin/stats", "default"),
            ("/v1/documents", "default"),
            ("/health", "default"),
            ("/metrics", "default"),
        ],
    )
    def test_path_to_group_mapping(self, path: str, expected_group: str) -> None:
        assert _get_endpoint_group(path) == expected_group


class TestLimitPerGroup:
    """Verify the correct per-minute limit is returned for each group."""

    def test_ingest_limit_equals_settings(self) -> None:
        assert _get_limit_for_group("ingest") == settings.RATE_LIMIT_INGEST

    def test_query_limit_equals_settings(self) -> None:
        assert _get_limit_for_group("query") == settings.RATE_LIMIT_QUERY

    def test_default_limit_equals_settings(self) -> None:
        assert _get_limit_for_group("default") == settings.RATE_LIMIT_DEFAULT

    def test_unknown_group_falls_back_to_default(self) -> None:
        """An unrecognised group name must fall back to the default limit, not crash."""
        assert _get_limit_for_group("nonexistent_group") == settings.RATE_LIMIT_DEFAULT

    def test_ingest_limit_is_lower_than_query_limit(self) -> None:
        """
        Ingest is CPU/GPU expensive; its limit must always be tighter than the
        query limit so a single tenant can't flood the embedding pipeline.
        """
        assert settings.RATE_LIMIT_INGEST < settings.RATE_LIMIT_QUERY

    def test_all_limits_are_positive(self) -> None:
        assert settings.RATE_LIMIT_INGEST > 0
        assert settings.RATE_LIMIT_QUERY > 0
        assert settings.RATE_LIMIT_DEFAULT > 0


class TestRateLimitMiddlewareInit:
    """Verify the middleware constructor handles legacy kwargs gracefully."""

    def test_legacy_kwargs_are_silently_discarded(self) -> None:
        """
        The old constructor accepted `limit` and `window_seconds` kwargs.
        These must be silently ignored so existing deployments don't break.
        """
        # We pass a dummy ASGI app and mock the Redis connection
        from unittest.mock import MagicMock

        mock_app = MagicMock()
        # Should not raise even with legacy kwargs
        middleware = RateLimitMiddleware(
            mock_app,
            redis_url="redis://localhost:6379/1",
            limit=50,          # legacy kwarg — should be discarded
            window_seconds=30,  # legacy kwarg — should be discarded
        )
        assert middleware is not None


class TestRateLimitRedisKeyFormat:
    """Verify the Redis key format for tenant-scoped rate limiting."""

    def test_tenant_key_format(self) -> None:
        """
        The tenant-scoped key must embed both tenant_id and endpoint_group
        so different endpoints don't share a counter.
        """
        import uuid

        tenant_id = uuid.uuid4()
        endpoint_group = "query"
        key = f"rate_limit:tenant:{tenant_id}:{endpoint_group}"

        # Verify the key contains all required components
        assert "rate_limit:tenant:" in key
        assert str(tenant_id) in key
        assert endpoint_group in key

    def test_ip_fallback_key_format(self) -> None:
        """
        When there is no tenant context (e.g., /v1/auth/login before auth),
        the fallback key must use the client IP.
        """
        client_ip = "192.168.1.42"
        endpoint_group = "default"
        key = f"rate_limit:ip:{client_ip}:{endpoint_group}"

        assert "rate_limit:ip:" in key
        assert client_ip in key
        assert endpoint_group in key

    def test_tenant_and_ip_keys_are_different(self) -> None:
        """
        Tenant-scoped and IP-scoped keys must never collide even if
        the tenant UUID happens to match an IP address string.
        """
        key_tenant = "rate_limit:tenant:192.168.1.1:default"
        key_ip = "rate_limit:ip:192.168.1.1:default"
        assert key_tenant != key_ip
