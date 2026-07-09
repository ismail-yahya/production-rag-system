import uuid
from collections.abc import Sequence

import structlog
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.repositories import DocumentAccessRepository, UserRepository, WorkspaceRepository
from src.core.models import User, Workspace, WorkspaceMember

logger = structlog.get_logger(__name__)


class WorkspaceService:
    """
    Service layer for managing workspaces and access control.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.workspace_repo = WorkspaceRepository(session)
        self.doc_access_repo = DocumentAccessRepository(session)
        self.user_repo = UserRepository(session)

    async def create_workspace(
        self,
        tenant_id: uuid.UUID,
        name: str,
        workspace_type: str,
        current_user: User,
        description: str | None = None,
    ) -> Workspace:
        """
        Create a new workspace and automatically add the creator as an ADMIN member.
        Only ADMIN, SUPER_ADMIN, and MANAGER roles can create workspaces.
        """
        if current_user.role not in ("ADMIN", "SUPER_ADMIN", "MANAGER"):
            logger.warning(
                "unauthorized_workspace_creation_attempt",
                user_id=str(current_user.id),
                role=current_user.role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers and administrators can create workspaces.",
            )

        workspace = await self.workspace_repo.create(
            tenant_id=tenant_id,
            name=name,
            workspace_type=workspace_type,
            created_by=current_user.id,
            description=description,
        )

        # Creator is automatically added as ADMIN of the workspace
        await self.workspace_repo.add_member(workspace.id, current_user.id, member_role="ADMIN")
        await self.session.commit()

        logger.info(
            "workspace_created",
            workspace_id=str(workspace.id),
            name=workspace.name,
            creator_id=str(current_user.id),
        )
        return workspace

    async def get_workspace(self, workspace_id: uuid.UUID, current_user: User) -> Workspace:
        """
        Retrieve a workspace's details.
        Ensures the user belongs to the tenant and has access.
        """
        workspace = await self.workspace_repo.get_by_id(workspace_id, current_user.tenant_id)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found.",
            )

        # Check access: ADMIN/SUPER_ADMIN can access all workspaces in the tenant.
        # Otherwise, must be a member, creator, or it must be a CENTRAL workspace.
        if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
            member = await self.workspace_repo.get_member(workspace_id, current_user.id)
            is_creator = workspace.created_by == current_user.id
            is_central = workspace.workspace_type == "CENTRAL"
            if not (member or is_creator or is_central):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access to this workspace is denied.",
                )

        return workspace

    async def list_workspaces(self, current_user: User) -> Sequence[Workspace]:
        """
        List all workspaces the user has access to.
        - ADMIN/SUPER_ADMIN sees all workspaces.
        - USER/MANAGER sees workspaces they are members of, created, or CENTRAL.
        """
        if current_user.role in ("ADMIN", "SUPER_ADMIN"):
            return await self.workspace_repo.list_by_tenant(current_user.tenant_id)
        return await self.workspace_repo.list_by_user(current_user.id, current_user.tenant_id)

    async def delete_workspace(self, workspace_id: uuid.UUID, current_user: User) -> None:
        """
        Delete (soft delete) a workspace.
        Only workspace admins or tenant admins can delete.
        """
        workspace = await self.get_workspace(workspace_id, current_user)

        # Validate permission
        if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
            member = await self.workspace_repo.get_member(workspace_id, current_user.id)
            if not member or member.member_role != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only workspace administrators can delete this workspace.",
                )

        await self.workspace_repo.delete(workspace_id, current_user.tenant_id)
        await self.session.commit()
        logger.info("workspace_deleted", workspace_id=str(workspace_id), user_id=str(current_user.id))

    async def add_member(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, member_role: str, current_user: User
    ) -> WorkspaceMember:
        """
        Add a user to a workspace.
        Only workspace admins or tenant admins can add.
        """
        # Verify workspace exists and user has access to it
        await self.get_workspace(workspace_id, current_user)

        # Validate permissions
        if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
            member = await self.workspace_repo.get_member(workspace_id, current_user.id)
            if not member or member.member_role != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only workspace administrators can add members.",
                )

        # Verify target user exists in the same tenant
        target_user = await self.user_repo.get_by_id(user_id, current_user.tenant_id)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found in this tenant.",
            )

        # Check if already a member
        existing_member = await self.workspace_repo.get_member(workspace_id, user_id)
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this workspace.",
            )

        new_member = await self.workspace_repo.add_member(
            workspace_id=workspace_id, user_id=user_id, member_role=member_role
        )
        await self.session.commit()
        logger.info(
            "workspace_member_added",
            workspace_id=str(workspace_id),
            user_id=str(user_id),
            role=member_role,
        )
        return new_member

    async def remove_member(self, workspace_id: uuid.UUID, user_id: uuid.UUID, current_user: User) -> None:
        """
        Remove a user from a workspace.
        Only workspace admins or tenant admins can remove.
        """
        await self.get_workspace(workspace_id, current_user)

        if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
            member = await self.workspace_repo.get_member(workspace_id, current_user.id)
            if not member or member.member_role != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only workspace administrators can remove members.",
                )

        # Check if member exists
        existing_member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not existing_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in workspace.",
            )

        # Prevent removing the last admin
        members = await self.workspace_repo.get_members(workspace_id)
        admins = [m for m in members if m.member_role == "ADMIN"]
        if len(admins) == 1 and existing_member.member_role == "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last workspace administrator.",
            )

        await self.workspace_repo.remove_member(workspace_id, user_id)
        await self.session.commit()
        logger.info("workspace_member_removed", workspace_id=str(workspace_id), user_id=str(user_id))

    async def get_accessible_document_ids(self, user: User) -> set[uuid.UUID]:
        """
        Fetch the set of document IDs accessible by the user.
        Delegates directly to the DocumentAccessRepository.
        """
        return await self.doc_access_repo.get_accessible_document_ids(user)

    async def has_write_access(self, workspace_id: uuid.UUID, user: User) -> bool:
        """
        Check if the user has write access to a workspace.
        ADMIN / SUPER_ADMIN always has write access.
        Otherwise, must be a member with role ADMIN or MEMBER (VIEWER is read-only),
        or the creator of the workspace.
        """
        if user.role in ("ADMIN", "SUPER_ADMIN"):
            return True

        workspace = await self.workspace_repo.get_by_id(workspace_id, user.tenant_id)
        if not workspace:
            return False

        if workspace.created_by == user.id:
            return True

        member = await self.workspace_repo.get_member(workspace_id, user.id)
        if member and member.member_role in ("ADMIN", "MEMBER"):
            return True

        return False

    async def get_or_create_personal_workspace(self, user: User) -> Workspace:
        """
        Get or create a user's personal workspace.
        """
        return await self.workspace_repo.get_or_create_personal_workspace(user)

