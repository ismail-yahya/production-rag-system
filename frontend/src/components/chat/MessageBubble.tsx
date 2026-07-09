"use client";

import { Message, CitationSource } from "@/hooks/useChatStream";
import { User, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface MessageBubbleProps {
  message: Message;
  onSourceClick: (source: CitationSource) => void;
}

export default function MessageBubble({ message, onSourceClick }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Parse text content and replace [Source X] patterns with clickable styled buttons
  const renderFormattedContent = () => {
    const text = message.content;
    const sources = message.sources || [];
    
    if (!text) return null;
    
    // Regex splits matching [Source X] patterns, capturing them so they are included in the parts array
    const parts = text.split(/(\[Source \d+\])/g);
    
    return parts.map((part, index) => {
      const match = part.match(/\[Source (\d+)\]/);
      if (match) {
        const sourceIndex = parseInt(match[1], 10) - 1;
        const sourceObj = sources[sourceIndex];
        
        if (sourceObj) {
          return (
            <button
              key={index}
              onClick={() => onSourceClick(sourceObj)}
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[10px] font-bold rounded bg-accent-cyan/15 hover:bg-accent-cyan/25 text-accent-cyan border border-accent-cyan/30 hover:border-accent-cyan/60 shadow-[0_0_8px_rgba(6,182,212,0.1)] transition-all cursor-pointer select-none align-middle"
            >
              {match[1]}
            </button>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={clsx("flex items-start gap-4 py-4 px-2 hover:bg-slate-900/10 rounded-xl transition-colors", isUser && "justify-end")}>
      {/* Bot Icon */}
      {!isUser && (
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-indigo to-accent-violet border border-accent-indigo/20 text-white shrink-0 shadow-[0_0_12px_rgba(79,70,229,0.3)]">
          <Sparkles className="w-4 h-4 text-accent-cyan" />
        </div>
      )}

      {/* Bubble container */}
      <div className={clsx(
        "max-w-xl md:max-w-2xl px-5 py-3.5 rounded-2xl text-sm leading-relaxed border relative",
        isUser
          ? "bg-gradient-to-br from-accent-indigo/90 to-accent-indigo border-accent-indigo/50 text-white rounded-tr-none shadow-[0_4px_20px_rgba(79,70,229,0.15)]"
          : "bg-glass border-card-border/80 text-slate-200 rounded-tl-none"
      )}>
        {/* Glow helper for AI assistant */}
        {!isUser && (
          <div className="absolute w-20 h-20 rounded-full bg-accent-cyan/5 blur-xl -top-5 -left-5 pointer-events-none" />
        )}
        
        {/* Content */}
        <p className="whitespace-pre-line leading-relaxed font-normal tracking-wide">
          {isUser ? message.content : renderFormattedContent()}
        </p>

        {/* Citations metadata display at the bottom if any */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-card-border/30">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider self-center mr-1">
              Referenced Sources:
            </span>
            {message.sources.map((src, idx) => (
              <button
                key={src.id}
                onClick={() => onSourceClick(src)}
                className="text-[10px] text-slate-400 hover:text-accent-cyan bg-slate-900/60 hover:bg-slate-900 border border-card-border hover:border-accent-cyan/30 px-2 py-1 rounded transition-all cursor-pointer truncate max-w-[160px]"
                title={`${src.title} - Page ${src.page || "N/A"}`}
              >
                {idx + 1}. {src.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Icon */}
      {isUser && (
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-card-border text-slate-400 shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
