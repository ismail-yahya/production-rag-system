// ---------------------------------------------------------------------------
// Document & Ingestion domain types — mirrors backend schemas for /v1 ingest
// ---------------------------------------------------------------------------

export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface DocumentResponse {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  status: DocumentStatus;
  chunk_count: number;
  created_at: string;
  indexed_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DocumentListResponse {
  documents: DocumentResponse[];
}

export interface IngestResponse {
  document_id: string;
  status: "pending";
  message: string;
}

export interface IngestionJobResponse {
  id: string;
  document_id: string;
  celery_task_id: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  started_at: string;
  completed_at: string | null;
  last_heartbeat_at: string | null;
}
