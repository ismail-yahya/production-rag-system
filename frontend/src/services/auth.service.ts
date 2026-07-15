// ---------------------------------------------------------------------------
// Auth service — login, register, logout, refresh, API key management
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  LoginRequest,
  TokenResponse,
  TenantRegisterRequest,
  TenantRegisterResponse,
  CreateApiKeyRequest,
  RotateApiKeyRequest,
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
} from "@/types";

export const authService = {
  login(data: LoginRequest) {
    return api.post<TokenResponse>("/v1/auth/login", data);
  },

  register(data: TenantRegisterRequest) {
    return api.post<TenantRegisterResponse>("/v1/auth/register", data);
  },

  logout() {
    return api.post("/v1/auth/logout");
  },

  refresh(refreshToken: string) {
    return api.post("/v1/auth/refresh", { refresh_token: refreshToken });
  },

  // API Keys
  createApiKey(data: CreateApiKeyRequest) {
    return api.post<ApiKeyCreatedResponse>("/v1/auth/api-keys", data);
  },

  listApiKeys() {
    return api.get<ApiKeyListResponse>("/v1/auth/api-keys");
  },

  deleteApiKey(keyId: string) {
    return api.delete(`/v1/auth/api-keys/${keyId}`);
  },

  rotateApiKey(keyId: string, data?: RotateApiKeyRequest) {
    return api.post<ApiKeyCreatedResponse>(
      `/v1/auth/api-keys/${keyId}/rotate`,
      data ?? {}
    );
  },
};
