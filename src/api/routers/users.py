"""
User management router — CRUD operations for users within a tenant.

Access control:
  GET  /v1/users/me           — any authenticated user
  POST /v1/users              — ADMIN or SUPER_ADMIN only
  GET  /v1/users              — ADMIN or SUPER_ADMIN only
  PATCH /v1/users/{user_id}   — ADMIN or SUPER_ADMIN only
  DELETE /v1/users/{user_id}  — ADMIN or SUPER_ADMIN only (soft-delete)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import hash_password
from src.api.dependencies import get_current_user
from src.api.permissions import ADMIN, SUPER_ADMIN, require_role
from src.api.repositories import UserRepository
from src.core.database import get_session
from src.core.models import User

router = APIRouter(prefix="/v1/users", tags=["users"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    role: str = Field(default="USER", description="USER | MANAGER | ADMIN | SUPER_ADMIN")


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    role: str | None = Field(default=None, description="USER | MANAGER | ADMIN | SUPER_ADMIN")
    is_active: bool | None = None


class UserListResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    users: list[UserResponse]
    total: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        user_id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


_VALID_ROLES = frozenset({"USER", "MANAGER", "ADMIN", "SUPER_ADMIN"})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """
    Return the profile of the currently authenticated user.
    Available to all authenticated users regardless of role.
    """
    return _to_response(current_user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    _admin: Annotated[User, Depends(require_role(ADMIN, SUPER_ADMIN))],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserResponse:
    """
    Create a new user within the current tenant.
    Requires ADMIN or SUPER_ADMIN role.
    """
    if body.role not in _VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(sorted(_VALID_ROLES))}",
        )

    user_repo = UserRepository(session)

    # Check for duplicate email within this tenant
    existing = await user_repo.get_by_email(body.email, current_user.tenant_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{body.email}' already exists in this tenant",
        )

    new_user = await user_repo.create(
        tenant_id=current_user.tenant_id,
        email=body.email,
        name=body.name,
        role=body.role,
        password_hash=hash_password(body.password),
    )
    await session.commit()
    return _to_response(new_user)


@router.get("", response_model=UserListResponse, status_code=status.HTTP_200_OK)
async def list_users(
    _admin: Annotated[User, Depends(require_role(ADMIN, SUPER_ADMIN))],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserListResponse:
    """
    List all users in the current tenant.
    Requires ADMIN or SUPER_ADMIN role.
    """
    user_repo = UserRepository(session)
    users = await user_repo.list_by_tenant(current_user.tenant_id)

    return UserListResponse(
        users=[_to_response(u) for u in users],
        total=len(users),
    )


@router.patch("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    _admin: Annotated[User, Depends(require_role(ADMIN, SUPER_ADMIN))],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserResponse:
    """
    Update user name, role, or active status.
    Requires ADMIN or SUPER_ADMIN role.
    ADMIN cannot elevate another user to SUPER_ADMIN.
    """
    if body.role is not None:
        if body.role not in _VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid role '{body.role}'.",
            )
        # Only SUPER_ADMIN can assign or revoke SUPER_ADMIN role
        if body.role == SUPER_ADMIN and current_user.role != SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SUPER_ADMIN can assign the SUPER_ADMIN role",
            )

    # Build update payload — skip None fields
    updates: dict[str, object] = {
        k: v
        for k, v in {"name": body.name, "role": body.role, "is_active": body.is_active}.items()
        if v is not None
    }

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided for update",
        )

    user_repo = UserRepository(session)
    updated = await user_repo.update(user_id, current_user.tenant_id, **updates)

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this tenant",
        )

    await session.commit()
    return _to_response(updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_role(ADMIN, SUPER_ADMIN))],
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """
    Soft-delete a user by setting is_active = False.
    Requires ADMIN or SUPER_ADMIN role.
    Users cannot deactivate themselves via this endpoint.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user_repo = UserRepository(session)
    updated = await user_repo.update(user_id, current_user.tenant_id, is_active=False)

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this tenant",
        )

    await session.commit()
