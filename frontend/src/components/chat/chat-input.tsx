"use client";

// ---------------------------------------------------------------------------
// ChatInput — prompt box with standard/strict mode toggle
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, mode: "standard" | "strict") => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"standard" | "strict">("standard");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [question]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || isStreaming) return;

    onSend(question.trim(), mode);
    setQuestion("");

    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-slate-950/60 border-t border-card-border/80"
    >
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Toggle Mode & Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Strict Toggle Button Group */}
          <div className="flex p-0.5 rounded-lg bg-slate-900 border border-card-border/60">
            <button
              type="button"
              onClick={() => setMode("standard")}
              className={cn(
                "px-3 py-1 rounded-md font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
                mode === "standard"
                  ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              STANDARD RAG
            </button>
            <button
              type="button"
              onClick={() => setMode("strict")}
              className={cn(
                "px-3 py-1 rounded-md font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
                mode === "strict"
                  ? "bg-rose-950/45 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              STRICT COMPLIANCE
            </button>
          </div>

          {/* Mode description text */}
          <div className="flex items-center gap-1.5 text-slate-500">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono text-[10px] leading-none uppercase">
              {mode === "strict"
                ? "Answers only using facts directly extracted from sources. No generalizations."
                : "Standard synthesis with smart general context reasoning & citations."}
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="relative flex items-end gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-card-border focus-within:border-accent-cyan/50 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.05)] transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Type your message, ask a question about your documents..."
            className="flex-1 max-h-[180px] bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none outline-none border-none py-2 px-3 focus:ring-0 leading-relaxed font-sans scrollbar-none"
          />

          <button
            type="submit"
            disabled={!question.trim() || isStreaming}
            className={cn(
              "p-2.5 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer",
              question.trim() && !isStreaming
                ? "bg-gradient-to-tr from-accent-indigo to-accent-violet hover:shadow-[0_0_12px_rgba(79,70,229,0.4)] text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
