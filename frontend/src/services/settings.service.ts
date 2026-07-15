// ---------------------------------------------------------------------------
// Settings service — tenant configuration
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type { TenantConfigResponse, TenantConfigUpdate } from "@/types";

export const settingsService = {
  getConfig() {
    return api.get<TenantConfigResponse>("/v1/settings/config");
  },

  updateConfig(data: TenantConfigUpdate) {
    return api.patch<TenantConfigResponse>("/v1/settings/config", data);
  },
};
