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
        <span className="text-xs font-bold text-[#5A6E85] uppercase tracking-widest font-mono block">
          Live Telemetry Statistics
        </span>
        <Button
          onClick={handleRefresh}
          className="h-8 px-2.5 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer flex items-center gap-1 font-mono text-[10px] rounded-full font-bold"
        >
          {statsQuery.isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Refresh</span>
        </Button>
      </div>

      {statsQuery.isError ? (
        <div className="p-5 rounded-2xl bg-rose-50 border-none flex items-start gap-3 text-xs text-rose-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] font-bold">
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
          <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-4 relative overflow-hidden group hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all duration-300">
            <div className="p-3 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-bold font-mono">
                Total Documents
              </span>
              <span className="text-xl font-bold text-[#3E4E63] block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_documents ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-primary/10 transition-colors" />
          </div>

          {/* Card 2: Total Chunks */}
          <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-4 relative overflow-hidden group hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all duration-300">
            <div className="p-3 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-blue-500">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-bold font-mono">
                Ingested Chunks
              </span>
              <span className="text-xl font-bold text-[#3E4E63] block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_chunks ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-blue-500/10 transition-colors" />
          </div>

          {/* Card 3: Total Queries */}
          <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-4 relative overflow-hidden group hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all duration-300">
            <div className="p-3 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-indigo-500">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-bold font-mono">
                Search Inquiries
              </span>
              <span className="text-xl font-bold text-[#3E4E63] block mt-1 font-mono">
                {statsQuery.isLoading ? "..." : stats?.total_queries ?? 0}
              </span>
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl translate-x-12 translate-y-12 group-hover:bg-indigo-500/10 transition-colors" />
          </div>

          {/* Card 4: Avg Latency */}
          <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-4 relative overflow-hidden group hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all duration-300">
            <div className="p-3 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-emerald-600">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-bold font-mono">
                Average Latency
              </span>
              <span className="text-xl font-bold text-[#3E4E63] block mt-1 font-mono">
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
