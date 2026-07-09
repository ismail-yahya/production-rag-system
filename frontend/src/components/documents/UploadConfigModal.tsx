"use client";

import { useState } from "react";
import { Sliders, X, Sparkles, FolderGit2, Info } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

interface UploadConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onConfirm: (config: {
    chunker: string;
    chunkSize: number;
    chunkOverlap: number;
    workspaceId: string;
  }) => void;
}

export default function UploadConfigModal({
  isOpen,
  onClose,
  fileName,
  onConfirm,
}: UploadConfigModalProps) {
  const { workspaces, activeWorkspace } = useUIStore();
  const [chunker, setChunker] = useState("recursive");
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [workspaceId, setWorkspaceId] = useState(activeWorkspace?.id || workspaces[0]?.id || "1");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      chunker,
      chunkSize,
      chunkOverlap,
      workspaceId,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div
        className="w-full max-w-lg bg-[#0B0F19] border border-card-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: "0 10px 50px rgba(0, 0, 0, 0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-slate-950/20">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-cyan" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Ingestion Config</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="p-3 rounded-lg bg-slate-900/30 border border-card-border flex items-start gap-2.5">
            <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <div className="truncate">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Target Document</span>
              <p className="text-xs font-semibold text-slate-300 truncate" title={fileName}>
                {fileName}
              </p>
            </div>
          </div>

          {/* Chunking Strategy */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Chunking Strategy
            </label>
            <select
              value={chunker}
              onChange={(e) => setChunker(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-sm text-slate-300 focus:outline-none focus:border-accent-cyan/40"
            >
              <option value="recursive">Recursive Character Chunker</option>
              <option value="semantic">Semantic Chunker (Model-driven)</option>
              <option value="structure">Structure-Aware Chunker (PDF Tables/Sections)</option>
            </select>
            <p className="text-[10px] text-slate-500 leading-normal">
              {chunker === "recursive" && "Splits text recursively by paragraphs, sentences, and words to preserve contextual flow."}
              {chunker === "semantic" && "Uses semantic similarity matrices of embedding vectors to identify boundaries where topics change."}
              {chunker === "structure" && "Recognizes structural layouts (headers, tables, lists) to compile logically structured segments."}
            </p>
          </div>

          {/* Parameters sliders (Only show for recursive/structure) */}
          {chunker !== "semantic" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Chunk Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Chunk Size</span>
                  <span className="text-accent-cyan">{chunkSize} chars</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full accent-accent-cyan cursor-pointer"
                />
              </div>

              {/* Chunk Overlap */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Chunk Overlap</span>
                  <span className="text-accent-cyan">{chunkOverlap} chars</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="25"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  className="w-full accent-accent-cyan cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-900/10 border border-card-border/60 text-xs text-slate-400 leading-normal flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
              <span>
                Semantic chunking automatically establishes boundaries dynamically. Specific token threshold overrides are managed via settings.
              </span>
            </div>
          )}

          {/* Workspace Destination */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Workspace Scope
            </label>
            <div className="relative">
              <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border text-sm text-slate-300 focus:outline-none focus:border-accent-cyan/40"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Determines who has permission to search the document vectors and chat with this context.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-card-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Start Ingestion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
