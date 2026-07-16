"use client";

// ---------------------------------------------------------------------------
// QuickQueryDrawer — Slide-over panel displaying inline RAG query results
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryService } from "@/services/query.service";
import { chatService } from "@/services/chat.service";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Terminal,
  FileText,
  Clock,
  Cpu,
  Bookmark,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickQueryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  mode: "standard" | "strict";
}

export function QuickQueryDrawer({
  isOpen,
  onClose,
  question,
  mode,
}: QuickQueryDrawerProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logIndex, setLogIndex] = useState(0);

  const queryMutation = useMutation({
    mutationFn: async () => {
      const response = await queryService.query({
        question,
        mode,
        search_type: "hybrid",
      });
      return response.data;
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      // 1. Create a new thread
      const threadResponse = await chatService.createThread({
        title: question.length > 30 ? `${question.slice(0, 30)}...` : question,
      });
      return threadResponse.data;
    },
    onSuccess: (data) => {
      // Navigate to chat interface with the active thread
      router.push(`/chat?threadId=${data.id}`);
    },
  });

  // Reset logs and run mutation when drawer opens
  useEffect(() => {
    if (isOpen && question) {
      setLogs([]);
      setLogIndex(0);
      queryMutation.mutate();
    }
  }, [isOpen, question]);

  // Simulate terminal log outputs for loading aesthetic
  useEffect(() => {
    if (!isOpen || !queryMutation.isPending) return;

    const simulatedLogs = [
      "Connecting to Aether RAG router...",
      "Resolving security tenant scope...",
      "Retrieving grounded document embeddings...",
      "Ranking contexts using hybrid keyword & vector scores...",
      "Synthesizing answer using LLM...",
    ];

    if (logIndex < simulatedLogs.length) {
      const timer = setTimeout(() => {
        setLogs((prev) => [...prev, simulatedLogs[logIndex]]);
        setLogIndex((prev) => prev + 1);
      }, 500 + Math.random() * 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, queryMutation.isPending, logIndex]);

  const handleCopyAnswer = () => {
    if (queryMutation.data?.answer) {
      navigator.clipboard.writeText(queryMutation.data.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTransitionToChat = () => {
    createThreadMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl h-full bg-[#E6EEF8] border-l border-slate-200/50 shadow-2xl flex flex-col z-10 transition-transform duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-[#3E4E63] text-sm font-mono tracking-wide uppercase">
              RAG Execution Output
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question Summary Banner */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-card-border/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              User Request
            </span>
            <p className="text-sm font-medium text-slate-200 mt-1">{question}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider",
                mode === "strict" 
                  ? "bg-rose-950/40 border border-rose-500/20 text-rose-400" 
                  : "bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan"
              )}>
                {mode === "strict" ? "STRICT COMPLIANCE" : "STANDARD RAG"}
              </span>
            </div>
          </div>

          {/* LOADING STATE */}
          {queryMutation.isPending && (
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
                <span>Processing context search...</span>
              </div>
              <div className="space-y-1.5 pl-5 text-slate-500">
                {logs.map((log, i) => (
                  <p key={i} className="animate-fade-in">
                    <span className="text-accent-cyan">✓</span> {log}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {queryMutation.isError && (
            <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Execution Error</span>
              </div>
              <p className="text-xs text-rose-300">
                {queryMutation.error instanceof Error
                  ? queryMutation.error.message
                  : "Query processing failed. Please check backend connection."}
              </p>
            </div>
          )}

          {/* SUCCESS STATE */}
          {queryMutation.isSuccess && queryMutation.data && (
            <div className="space-y-6">
              
              {/* Answer Content */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Synthesized Grounded Answer
                  </span>
                  <button
                    onClick={handleCopyAnswer}
                    className="flex items-center gap-1.5 text-xs text-accent-cyan hover:underline cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Answer</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="p-5 rounded-xl bg-slate-950/40 border border-card-border/80 text-sm text-slate-300 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h3 className="text-lg font-bold text-white mt-4 mb-2">{children}</h3>,
                      h2: ({ children }) => <h4 className="text-base font-bold text-white mt-3 mb-1">{children}</h4>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
                      code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded bg-slate-900 text-accent-cyan text-xs font-mono">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {queryMutation.data.answer}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Source Citations */}
              {queryMutation.data.sources && queryMutation.data.sources.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Grounded Citations ({queryMutation.data.sources.length})
                  </span>
                  <div className="space-y-3">
                    {queryMutation.data.sources.map((src, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg bg-slate-900/40 border border-card-border hover:border-accent-cyan/30 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-accent-indigo shrink-0" />
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {src.file_name}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent-indigo/10 text-accent-cyan font-semibold shrink-0">
                            {Math.round(src.relevance_score * 100)}% match
                          </span>
                        </div>
                        
                        {src.section_title && (
                          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                            Section: {src.section_title}
                          </span>
                        )}
                        
                        <p className="text-xs text-slate-400 mt-2 bg-slate-950/50 p-2.5 rounded border border-card-border/50 font-sans italic line-clamp-3">
                          "{src.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Query Expansions */}
              {queryMutation.data.query_expansions && queryMutation.data.query_expansions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Query Expansion Context
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {queryMutation.data.query_expansions.map((exp, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-card-border/80"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Metrics & Actions */}
        {queryMutation.isSuccess && queryMutation.data && (
          <div className="px-6 py-4 border-t border-card-border bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-[10px]">
            {/* Technical Metrics */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
              <div className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span>Model: <span className="text-slate-400">{queryMutation.data.model}</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Latency: <span className="text-slate-400">{queryMutation.data.latency_ms}ms</span></span>
              </div>
            </div>

            {/* Transition to chat */}
            <Button
              onClick={handleTransitionToChat}
              disabled={createThreadMutation.isPending}
              variant="outline"
              className="h-8 py-0 px-3 flex items-center gap-1.5 border-card-border hover:bg-slate-900 text-slate-300 hover:text-white cursor-pointer shrink-0"
            >
              {createThreadMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin text-accent-cyan" />
              ) : (
                <ExternalLink className="w-3 h-3 text-accent-cyan" />
              )}
              <span>Continue in Chat Thread</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
