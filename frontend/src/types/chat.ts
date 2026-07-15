// ---------------------------------------------------------------------------
// Chat domain types — mirrors backend schemas for /v1/chat
// ---------------------------------------------------------------------------

export interface ChatThreadResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatThreadCreate {
  title: string;
  workspace_id?: string;
}

export interface ChatMessageResponse {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
}

export interface ChatQueryRequest {
  question: string;
  mode?: "standard" | "strict";
}

export interface ChatSource {
  source_id?: number;
  document_id: string;
  file_name: string;
  section_title: string | null;
  page_number: number | null;
  relevance_score: number;
  snippet: string;
}

// SSE event shapes
export interface SSETokenEvent {
  type: "token";
  content: string;
}

export interface SSESourcesEvent {
  type: "sources";
  sources: ChatSource[];
}

export interface SSEDoneEvent {
  type: "done";
}

export interface SSEErrorEvent {
  type: "error";
  content: string;
}

export type SSEEvent = SSETokenEvent | SSESourcesEvent | SSEDoneEvent | SSEErrorEvent;

// Query types (for POST /v1/query)
export type QueryMode = "standard" | "strict";
export type SearchType = "literal" | "semantic" | "hybrid";

export interface QueryRequest {
  question: string;
  filters?: {
    document_ids?: string[];
    tags?: string[];
  };
  mode?: QueryMode;
  search_type?: SearchType;
  search_config?: {
    vector_weight?: number;
    keyword_weight?: number;
    similarity_threshold?: number;
    top_k?: number;
  };
}

export interface QuerySource {
  source_id: number;
  document_id: string;
  file_name: string;
  section_title: string | null;
  page_number: number | null;
  relevance_score: number;
  snippet: string;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
  query_expansions: string[];
  retrieval_count: number;
  model: string;
  latency_ms: number;
}
