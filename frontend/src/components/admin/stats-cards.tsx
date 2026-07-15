"use client";

// ---------------------------------------------------------------------------
// StatsCards — System usage telemetry panels for document corpus and search performance
// ---------------------------------------------------------------------------

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import { 
  FileText, 
  Layers, 
  Search, 
  Clock, 
  RefreshCw, 
  Loader2, 
  ServerCrash
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatsCards() {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const response = await adminService.getStats();
      return response.data;
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["adminStats"] });
  };

  const stats = statsQuery.data;

  return (
    <div className="space-y-4">
      
      {/* Action header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono block">
          Live Telemetry Statistics
        </span>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="h-8 px-2.5 border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1 font-mono text-[10px]"
        >
          {statsQuery.isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Refresh</span>
        </Button>
      </div>

      {statsQuery.isError ? (
        <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-start gap-3 text-xs text-rose-400">
          <ServerCrash className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold font-mono uppercase">Telemetry Query Interrupted</h4>
            <p className="font-sans">Failed to load system stats. Check database connectivity or admin session credentials.</p>
          </div>
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Documents */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border flex items-center gap-4 relative overflow-hidden group hover:border-accent-cyan/20 transition-all duration-300">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-card-border/80 text-accent-cyan">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold font-mono">
                Total Documents
              </span>
              <span className="text-xl font-bold text-slate-200 block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_documents ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-accent-cyan/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-accent-cyan/10 transition-colors" />
          </div>

          {/* Card 2: Total Chunks */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border flex items-center gap-4 relative overflow-hidden group hover:border-accent-indigo/20 transition-all duration-300">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-card-border/80 text-accent-indigo">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold font-mono">
                Ingested Chunks
              </span>
              <span className="text-xl font-bold text-slate-200 block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_chunks ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-accent-indigo/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-accent-indigo/10 transition-colors" />
          </div>

          {/* Card 3: Total Queries */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border flex items-center gap-4 relative overflow-hidden group hover:border-accent-violet/20 transition-all duration-300">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-card-border/80 text-accent-violet">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold font-mono">
                Search Inquiries
              </span>
              <span className="text-xl font-bold text-slate-200 block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_queries ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-accent-violet/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-accent-violet/10 transition-colors" />
          </div>

          {/* Card 4: Avg Latency */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border flex items-center gap-4 relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-card-border/80 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold font-mono">
                Average Latency
              </span>
              <span className="text-xl font-bold text-slate-200 block mt-1 font-mono font-semibold">
                {statsQuery.isLoading ? "..." : `${stats?.average_latency_ms ?? 0}ms`}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-emerald-500/10 transition-colors" />
          </div>

        </div>
      )}

    </div>
  );
}
