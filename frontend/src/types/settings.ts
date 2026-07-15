// ---------------------------------------------------------------------------
// Tenant settings types — mirrors backend schemas for /v1/settings
// ---------------------------------------------------------------------------

export interface TenantConfigResponse {
  tenant_id: string;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  query_expansion: boolean;
  rate_limit_ingest: number;
  rate_limit_query: number;
}

export interface TenantConfigUpdate {
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  query_expansion?: boolean;
  rate_limit_ingest?: number;
  rate_limit_query?: number;
}
