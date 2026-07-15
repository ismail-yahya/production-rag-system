// ---------------------------------------------------------------------------
// Users service — CRUD users, password management
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  UserResponse,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserPasswordUpdate,
} from "@/types";

export const usersService = {
  getMe() {
    return api.get<UserResponse>("/v1/users/me");
  },

  list() {
    return api.get<UserListResponse>("/v1/users");
  },

  getById(userId: string) {
    return api.get<UserResponse>(`/v1/users/${userId}`);
  },

  create(data: CreateUserRequest) {
    return api.post<UserResponse>("/v1/users", data);
  },

  update(userId: string, data: UpdateUserRequest) {
    return api.patch<UserResponse>(`/v1/users/${userId}`, data);
  },

  updatePassword(userId: string, data: UserPasswordUpdate) {
    return api.patch(`/v1/users/${userId}/password`, data);
  },

  delete(userId: string) {
    return api.delete(`/v1/users/${userId}`);
  },
};
