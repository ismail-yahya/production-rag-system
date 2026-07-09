"use client";

import { CitationSource } from "@/hooks/useChatStream";
import { X, FileText, Bookmark, BarChart, FileCode, ExternalLink } from "lucide-react";
import { clsx } from "clsx";

interface CitationsPanelProps {
  source: CitationSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CitationsPanel({ source, isOpen, onClose }: CitationsPanelProps) {
  return (
    <div
      className={clsx(
        "fixed inset-y-0 right-0 w-full sm:w-[400px] bg-[#0B0F19]/95 backdrop-blur-md border-l border-card-border p-6 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col justify-between",
        isOpen && source ? "translate-x-0" : "translate-x-full"
      )}
      style={{ boxShadow: "-10px 0 30px rgba(0,0,0,0.5)" }}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-border pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-accent-cyan" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Citation Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {source && (
          <div className="space-y-6">
            {/* Document Title Card */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-card-border flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent-cyan/10 text-accent-cyan shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Document Reference
                </span>
                <p className="text-sm font-semibold text-slate-200 mt-0.5 truncate" title={source.title}>
                  {source.title}
                </p>
              </div>
            </div>

            {/* Ingestion stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Page Number */}
              <div className="p-4 rounded-xl bg-slate-950/20 border border-card-border">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Page Reference
                </span>
                <p className="text-lg font-bold text-slate-200 mt-1">
                  {source.page ? `Page ${source.page}` : "N/A"}
                </p>
              </div>

              {/* Similarity Score */}
              <div className="p-4 rounded-xl bg-slate-950/20 border border-card-border">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Match Confidence
                  </span>
                  <BarChart className="w-3.5 h-3.5 text-accent-cyan" />
                </div>
                <p className="text-lg font-bold text-accent-cyan mt-1">
                  {(source.score * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Excerpt Code-block Text */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Source Grounding Chunk
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-card-border/50 max-h-80 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                {source.snippet}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Link to Document */}
      {source && (
        <button
          onClick={() => alert(`Opening raw document: ${source.title}`)}
          className="w-full py-2.5 rounded-lg border border-card-border hover:border-accent-cyan/20 bg-slate-950/50 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer"
        >
          <span>View Source File</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
