"use client";

import { useState } from "react";
import { ShieldCheck, Search, Calendar, Eye, X, Terminal, Filter, Code } from "lucide-react";
import { clsx } from "clsx";

interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: "QUERY" | "UPLOAD" | "DELETE" | "PERMISSION_CHANGE";
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  metadata: Record<string, any>;
}

// Initial mock list of audit logs
const initialLogs: AuditLogItem[] = [
  {
    id: "log-901",
    timestamp: "2026-07-09 08:32:15",
    user: "ismail.yahya@company.com",
    action: "QUERY",
    resourceType: "chat_session",
    resourceId: "session-xyz",
    ipAddress: "192.168.1.42",
    metadata: {
      query: "What are the compliance guidelines for remote employees?",
      model: "gpt-4o",
      temperature: 0.2,
      latency_ms: 1140,
      tokens_used: 480,
      sources_cited: 3,
      workspace_id: "2",
    },
  },
  {
    id: "log-902",
    timestamp: "2026-07-09 08:14:22",
    user: "ismail.yahya@company.com",
    action: "UPLOAD",
    resourceType: "document",
    resourceId: "doc-3",
    ipAddress: "192.168.1.42",
    metadata: {
      fileName: "cost_structures_2026.pdf",
      fileSize: "8.1 MB",
      chunkingStrategy: "recursive",
      chunkSize: 500,
      chunkOverlap: 50,
      workspaceId: "3",
    },
  },
  {
    id: "log-903",
    timestamp: "2026-07-08 16:45:10",
    user: "john.doe@company.com",
    action: "DELETE",
    resourceType: "document",
    resourceId: "doc-99",
    ipAddress: "10.0.0.15",
    metadata: {
      fileName: "old_draft_revenue.pdf",
      deletedFromWorkspace: "1",
      chunksRemoved: 28,
      vectorPurgeCount: 28,
    },
  },
  {
    id: "log-904",
    timestamp: "2026-07-08 10:12:00",
    user: "john.doe@company.com",
    action: "PERMISSION_CHANGE",
    resourceType: "user",
    resourceId: "dev.lead@company.com",
    ipAddress: "10.0.0.15",
    metadata: {
      affectedUser: "dev.lead@company.com",
      assignedRole: "USER",
      modifiedBy: "john.doe@company.com",
    },
  },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  
  // Inspector drawer states
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleInspect = (log: AuditLogItem) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.user.toLowerCase().includes(search.toLowerCase()) || 
                          log.resourceId.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-100 relative">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
          Compliance Audit Logs
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Trace security actions, queries, document ingestion details, and permission updates inside this organization.
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-glass border border-card-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by user email or resource ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/55 focus:outline-none text-xs text-slate-200 placeholder-slate-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40 cursor-pointer w-44"
          >
            <option value="all">All Actions</option>
            <option value="QUERY">Queries</option>
            <option value="UPLOAD">Upload Ingestions</option>
            <option value="DELETE">Deletions</option>
            <option value="PERMISSION_CHANGE">Permission Changes</option>
          </select>
        </div>
      </div>

      {/* High-density grid table */}
      <div className="bg-glass border border-card-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-300">
            <thead>
              <tr className="bg-slate-950/30 border-b border-card-border text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource Scope</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                    {/* Timestamp */}
                    <td className="px-6 py-4 text-slate-400 font-medium">{log.timestamp}</td>
                    
                    {/* User */}
                    <td className="px-6 py-4 font-semibold text-slate-200">{log.user}</td>
                    
                    {/* Action badge */}
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "text-[9px] font-bold px-2.5 py-0.5 rounded border tracking-wider",
                          log.action === "QUERY" && "bg-cyan-950/20 text-accent-cyan border-accent-cyan/20",
                          log.action === "UPLOAD" && "bg-indigo-950/20 text-accent-indigo border-accent-indigo/20",
                          log.action === "DELETE" && "bg-rose-950/20 text-rose-400 border-rose-500/20",
                          log.action === "PERMISSION_CHANGE" && "bg-amber-950/20 text-amber-400 border-amber-500/20"
                        )}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Resource scope */}
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                      {log.resourceType}: {log.resourceId}
                    </td>

                    {/* IP */}
                    <td className="px-6 py-4 text-slate-500">{log.ipAddress}</td>

                    {/* Inspect btn */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleInspect(log)}
                        className="p-1.5 rounded-lg border border-card-border hover:border-accent-cyan/20 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-all cursor-pointer"
                        title="Inspect Log details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 font-medium">
                    No compliance records found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Compliance Metadata Drawer */}
      <div
        className={clsx(
          "fixed inset-y-0 right-0 w-full sm:w-[450px] bg-[#0B0F19]/95 backdrop-blur-md border-l border-card-border p-6 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col justify-between",
          isDrawerOpen && selectedLog ? "translate-x-0" : "translate-x-full"
        )}
        style={{ boxShadow: "-10px 0 30px rgba(0,0,0,0.5)" }}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-card-border pb-4 mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-cyan" />
              <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Audit Inspector</h3>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedLog && (
            <div className="space-y-5 text-xs">
              {/* Event basic Info */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/40 border border-card-border">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Log UUID</span>
                  <code className="text-slate-300 font-mono font-semibold">{selectedLog.id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Actor Account</span>
                  <span className="text-slate-300 font-semibold">{selectedLog.user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Action Category</span>
                  <span className="text-accent-cyan font-bold uppercase">{selectedLog.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">IP Endpoint</span>
                  <span className="text-slate-400 font-mono">{selectedLog.ipAddress}</span>
                </div>
              </div>

              {/* JSON Metadata Display */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block">Structured Payload</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-card-border/50 max-h-96 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        {selectedLog && (
          <div className="p-3 rounded-lg bg-slate-900/20 border border-card-border/60 text-[10px] text-slate-500 flex items-start gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Audit trails are append-only. Event logs are permanently archived in cloud archives for compliance.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
