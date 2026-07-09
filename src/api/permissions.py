"""
Role-Based Access Control (RBAC) for the RAG system.

Roles in ascending order of privilege:
  USER        — regular employee; can query and upload personal documents
  MANAGER     — department head; manages their team workspace
  ADMIN       — tenant admin; manages all users and workspaces
  SUPER_ADMIN — platform-level admin; full access including system settings

Usage in route handlers:
    @router.post("/v1/users")
    async def create_user(
        _: Annotated[User, Depends(require_role(ADMIN, SUPER_ADMIN))],
    ) -> ...:
        ...

    @router.get("/v1/analytics")
    async def get_analytics(
        _: Annotated[User, Depends(require_min_role(MANAGER))],
    ) -> ...:
        ...
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.models import User

# ---------------------------------------------------------------------------
# Role constants — use these instead of string literals in route handlers
# ---------------------------------------------------------------------------

SUPER_ADMIN = "SUPER_ADMIN"
ADMIN = "ADMIN"
MANAGER = "MANAGER"
USER = "USER"

# All valid roles
ALL_ROLES: frozenset[str] = frozenset({SUPER_ADMIN, ADMIN, MANAGER, USER})

# Ordered from lowest to highest privilege — used for hierarchy checks
ROLE_HIERARCHY: list[str] = [USER, MANAGER, ADMIN, SUPER_ADMIN]


def _role_level(role: str) -> int:
    """Return the numeric privilege level for a role (higher = more permissions)."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1  # Unknown roles have no privileges


# ---------------------------------------------------------------------------
# Dependency factories
# ---------------------------------------------------------------------------


def require_role(*allowed_roles: str) -> Callable:  # type: ignore[type-arg]
    """
    Return a FastAPI dependency that enforces exact role membership.

    Raises HTTP 403 if the current user's role is not in the allowed set.

    Example:
        Depends(require_role(ADMIN, SUPER_ADMIN))
    """
    # Import here to avoid circular imports — dependencies imports from permissions
    from src.api.dependencies import get_current_user

    allowed = frozenset(allowed_roles)

    async def _dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role: {' or '.join(sorted(allowed))}. "
                    f"Your role: {current_user.role}"
                ),
            )
        return current_user

    return _dependency


def require_min_role(min_role: str) -> Callable:  # type: ignore[type-arg]
    """
    Return a FastAPI dependency that enforces a minimum role level.

    Raises HTTP 403 if the current user's role is below min_role in the hierarchy.

    Example:
        Depends(require_min_role(MANAGER))  # MANAGER, ADMIN, SUPER_ADMIN all pass
    """
    from src.api.dependencies import get_current_user

    min_level = _role_level(min_role)

    async def _dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if _role_level(current_user.role) < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Minimum required role: {min_role}. "
                    f"Your role: {current_user.role}"
                ),
            )
        return current_user

    return _dependency


def require_active_user() -> Callable:  # type: ignore[type-arg]
    """
    Return a FastAPI dependency that verifies the user account is active.

    Raises HTTP 403 if the account has been deactivated.
    """
    from src.api.dependencies import get_current_user

    async def _dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Contact your administrator.",
            )
        return current_user

    return _dependency
