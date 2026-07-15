// ---------------------------------------------------------------------------
// User domain types — mirrors backend Pydantic schemas for /v1/users endpoints
// ---------------------------------------------------------------------------

import type { UserRole } from "./auth";

export interface UserResponse {
  user_id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserPasswordUpdate {
  old_password?: string;
  new_password: string;
}
