import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user
from src.api.routers.schemas import (
    WorkspaceCreate,
    WorkspaceMemberAdd,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from src.api.services.workspace_service import WorkspaceService
from src.core.database import get_session
from src.core.models import User

router = APIRouter(prefix="/v1/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    request: WorkspaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    """
    Create a new workspace within the current tenant.
    Only ADMIN, SUPER_ADMIN, and MANAGER roles can create workspaces.
    The creator is automatically added as an ADMIN member of the workspace.
    """
    service = WorkspaceService(session)
    workspace = await service.create_workspace(
        tenant_id=current_user.tenant_id,
        name=request.name,
        workspace_type=request.workspace_type.value,
        current_user=current_user,
        description=request.description,
    )
    return WorkspaceResponse.model_validate(workspace)


@router.get("", response_model=list[WorkspaceResponse], status_code=status.HTTP_200_OK)
async def list_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkspaceResponse]:
    """
    List all workspaces accessible by the current user.
    """
    service = WorkspaceService(session)
    workspaces = await service.list_workspaces(current_user)
    return [WorkspaceResponse.model_validate(w) for w in workspaces]


@router.get("/{workspace_id}", response_model=WorkspaceResponse, status_code=status.HTTP_200_OK)
async def get_workspace(
    workspace_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    """
    Retrieve details for a specific workspace.
    """
    service = WorkspaceService(session)
    workspace = await service.get_workspace(workspace_id, current_user)
    return WorkspaceResponse.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """
    Soft-delete a workspace.
    Only workspace admins or tenant admins can delete.
    """
    service = WorkspaceService(session)
    await service.delete_workspace(workspace_id, current_user)


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_workspace_member(
    workspace_id: uuid.UUID,
    request: WorkspaceMemberAdd,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceMemberResponse:
    """
    Add a user to a workspace.
    Only workspace admins or tenant admins can add.
    """
    service = WorkspaceService(session)
    member = await service.add_member(
        workspace_id=workspace_id,
        user_id=request.user_id,
        member_role=request.member_role.value,
        current_user=current_user,
    )
    return WorkspaceMemberResponse.model_validate(member)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """
    Remove a user from a workspace.
    Only workspace admins or tenant admins can remove.
    """
    service = WorkspaceService(session)
    await service.remove_member(workspace_id, user_id, current_user)
