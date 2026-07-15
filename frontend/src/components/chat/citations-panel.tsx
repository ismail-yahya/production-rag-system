"use client";

// ---------------------------------------------------------------------------
// CitationsPanel — Expandable right panel showing RAG retrieval source documents
// ---------------------------------------------------------------------------

import { FileText, X, Bookmark, Compass, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSource } from "@/types";

interface CitationsPanelProps {
  sources: ChatSource[] | null;
  highlightedIndex: number | null;
  onClose: () => void;
  isOpen: boolean;
}

export function CitationsPanel({
  sources,
  highlightedIndex,
  onClose,
  isOpen,
}: CitationsPanelProps) {
  if (!isOpen) return null;

  return (
    <aside className="w-80 h-full border-l border-card-border/80 bg-[#080E1A] flex flex-col shrink-0 animate-fade-in relative z-10">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-card-border bg-slate-950/20">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-cyan" />
          <h2 className="font-semibold text-slate-200 text-xs font-mono uppercase tracking-wider">
            Grounded Context
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!sources || sources.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Compass className="w-8 h-8 text-slate-700 animate-pulse" />
            <p className="text-xs font-mono uppercase">No source retrieved</p>
            <p className="text-[11px] text-slate-600 font-sans max-w-[180px]">
              Ask a question to see the matching document chunks referenced by the AI.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">
              Retrieved Chunks ({sources.length})
            </span>
            
            {sources.map((src, index) => {
              const displayIndex = index + 1;
              const isHighlighted = highlightedIndex === displayIndex;

              return (
                <div
                  key={index}
                  id={`citation-${displayIndex}`}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-300 space-y-3",
                    isHighlighted
                      ? "bg-accent-indigo/10 border-accent-cyan shadow-[0_0_15px_rgba(6,182,212,0.1)] scale-[1.02]"
                      : "bg-slate-950/40 border-card-border/60 hover:border-card-border"
                  )}
                >
                  {/* File Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex items-center justify-center w-5 h-5 rounded bg-slate-900 border border-card-border font-mono text-[10px] font-bold text-accent-cyan">
                        {displayIndex}
                      </span>
                      <FileText className="w-4 h-4 text-accent-indigo shrink-0" />
                      <span
                        className="text-xs font-semibold text-slate-200 truncate"
                        title={src.file_name}
                      >
                        {src.file_name}
                      </span>
                    </div>
                    
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold font-mono tracking-wider bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan shrink-0">
                      {Math.round(src.relevance_score * 100)}% Match
                    </span>
                  </div>

                  {/* Section / Page references */}
                  {(src.section_title || src.page_number) && (
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500 border-t border-card-border/40 pt-2">
                      {src.section_title && (
                        <span className="truncate max-w-[150px]">
                          SEC: {src.section_title}
                        </span>
                      )}
                      {src.page_number && (
                        <span>
                          PG: {src.page_number}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Text Chunk Snippet */}
                  <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-card-border/30 font-sans italic leading-relaxed relative">
                    <Bookmark className="w-3.5 h-3.5 text-slate-700 absolute -top-1 right-2" />
                    <p className="line-clamp-6">&quot;{src.snippet}&quot;</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
