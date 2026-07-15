// ---------------------------------------------------------------------------
// Query service — REST based grounded queries (non-streaming)
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type { QueryRequest, QueryResponse } from "@/types";

export const queryService = {
  query(data: QueryRequest) {
    return api.post<QueryResponse>("/v1/query", data);
  },
};
