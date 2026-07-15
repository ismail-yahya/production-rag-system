"use client";

// ---------------------------------------------------------------------------
// AuditLogTable — Paginated log records viewer with JSON metadata drawer
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import { usersService } from "@/services/users.service";
import { 
  Terminal, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  X, 
  Info,
  Eye,
  Activity,
  Loader2
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { AuditLogEntry } from "@/types";

export function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  // Detailed view log item
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Compute offset
  const offset = (page - 1) * limit;

  // 1. Fetch audit logs query
  const auditLogsQuery = useQuery({
    queryKey: ["auditLogs", limit, offset, actionFilter, userFilter],
    queryFn: async () => {
      const response = await adminService.getAuditLogs({
        limit,
        offset,
        action: actionFilter || undefined,
        user_id: userFilter || undefined,
      });
      return response.data;
    },
  });

  // 2. Fetch users for dropdown filter list
  const usersQuery = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const response = await usersService.list();
      return response.data;
    },
  });

  const totalLogs = auditLogsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalLogs / limit) || 1;
  const logsList = auditLogsQuery.data?.logs || [];
  const usersList = usersQuery.data?.users || [];

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  // Helper to map user_id to display name
  const getUserDisplayName = (userId: string | null) => {
    if (!userId) return "System";
    const found = usersList.find((u) => u.user_id === userId);
    return found ? found.name : `ID: ${userId.slice(0, 8)}...`;
  };

  // Get action status color classes
  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("UPLOAD") || act.includes("LINK")) {
      return "bg-emerald-950/40 text-emerald-400 border-emerald-500/20";
    }
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("UNLINK")) {
      return "bg-rose-950/40 text-rose-400 border-rose-500/20";
    }
    if (act.includes("UPDATE") || act.includes("ROTATE") || act.includes("RESET")) {
      return "bg-amber-950/40 text-amber-400 border-amber-500/20";
    }
    return "bg-cyan-950/40 text-cyan-400 border-cyan-500/20";
  };

  return (
    <div className="space-y-4">
      
      {/* Filters Area */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/20 p-4 border border-card-border rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1); // Reset page to 1
              }}
              className="bg-slate-950/40 border border-card-border/60 rounded-md py-1 px-3 text-slate-400 hover:text-slate-200 transition-colors font-mono outline-none cursor-pointer h-9"
            >
              <option value="">All Actions</option>
              <option value="USER_CREATE">User Onboard</option>
              <option value="USER_DELETE">User Deactivate</option>
              <option value="DOCUMENT_UPLOAD">Document Ingest</option>
              <option value="DOCUMENT_DELETE">Document Delete</option>
              <option value="WORKSPACE_CREATE">Workspace Create</option>
              <option value="WORKSPACE_DELETE">Workspace Delete</option>
              <option value="API_KEY_CREATE">API Key Create</option>
              <option value="API_KEY_DELETE">API Key Revoke</option>
              <option value="TENANT_CONFIG_UPDATE">Config Edit</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950/40 border border-card-border/60 rounded-md py-1 px-3 text-slate-400 hover:text-slate-200 transition-colors font-mono outline-none cursor-pointer h-9 max-w-xs"
            >
              <option value="">All Operators</option>
              {usersList.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row count limiter */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span>Display Limit:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="bg-slate-950/40 border border-card-border/60 rounded py-0.5 px-1.5 text-slate-400 outline-none cursor-pointer"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-card-border rounded-xl bg-slate-900/20 overflow-hidden">
        <table className="min-w-full divide-y divide-card-border text-xs text-left">
          <thead className="bg-slate-950/50 font-mono uppercase tracking-wider text-[10px] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Action Trigger</th>
              <th className="px-5 py-3 font-semibold">Resource Class</th>
              <th className="px-5 py-3 font-semibold">Target ID</th>
              <th className="px-5 py-3 font-semibold">Operator</th>
              <th className="px-5 py-3 font-semibold">Terminal IP</th>
              <th className="px-5 py-3 font-semibold">Executed At</th>
              <th className="px-5 py-3 font-semibold text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/40 font-mono text-slate-300">
            {auditLogsQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-cyan mx-auto mb-2" />
                  <span>Loading audit ledger...</span>
                </td>
              </tr>
            ) : logsList.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-500">
                  <span>No log history matches filter configurations.</span>
                </td>
              </tr>
            ) : (
              logsList.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-[4px] text-[9px] uppercase font-bold tracking-wider border font-mono",
                      getActionBadgeClass(log.action)
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 uppercase text-[10px]">{log.resource_type}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-[10px]">{log.resource_id}</td>
                  <td className="px-5 py-3.5 text-slate-200">{getUserDisplayName(log.user_id)}</td>
                  <td className="px-5 py-3.5 text-slate-400">{log.ip_address || "0.0.0.0"}</td>
                  <td className="px-5 py-3.5 text-slate-400">{formatDate(log.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 rounded bg-slate-950 border border-card-border/60 hover:border-accent-cyan/30 text-slate-400 hover:text-accent-cyan transition-all cursor-pointer"
                      title="Inspect Metadata"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-card-border bg-slate-950/40 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>
              Records: <span className="text-slate-300">{offset + 1}</span> - <span className="text-slate-300">{Math.min(offset + limit, totalLogs)}</span> of <span className="text-slate-300">{totalLogs}</span>
            </span>
            <div className="flex items-center gap-3">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="p-1 rounded border border-card-border/60 hover:border-accent-cyan/20 disabled:opacity-30 disabled:hover:border-card-border/60 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className="p-1 rounded border border-card-border/60 hover:border-accent-cyan/20 disabled:opacity-30 disabled:hover:border-card-border/60 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED LOG METADATA DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#020408]/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedLog(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-xl h-full bg-[#080F1E]/95 backdrop-blur-xl border-l border-card-border shadow-2xl flex flex-col z-10 transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent-cyan animate-pulse" />
                <h2 className="font-semibold text-slate-200 text-sm font-mono tracking-wide uppercase">
                  Log Telemetry Inspector
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content scroll area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Event Context card */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-card-border/50 text-xs font-mono space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Log Identity
                </span>
                
                <div className="grid grid-cols-2 gap-3 text-slate-400">
                  <div>
                    <span className="text-[9px] text-slate-600 uppercase block">Log Entry ID</span>
                    <span className="text-slate-300">{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-600 uppercase block">Action Code</span>
                    <span className={cn("text-xs font-bold", getActionBadgeClass(selectedLog.action))}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-600 uppercase block">Operator</span>
                    <span className="text-slate-300">{getUserDisplayName(selectedLog.user_id)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-600 uppercase block">Execution Timestamp</span>
                    <span className="text-slate-300">{formatDate(selectedLog.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* JSON Metadata */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono uppercase tracking-wider">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  <span>Metadata JSON Payload</span>
                </div>
                
                <div className="p-4 rounded-xl bg-slate-950 border border-card-border/80 text-xs text-accent-cyan font-mono overflow-auto max-h-[450px] leading-relaxed shadow-inner">
                  {selectedLog.metadata_json ? (
                    <pre>{JSON.stringify(selectedLog.metadata_json, null, 2)}</pre>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-600 italic font-sans p-4">
                      <Info className="w-4 h-4" />
                      <span>No additional metadata payload attached to this event.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
