// ---------------------------------------------------------------------------
// Workspaces service — CRUD workspaces, members, document linking
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  WorkspaceResponse,
  WorkspaceCreate,
  WorkspaceUpdate,
  WorkspaceMemberResponse,
  WorkspaceMemberDetailResponse,
  WorkspaceMemberAdd,
  WorkspaceMemberAddByEmail,
  WorkspaceMemberUpdateRole,
  WorkspaceDocumentResponse,
} from "@/types";

export const workspacesService = {
  list() {
    return api.get<WorkspaceResponse[]>("/v1/workspaces");
  },

  getById(id: string) {
    return api.get<WorkspaceResponse>(`/v1/workspaces/${id}`);
  },

  create(data: WorkspaceCreate) {
    return api.post<WorkspaceResponse>("/v1/workspaces", data);
  },

  update(id: string, data: WorkspaceUpdate) {
    return api.patch<WorkspaceResponse>(`/v1/workspaces/${id}`, data);
  },

  delete(id: string) {
    return api.delete(`/v1/workspaces/${id}`);
  },

  // Members
  listMembers(workspaceId: string) {
    return api.get<WorkspaceMemberDetailResponse[]>(
      `/v1/workspaces/${workspaceId}/members`
    );
  },

  addMember(workspaceId: string, data: WorkspaceMemberAdd) {
    return api.post<WorkspaceMemberResponse>(
      `/v1/workspaces/${workspaceId}/members`,
      data
    );
  },

  addMemberByEmail(workspaceId: string, data: WorkspaceMemberAddByEmail) {
    return api.post<WorkspaceMemberResponse>(
      `/v1/workspaces/${workspaceId}/members/by-email`,
      data
    );
  },

  updateMemberRole(
    workspaceId: string,
    userId: string,
    data: WorkspaceMemberUpdateRole
  ) {
    return api.patch<WorkspaceMemberResponse>(
      `/v1/workspaces/${workspaceId}/members/${userId}`,
      data
    );
  },

  removeMember(workspaceId: string, userId: string) {
    return api.delete(`/v1/workspaces/${workspaceId}/members/${userId}`);
  },

  // Documents in workspace
  listDocuments(workspaceId: string) {
    return api.get<WorkspaceDocumentResponse[]>(
      `/v1/workspaces/${workspaceId}/documents`
    );
  },

  linkDocument(workspaceId: string, documentId: string) {
    return api.post(
      `/v1/workspaces/${workspaceId}/documents/${documentId}`
    );
  },

  unlinkDocument(workspaceId: string, documentId: string) {
    return api.delete(
      `/v1/workspaces/${workspaceId}/documents/${documentId}`
    );
  },
};
