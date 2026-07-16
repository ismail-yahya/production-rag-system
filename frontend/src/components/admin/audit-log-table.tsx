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
      return "bg-emerald-50 text-emerald-600 border-emerald-200";
    }
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("UNLINK")) {
      return "bg-rose-50 text-rose-600 border-rose-200";
    }
    if (act.includes("UPDATE") || act.includes("ROTATE") || act.includes("RESET")) {
      return "bg-amber-50 text-amber-600 border-amber-200";
    }
    return "bg-blue-50 text-blue-600 border-blue-200";
  };

  return (
    <div className="space-y-4">
      
      {/* Filters Area */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#E6EEF8] p-4 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none rounded-2xl text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1); // Reset page to 1
              }}
              className="bg-[#E6EEF8] border-none rounded-full py-1 px-3 text-[#3E4E63] hover:text-[#3E4E63] transition-all font-mono outline-none cursor-pointer h-9 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] focus:ring-1 focus:ring-primary/20"
            >
              <option value="" className="bg-[#E6EEF8] text-[#3E4E63]">All Actions</option>
              <option value="USER_CREATE" className="bg-[#E6EEF8] text-[#3E4E63]">User Onboard</option>
              <option value="USER_DELETE" className="bg-[#E6EEF8] text-[#3E4E63]">User Deactivate</option>
              <option value="DOCUMENT_UPLOAD" className="bg-[#E6EEF8] text-[#3E4E63]">Document Ingest</option>
              <option value="DOCUMENT_DELETE" className="bg-[#E6EEF8] text-[#3E4E63]">Document Delete</option>
              <option value="WORKSPACE_CREATE" className="bg-[#E6EEF8] text-[#3E4E63]">Workspace Create</option>
              <option value="WORKSPACE_DELETE" className="bg-[#E6EEF8] text-[#3E4E63]">Workspace Delete</option>
              <option value="API_KEY_CREATE" className="bg-[#E6EEF8] text-[#3E4E63]">API Key Create</option>
              <option value="API_KEY_DELETE" className="bg-[#E6EEF8] text-[#3E4E63]">API Key Revoke</option>
              <option value="TENANT_CONFIG_UPDATE" className="bg-[#E6EEF8] text-[#3E4E63]">Config Edit</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#E6EEF8] border-none rounded-full py-1 px-3 text-[#3E4E63] hover:text-[#3E4E63] transition-all font-mono outline-none cursor-pointer h-9 max-w-xs shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] focus:ring-1 focus:ring-primary/20"
            >
              <option value="" className="bg-[#E6EEF8] text-[#3E4E63]">All Operators</option>
              {usersList.map((u) => (
                <option key={u.user_id} value={u.user_id} className="bg-[#E6EEF8] text-[#3E4E63]">
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row count limiter */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#5A6E85] font-bold">
          <span>Display Limit:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="bg-[#E6EEF8] border-none rounded-full py-1 px-2.5 text-[#3E4E63] outline-none cursor-pointer shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]"
          >
            <option value="25" className="bg-[#E6EEF8] text-[#3E4E63]">25</option>
            <option value="50" className="bg-[#E6EEF8] text-[#3E4E63]">50</option>
            <option value="100" className="bg-[#E6EEF8] text-[#3E4E63]">100</option>
            <option value="200" className="bg-[#E6EEF8] text-[#3E4E63]">200</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
          <thead className="bg-[#D0DBEA]/30 font-mono uppercase tracking-wider text-[10px] text-[#7A8C9E]">
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
          <tbody className="divide-y divide-slate-200 font-mono text-[#3E4E63]">
            {auditLogsQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[#7A8C9E]">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <span>Loading audit ledger...</span>
                </td>
              </tr>
            ) : logsList.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[#7A8C9E] italic">
                  <span>No log history matches filter configurations.</span>
                </td>
              </tr>
            ) : (
              logsList.map((log) => (
                <tr key={log.id} className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer">
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-[4px] text-[9px] uppercase font-bold tracking-wider border font-mono",
                      getActionBadgeClass(log.action)
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#5A6E85] uppercase text-[10px]">{log.resource_type}</td>
                  <td className="px-5 py-3.5 text-[#7A8C9E] text-[10px]">{log.resource_id}</td>
                  <td className="px-5 py-3.5 text-[#3E4E63] font-bold">{getUserDisplayName(log.user_id)}</td>
                  <td className="px-5 py-3.5 text-[#5A6E85]">{log.ip_address || "0.0.0.0"}</td>
                  <td className="px-5 py-3.5 text-[#7A8C9E]">{formatDate(log.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-primary transition-all cursor-pointer border-none"
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
          <div className="px-5 py-3 border-t border-slate-200/50 bg-[#D0DBEA]/30 flex items-center justify-between font-mono text-[10px] text-[#7A8C9E] font-bold">
            <span>
              Records: <span className="text-[#3E4E63]">{offset + 1}</span> - <span className="text-[#3E4E63]">{Math.min(offset + limit, totalLogs)}</span> of <span className="text-[#3E4E63]">{totalLogs}</span>
            </span>
            <div className="flex items-center gap-3">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[1.5px_1.5px_3px_#c2d0e6,-1.5px_-1.5px_3px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] disabled:opacity-30 disabled:hover:shadow-[1.5px_1.5px_3px_#c2d0e6,-1.5px_-1.5px_3px_#ffffff] transition-all cursor-pointer border-none text-[#5A6E85] hover:text-[#3E4E63]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[1.5px_1.5px_3px_#c2d0e6,-1.5px_-1.5px_3px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] disabled:opacity-30 disabled:hover:shadow-[1.5px_1.5px_3px_#c2d0e6,-1.5px_-1.5px_3px_#ffffff] transition-all cursor-pointer border-none text-[#5A6E85] hover:text-[#3E4E63]"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedLog(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-xl h-full bg-[#E6EEF8] border-l border-slate-200/50 shadow-2xl flex flex-col z-10 transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary animate-pulse" />
                <h2 className="font-semibold text-[#3E4E63] text-sm font-mono tracking-wide uppercase">
                  Log Telemetry Inspector
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content scroll area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Event Context card */}
              <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none text-xs font-mono space-y-3">
                <span className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Log Identity
                </span>
                
                <div className="grid grid-cols-2 gap-3 text-[#5A6E85]">
                  <div>
                    <span className="text-[9px] text-[#7A8C9E] uppercase block">Log Entry ID</span>
                    <span className="text-[#3E4E63] font-bold">{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#7A8C9E] uppercase block">Action Code</span>
                    <span className={cn("text-xs font-bold", getActionBadgeClass(selectedLog.action))}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#7A8C9E] uppercase block">Operator</span>
                    <span className="text-[#3E4E63] font-bold">{getUserDisplayName(selectedLog.user_id)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#7A8C9E] uppercase block">Execution Timestamp</span>
                    <span className="text-[#3E4E63] font-bold">{formatDate(selectedLog.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* JSON Metadata */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[#5A6E85] font-mono uppercase tracking-wider font-bold">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span>Metadata JSON Payload</span>
                </div>
                
                <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none text-xs text-[#3E4E63] font-mono overflow-auto max-h-[450px] leading-relaxed shadow-inner">
                  {selectedLog.metadata_json ? (
                    <pre>{JSON.stringify(selectedLog.metadata_json, null, 2)}</pre>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[#7A8C9E] italic font-sans p-4 justify-center">
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
