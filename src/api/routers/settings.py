import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user
from src.api.permissions import SUPER_ADMIN, require_role
from src.api.repositories import TenantConfigRepository
from src.core.database import get_session
from src.core.models import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/settings", tags=["settings"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class TenantConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: uuid.UUID
    llm_provider: str
    llm_model: str
    temperature: float
    query_expansion: bool
    rate_limit_ingest: int
    rate_limit_query: int


class TenantConfigUpdate(BaseModel):
    model_config = ConfigDict(frozen=True)

    llm_provider: str | None = Field(default=None, description="openai | anthropic | gemini | ollama")
    llm_model: str | None = Field(default=None, min_length=1, max_length=100)
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    query_expansion: bool | None = None
    rate_limit_ingest: int | None = Field(default=None, ge=1)
    rate_limit_query: int | None = Field(default=None, ge=1)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/config", response_model=TenantConfigResponse)
async def get_tenant_config(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TenantConfigResponse:
    """
    Retrieve the dynamic LLM and system configuration settings for the current tenant.
    Available to all authenticated users of the tenant to load defaults.
    """
    repo = TenantConfigRepository(session)
    config = await repo.get_config(current_user.tenant_id)
    if not config:
        # If no config is seeded yet, return defaults
        return TenantConfigResponse(
            tenant_id=current_user.tenant_id,
            llm_provider="openai",
            llm_model="gpt-4o",
            temperature=0.2,
            query_expansion=True,
            rate_limit_ingest=20,
            rate_limit_query=100,
        )
    return TenantConfigResponse.model_validate(config)


@router.patch("/config", response_model=TenantConfigResponse)
async def update_tenant_config(
    body: TenantConfigUpdate,
    _super_admin: Annotated[User, Depends(require_role(SUPER_ADMIN))],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TenantConfigResponse:
    """
    Update LLM and rate limiting configurations for the tenant.
    Restricted strictly to users holding the SUPER_ADMIN role.
    """
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No configuration fields provided for update",
        )

    # Validate provider and model values if present
    if "llm_provider" in updates:
        provider = updates["llm_provider"].lower()
        if provider not in ("openai", "anthropic", "gemini", "ollama"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported LLM provider: '{updates['llm_provider']}'",
            )
        updates["llm_provider"] = provider

    repo = TenantConfigRepository(session)
    config = await repo.update_config(current_user.tenant_id, **updates)
    await session.commit()

    logger.info(
        "tenant_config_updated",
        tenant_id=str(current_user.tenant_id),
        updated_by=str(current_user.id),
        updates=updates,
    )

    return TenantConfigResponse.model_validate(config)
