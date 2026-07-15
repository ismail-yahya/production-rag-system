// ---------------------------------------------------------------------------
// Admin service — stats, audit logs, evaluation
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  AdminStatsResponse,
  AuditLogListResponse,
  AuditLogFilters,
  EvalRunResponse,
  EvalResultsResponse,
} from "@/types";

export const adminService = {
  getStats() {
    return api.get<AdminStatsResponse>("/v1/admin/stats");
  },

  getAuditLogs(filters?: AuditLogFilters) {
    return api.get<AuditLogListResponse>("/v1/admin/audit-logs", {
      params: filters,
    });
  },

  triggerEvalRun() {
    return api.post<EvalRunResponse>("/v1/admin/eval/run");
  },

  getEvalResults() {
    return api.get<EvalResultsResponse>("/v1/admin/eval/results");
  },
};
