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
      className="p-4 bg-[#E6EEF8] border-t border-slate-200/50"
    >
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Toggle Mode & Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Strict Toggle Button Group */}
          <div className="flex p-0.5 rounded-xl bg-[#E6EEF8] shadow-[inset_1px_1px_3px_#c2d0e6,inset_-1px_-1px_3px_#ffffff]">
            <button
              type="button"
              onClick={() => setMode("standard")}
              className={cn(
                "px-3 py-1 rounded-lg font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
                mode === "standard"
                  ? "bg-[#E6EEF8] text-primary shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff]"
                  : "text-[#7A8C9E] hover:text-[#3E4E63]"
              )}
            >
              STANDARD RAG
            </button>
            <button
              type="button"
              onClick={() => setMode("strict")}
              className={cn(
                "px-3 py-1 rounded-lg font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
                mode === "strict"
                  ? "bg-rose-100 text-rose-600 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff]"
                  : "text-[#7A8C9E] hover:text-[#3E4E63]"
              )}
            >
              STRICT COMPLIANCE
            </button>
          </div>

          {/* Mode description text */}
          <div className="flex items-center gap-1.5 text-[#7A8C9E]">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono text-[10px] leading-none uppercase">
              {mode === "strict"
                ? "Answers only using facts directly extracted from sources. No generalizations."
                : "Standard synthesis with smart general context reasoning & citations."}
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="relative flex items-end gap-2 p-1.5 rounded-2xl bg-[#E6EEF8] shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] focus-within:shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff,0_0_0_2px_rgba(66,165,245,0.5)] transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Type your message, ask a question about your documents..."
            className="flex-1 max-h-[180px] bg-transparent text-sm text-[#3E4E63] placeholder-slate-400 resize-none outline-none border-none py-2 px-3 focus:ring-0 leading-relaxed font-sans scrollbar-none"
          />

          <button
            type="submit"
            disabled={!question.trim() || isStreaming}
            className={cn(
              "p-2.5 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer",
              question.trim() && !isStreaming
                ? "bg-gradient-to-r from-blue-400 to-blue-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-white hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)]"
                : "bg-[#E6EEF8] shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-400 cursor-not-allowed"
            )}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
