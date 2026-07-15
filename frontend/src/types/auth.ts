// ---------------------------------------------------------------------------
// Auth domain types — mirrors backend Pydantic schemas for /v1/auth endpoints
// ---------------------------------------------------------------------------

export interface LoginRequest {
  tenant_id: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface TenantRegisterRequest {
  name: string;
  email: string;
  password: string;
  admin_name: string;
}

export interface TenantRegisterResponse {
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  email: string;
  role: "SUPER_ADMIN";
  created_at: string;
}

export interface CreateApiKeyRequest {
  name: string;
}

export interface RotateApiKeyRequest {
  name?: string;
}

export interface ApiKeyCreatedResponse {
  key_id: string;
  name: string;
  raw_key: string;
  created_at: string;
}

export interface ApiKeyItem {
  key_id: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApiKeyListResponse {
  api_keys: ApiKeyItem[];
  total: number;
}

/** Decoded JWT payload shape */
export interface JWTPayload {
  sub: string;      // user_id
  tid: string;      // tenant_id
  role: UserRole;
  exp: number;
  iat: number;
}

export type UserRole = "USER" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
