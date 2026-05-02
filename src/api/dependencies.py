import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_session
from src.core.models import Tenant

security = HTTPBearer()


async def get_tenant(
    auth: Annotated[HTTPAuthorizationCredentials, Security(security)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Tenant:
    """
    Dependency that validates the Bearer token and returns the Tenant model.
    In this MVP, the token is treated as the raw API key hash for simplicity,
    as per the TDD Phase 1 requirements.
    """
    # In a production system, we would hash the incoming credential 
    # and compare it against the stored hash.
    api_key = auth.credentials

    stmt = select(Tenant).where(Tenant.api_key_hash == api_key, Tenant.is_active == True)
    result = await session.execute(stmt)
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    return tenant
