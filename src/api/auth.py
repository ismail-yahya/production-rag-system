"""
JWT and password hashing utilities for the RAG authentication system.

This module is a pure service layer — it has no FastAPI dependencies and
can be called from anywhere. All token-related logic lives here so that
routes and dependencies stay thin.

Token strategy:
  - Access tokens: short-lived (default 60 min), contain user_id + tenant_id + role
  - Refresh tokens: long-lived (default 30 days), contain user_id only
  - API keys: random 32-byte hex strings, stored as bcrypt hashes in api_keys table
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import structlog
from jose import JWTError, jwt

from src.core.config import settings
from src.core.exceptions import SecurityError

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# bcrypt configuration
# rounds=12 is the production-safe default (balances security vs. latency).
# ---------------------------------------------------------------------------
_BCRYPT_ROUNDS = 12

# Token type constants — stored in the "type" claim to distinguish tokens
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


# ---------------------------------------------------------------------------
# Password utilities
# ---------------------------------------------------------------------------


def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of the given plaintext password."""
    pwd_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ---------------------------------------------------------------------------
# API key generation — raw shown once, hash stored permanently
# ---------------------------------------------------------------------------


def generate_api_key() -> tuple[str, str]:
    """
    Generate a cryptographically random API key.

    Returns:
        (raw_key, key_hash) — raw_key is shown to the user exactly once.
        Only key_hash is persisted in the database.
    """
    raw_key = secrets.token_hex(32)  # 64 hex chars = 256 bits of entropy
    raw_bytes = raw_key.encode("utf-8")
    key_hash = bcrypt.hashpw(raw_bytes, bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("utf-8")
    return raw_key, key_hash


def verify_api_key(raw_key: str, stored_hash: str) -> bool:
    """Verify a raw API key against its stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            raw_key.encode("utf-8"),
            stored_hash.encode("utf-8"),
        )
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT token creation
# ---------------------------------------------------------------------------


def _get_jwt_secret() -> str:
    """Retrieve the JWT secret from Settings, raising if not configured."""
    if settings.JWT_SECRET_KEY is None:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return settings.JWT_SECRET_KEY.get_secret_value()


def create_access_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    role: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create a signed JWT access token.

    Claims:
      sub  — user UUID (string)
      tid  — tenant UUID (string)
      role — user role string
      type — "access"
      exp  — expiry timestamp
      iat  — issued-at timestamp
    """
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tid": str(tenant_id),
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, _get_jwt_secret(), algorithm=settings.JWT_ALGORITHM)  # type: ignore[no-any-return]


def create_refresh_token(user_id: uuid.UUID) -> str:
    """
    Create a signed JWT refresh token.

    Refresh tokens carry only the user ID — they cannot be used for API access
    directly; they must be exchanged for a new access token via /v1/auth/refresh.
    """
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": REFRESH_TOKEN_TYPE,
        "iat": now,
        "exp": expire,
    }

    return jwt.encode(payload, _get_jwt_secret(), algorithm=settings.JWT_ALGORITHM)  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# JWT token verification
# ---------------------------------------------------------------------------


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Raises:
        SecurityError — if the token is expired, malformed, or has an invalid signature.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            _get_jwt_secret(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as exc:
        logger.warning("jwt_decode_failed", error=str(exc))
        raise SecurityError(f"Invalid or expired token: {exc}") from exc


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode a JWT and verify it is an access token (not a refresh token).

    Raises:
        SecurityError — if invalid or if the token type is not "access".
    """
    payload = decode_token(token)
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise SecurityError("Token is not a valid access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """
    Decode a JWT and verify it is a refresh token.

    Raises:
        SecurityError — if invalid or if the token type is not "refresh".
    """
    payload = decode_token(token)
    if payload.get("type") != REFRESH_TOKEN_TYPE:
        raise SecurityError("Token is not a valid refresh token")
    return payload
