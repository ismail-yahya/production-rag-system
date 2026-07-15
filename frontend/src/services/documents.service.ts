// ---------------------------------------------------------------------------
// Documents service — upload, list, detail, ingestion job, delete
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  DocumentResponse,
  DocumentListResponse,
  IngestResponse,
  IngestionJobResponse,
} from "@/types";

export const documentsService = {
  list() {
    return api.get<DocumentListResponse>("/v1/documents");
  },

  getById(documentId: string) {
    return api.get<DocumentResponse>(`/v1/documents/${documentId}`);
  },

  getIngestionJob(documentId: string) {
    return api.get<IngestionJobResponse>(
      `/v1/documents/${documentId}/ingestion-job`
    );
  },

  delete(documentId: string) {
    return api.delete(`/v1/documents/${documentId}`);
  },

  /**
   * Upload a file for ingestion.
   * Uses multipart/form-data — Axios handles the Content-Type header automatically.
   */
  upload(file: File, workspaceId?: string) {
    const formData = new FormData();
    formData.append("file", file);

    const params = workspaceId ? { workspace_id: workspaceId } : {};

    return api.post<IngestResponse>("/v1/ingest", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      params,
    });
  },
};
