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
    WorkspaceUpdate,
    WorkspaceMemberAddByEmail,
    WorkspaceMemberDetailResponse,
    WorkspaceDocumentResponse,
    WorkspaceMemberUpdateRole,
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


@router.patch("/{workspace_id}", response_model=WorkspaceResponse, status_code=status.HTTP_200_OK)
async def update_workspace(
    workspace_id: uuid.UUID,
    request: WorkspaceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    """
    Update workspace name and description.
    Only workspace admins or tenant admins can update.
    """
    from fastapi import HTTPException
    service = WorkspaceService(session)
    workspace = await service.get_workspace(workspace_id, current_user)
    
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        member = await service.workspace_repo.get_member(workspace_id, current_user.id)
        if not member or member.member_role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace administrators can update details.",
            )

    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description

    updated = await service.workspace_repo.update(
        workspace_id=workspace_id,
        tenant_id=current_user.tenant_id,
        **update_data
    )
    await session.commit()
    return WorkspaceResponse.model_validate(updated)


@router.post("/{workspace_id}/members/by-email", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_workspace_member_by_email(
    workspace_id: uuid.UUID,
    request: WorkspaceMemberAddByEmail,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceMemberResponse:
    """
    Add a user to a workspace by their email.
    Only workspace admins or tenant admins can add.
    """
    from src.api.repositories import UserRepository
    from fastapi import HTTPException
    
    user_repo = UserRepository(session)
    target_user = await user_repo.get_by_email(request.email, current_user.tenant_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{request.email}' not found in this tenant.",
        )
    
    service = WorkspaceService(session)
    member = await service.add_member(
        workspace_id=workspace_id,
        user_id=target_user.id,
        member_role=request.member_role.value,
        current_user=current_user,
    )
    return WorkspaceMemberResponse.model_validate(member)


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberDetailResponse], status_code=status.HTTP_200_OK)
async def get_workspace_members(
    workspace_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkspaceMemberDetailResponse]:
    """Get all members of a workspace with user details."""
    service = WorkspaceService(session)
    members = await service.list_members(workspace_id, current_user)
    return [WorkspaceMemberDetailResponse(**m) for m in members]


@router.get("/{workspace_id}/documents", response_model=list[WorkspaceDocumentResponse], status_code=status.HTTP_200_OK)
async def get_workspace_documents(
    workspace_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkspaceDocumentResponse]:
    """Get all documents associated with a workspace."""
    service = WorkspaceService(session)
    documents = await service.list_documents(workspace_id, current_user)
    return [WorkspaceDocumentResponse(**d) for d in documents]


@router.post("/{workspace_id}/documents/{document_id}", status_code=status.HTTP_201_CREATED)
async def link_document_to_workspace(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Link a document to a workspace partition."""
    from fastapi import HTTPException
    service = WorkspaceService(session)
    await service.get_workspace(workspace_id, current_user)
    
    has_write = await service.has_write_access(workspace_id, current_user)
    if not has_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace managers or admins can link documents.",
        )
    
    from src.api.repositories import DocumentRepository
    doc_repo = DocumentRepository(session)
    doc = await doc_repo.get_by_id(document_id, current_user.tenant_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    
    try:
        await service.doc_access_repo.grant_access(document_id, workspace_id, "WRITE")
        await session.commit()
    except Exception:
        pass


@router.delete("/{workspace_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_document_from_workspace(
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Unlink a document from a workspace partition."""
    from fastapi import HTTPException
    service = WorkspaceService(session)
    await service.get_workspace(workspace_id, current_user)
    
    has_write = await service.has_write_access(workspace_id, current_user)
    if not has_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace managers or admins can unlink documents.",
        )
        
    await service.doc_access_repo.revoke_access(document_id, workspace_id)
    await session.commit()


@router.patch("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberResponse, status_code=status.HTTP_200_OK)
async def update_workspace_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    request: WorkspaceMemberUpdateRole,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceMemberResponse:
    """
    Update a user's role in a workspace.
    Only workspace admins or tenant admins can update roles.
    """
    service = WorkspaceService(session)
    member = await service.update_member_role(
        workspace_id=workspace_id,
        user_id=user_id,
        member_role=request.member_role.value,
        current_user=current_user,
    )
    return WorkspaceMemberResponse.model_validate(member)

