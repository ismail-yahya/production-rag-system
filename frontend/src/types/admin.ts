// ---------------------------------------------------------------------------
// Admin domain types — mirrors backend schemas for /v1/admin
// ---------------------------------------------------------------------------

export interface AdminStatsResponse {
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  average_latency_ms: number;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  limit?: number;
  offset?: number;
  action?: string;
  user_id?: string;
}

export interface EvalRunResponse {
  job_id: string;
  status: "pending";
  message: string;
}

export interface EvalMetricResult {
  metric_name: string;
  score: number;
  description: string | null;
}

export interface EvalResultsResponse {
  dataset_id: string | null;
  results: EvalMetricResult[];
  evaluated_at: string;
}
