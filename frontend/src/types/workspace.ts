// ---------------------------------------------------------------------------
// Workspace domain types — mirrors backend schemas for /v1/workspaces
// ---------------------------------------------------------------------------

export type WorkspaceType = "CENTRAL" | "TEAM" | "PERSONAL";
export type WorkspaceMemberRole = "ADMIN" | "MEMBER" | "VIEWER";

export interface WorkspaceResponse {
  id: string;
  tenant_id: string;
  name: string;
  workspace_type: WorkspaceType;
  description: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkspaceCreate {
  name: string;
  workspace_type?: WorkspaceType;
  description?: string;
}

export interface WorkspaceUpdate {
  name?: string;
  description?: string;
}

export interface WorkspaceMemberResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  member_role: WorkspaceMemberRole;
  joined_at: string;
}

export interface WorkspaceMemberDetailResponse {
  user_id: string;
  email: string;
  name: string;
  member_role: WorkspaceMemberRole;
  joined_at: string;
}

export interface WorkspaceMemberAdd {
  user_id: string;
  member_role?: WorkspaceMemberRole;
}

export interface WorkspaceMemberAddByEmail {
  email: string;
  member_role?: WorkspaceMemberRole;
}

export interface WorkspaceMemberUpdateRole {
  member_role: WorkspaceMemberRole;
}

export interface WorkspaceDocumentResponse {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  status: "pending" | "processing" | "indexed" | "failed";
  chunk_count: number;
  created_at: string;
}
