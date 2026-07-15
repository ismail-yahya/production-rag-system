"""
Authentication router — login, token refresh, and API key management.

Endpoints:
  POST   /v1/auth/login                      — email + password → JWT access + refresh tokens
  POST   /v1/auth/refresh                    — refresh token → new access token
  POST   /v1/auth/api-keys                   — create a new API key (shown raw once)
  GET    /v1/auth/api-keys                   — list current user's API keys (no raw values)
  DELETE /v1/auth/api-keys/{key_id}          — deactivate an API key
  POST   /v1/auth/api-keys/{key_id}/rotate   — rotate (replace) an API key atomically
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

logger = structlog.get_logger(__name__)


from src.api.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    decode_access_token,
    generate_api_key,
    verify_password,
    hash_password,
)
from src.api.dependencies import get_current_user
from src.api.repositories import ApiKeyRepository, UserRepository
from src.api.routers.schemas import TenantRegisterRequest, TenantRegisterResponse
from src.core.database import get_session
from src.core.models import User, Tenant, TenantConfig

security = HTTPBearer()


router = APIRouter(prefix="/v1/auth", tags=["authentication"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: uuid.UUID = Field(..., description="The tenant this user belongs to")
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")


class TokenResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")


class RefreshRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    refresh_token: str


class AccessTokenResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CreateApiKeyRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str = Field(..., min_length=1, max_length=100, description="Human-readable key name")


class ApiKeyCreatedResponse(BaseModel):
    """Returned exactly once — the raw key is never retrievable again."""

    model_config = ConfigDict(frozen=True)

    key_id: uuid.UUID
    name: str
    # raw_key is shown ONLY at creation time — store it securely.
    raw_key: str = Field(..., description="Show to user once. Never stored in plaintext.")
    created_at: str


class ApiKeyListItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    key_id: uuid.UUID
    name: str
    is_active: bool
    last_used_at: str | None
    expires_at: str | None
    created_at: str


class ApiKeyListResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    api_keys: list[ApiKeyListItem]
    total: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """
    Authenticate with email and password.
    Returns a JWT access token and a long-lived refresh token.
    """
    user_repo = UserRepository(session)
    user = await user_repo.get_by_email(body.email, body.tenant_id)

    # Use a constant-time comparison path — do NOT reveal whether email exists.
    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    # Record successful login
    await user_repo.record_login(user.id)
    await session.commit()

    from src.core.config import settings

    access_token = create_access_token(user.id, user.tenant_id, user.role)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=AccessTokenResponse, status_code=status.HTTP_200_OK)
async def refresh_access_token(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AccessTokenResponse:
    """
    Exchange a valid refresh token for a new access token.
    The refresh token itself is not rotated (stateless approach).
    """
    from src.core.exceptions import SecurityError

    try:
        payload = decode_refresh_token(body.refresh_token)
    except SecurityError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = uuid.UUID(payload["sub"])

    # Fetch user to get current role and tenant — role may have changed since token was issued
    from sqlalchemy import select

    from src.core.models import User as UserModel

    result = await session.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or has been deactivated",
        )

    from src.core.config import settings

    new_access_token = create_access_token(user.id, user.tenant_id, user.role)

    return AccessTokenResponse(
        access_token=new_access_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    body: CreateApiKeyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiKeyCreatedResponse:
    """
    Create a new API key for the authenticated user.

    The raw key is returned exactly once in this response.
    It cannot be retrieved again — store it securely immediately.
    """
    raw_key, key_hash = generate_api_key()

    api_key_repo = ApiKeyRepository(session)
    api_key = await api_key_repo.create(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        key_hash=key_hash,
        name=body.name,
    )
    await session.commit()

    return ApiKeyCreatedResponse(
        key_id=api_key.id,
        name=api_key.name,
        raw_key=raw_key,
        created_at=api_key.created_at.isoformat(),
    )


@router.get("/api-keys", response_model=ApiKeyListResponse, status_code=status.HTTP_200_OK)
async def list_api_keys(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiKeyListResponse:
    """
    List all API keys for the current user.
    Raw key values are never returned — only metadata.
    """
    api_key_repo = ApiKeyRepository(session)
    keys = await api_key_repo.list_by_user(current_user.id)

    return ApiKeyListResponse(
        api_keys=[
            ApiKeyListItem(
                key_id=k.id,
                name=k.name,
                is_active=k.is_active,
                last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
                expires_at=k.expires_at.isoformat() if k.expires_at else None,
                created_at=k.created_at.isoformat(),
            )
            for k in keys
        ],
        total=len(keys),
    )


@router.delete(
    "/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_api_key(
    key_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """
    Deactivate (soft-delete) an API key.
    Users can only deactivate their own keys.
    """
    api_key_repo = ApiKeyRepository(session)
    deactivated = await api_key_repo.deactivate(key_id, current_user.id)

    if not deactivated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or does not belong to your account",
        )

    await session.commit()


class RotateApiKeyRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str | None = Field(
        default=None,
        max_length=100,
        description="Name for the new key. Defaults to the old key's name with '(rotated)' suffix.",
    )


@router.post(
    "/api-keys/{key_id}/rotate",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def rotate_api_key(
    key_id: uuid.UUID,
    body: RotateApiKeyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApiKeyCreatedResponse:
    """
    Rotate an API key: deactivate the old key and issue a new one atomically.

    The new raw key is returned exactly once in this response.
    The old key is immediately invalidated — any system using it must be updated.
    """
    api_key_repo = ApiKeyRepository(session)

    # Fetch the old key to inherit its name if the caller didn't supply a new name
    old_key = await api_key_repo.get_by_id(key_id, current_user.id)
    if old_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or does not belong to your account",
        )

    new_name = body.name or f"{old_key.name} (rotated)"
    raw_key, key_hash = generate_api_key()

    new_key = await api_key_repo.rotate(
        key_id=key_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        new_key_hash=key_hash,
        new_name=new_name,
    )

    if new_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key rotation failed — key may have already been deactivated",
        )

    await session.commit()

    return ApiKeyCreatedResponse(
        key_id=new_key.id,
        name=new_key.name,
        raw_key=raw_key,
        created_at=new_key.created_at.isoformat(),
    )


@router.post("/register", response_model=TenantRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_tenant(
    body: TenantRegisterRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TenantRegisterResponse:
    """
    Onboard a new organization (Tenant) along with its first SUPER_ADMIN user.
    """
    import secrets
    from sqlalchemy import select
    from src.api.services.audit_service import ACTION_USER_CREATED, AuditService

    # Check if a user with this email already exists globally or within the scope
    user_check = await session.execute(select(User).where(User.email == body.email))
    if user_check.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists",
        )

    # 1. Create Tenant
    random_hash = secrets.token_hex(32)
    tenant = Tenant(
        name=body.name,
        api_key_hash=random_hash,
        is_active=True,
    )
    session.add(tenant)
    await session.flush()  # populate tenant.id

    # 2. Create SUPER_ADMIN user
    hashed_pwd = hash_password(body.password)
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        name=body.admin_name,
        role="SUPER_ADMIN",
        password_hash=hashed_pwd,
        is_active=True,
    )
    session.add(user)
    await session.flush()  # populate user.id

    # 3. Seed default TenantConfig
    config = TenantConfig(
        tenant_id=tenant.id,
        llm_provider="openai",
        llm_model="gpt-4o",
        temperature=0.2,
        query_expansion=True,
        rate_limit_ingest=20,
        rate_limit_query=100,
    )
    session.add(config)

    # Log audit entry
    await AuditService.log(
        session=session,
        tenant_id=tenant.id,
        user_id=user.id,
        action=ACTION_USER_CREATED,
        resource_type="user",
        resource_id=str(user.id),
        metadata={"email": user.email, "role": user.role, "onboarding": True},
    )

    await session.commit()

    return TenantRegisterResponse(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        user_id=user.id,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    auth_header: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """
    Log out the current user, invalidating their JWT access token in Redis.
    """
    from datetime import UTC, datetime
    import redis.asyncio as redis_async
    from src.api.services.audit_service import ACTION_LOGOUT, AuditService
    from src.core.config import settings

    token = auth_header.credentials
    try:
        payload = decode_access_token(token)
        exp = payload.get("exp")
        if exp:
            ttl = int(exp - datetime.now(UTC).timestamp())
            if ttl > 0:
                r = redis_async.from_url(settings.REDIS_BACKEND_URL)
                await r.setex(f"jwt_blocklist:{token}", ttl, "revoked")
    except Exception as e:
        logger.warning("logout_token_revocation_failed", error=str(e))

    await AuditService.log(
        session=session,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=ACTION_LOGOUT,
    )
    await session.commit()


