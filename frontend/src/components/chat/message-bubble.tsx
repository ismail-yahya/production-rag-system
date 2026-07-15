"use client";

// ---------------------------------------------------------------------------
// MessageBubble — Render chat messages with Markdown, code highlighting, and citations
// ---------------------------------------------------------------------------

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, FileText, User, Sparkles } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ChatMessageResponse } from "@/types";

interface MessageBubbleProps {
  message: ChatMessageResponse;
  onCitationClick?: (index: number) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pre-process markdown to convert citation numbers [1], [2] to clickable links
  const preprocessMarkdown = (content: string) => {
    if (isUser) return content;
    // Match [1], [2], etc. (excluding links like [text](url)) and turn them into markdown links
    return content.replace(/(?<!\])\[([0-9]+)\](?![\(])/g, "[$1](#cite-$1)");
  };

  const processedContent = preprocessMarkdown(message.content);

  return (
    <div
      className={cn(
        "flex w-full gap-4 py-6 px-4 md:px-6 border-b border-card-border/40 transition-colors",
        isUser ? "bg-slate-950/20" : "bg-[#090F1E]/40"
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
          isUser
            ? "bg-slate-900 border-slate-700 text-slate-300"
            : "bg-gradient-to-br from-accent-indigo to-accent-violet border-accent-indigo/30 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Message Body */}
      <div className="flex-1 space-y-4 overflow-hidden">
        {/* Header Metadata */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 font-mono">
            {isUser ? "USER" : "AETHER AI"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              {formatDate(message.created_at)}
            </span>
            {!isUser && message.content && (
              <button
                onClick={handleCopy}
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-all cursor-pointer"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Text Content */}
        <div className="text-sm text-slate-300 leading-relaxed font-sans prose prose-invert max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                h1: ({ children }) => <h3 className="text-lg font-bold text-white mt-5 mb-2 font-mono">{children}</h3>,
                h2: ({ children }) => <h4 className="text-base font-bold text-white mt-4 mb-2 font-mono">{children}</h4>,
                h3: ({ children }) => <h5 className="text-sm font-bold text-white mt-3 mb-1 font-mono">{children}</h5>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5">{children}</ol>,
                li: ({ children }) => <li className="marker:text-accent-cyan">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="pl-4 border-l-2 border-accent-cyan bg-slate-950/40 py-2 pr-2 my-4 rounded-r italic text-slate-400">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 border border-card-border rounded-lg bg-slate-950/20">
                    <table className="min-w-full divide-y divide-card-border text-xs text-left">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-950/50">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-card-border/40">{children}</tbody>,
                tr: ({ children }) => <tr>{children}</tr>,
                th: ({ children }) => <th className="px-4 py-3 font-mono font-bold text-slate-300">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2.5 text-slate-400">{children}</td>,
                code: ({ className, children }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-slate-950 border border-card-border/40 text-accent-cyan text-xs font-mono">
                        {children}
                      </code>
                    );
                  }
                  
                  return (
                    <div className="my-4 border border-card-border rounded-xl bg-slate-950/80 overflow-hidden shadow-xl">
                      {/* Code Block Header */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-card-border bg-slate-950 font-mono text-[10px] text-slate-400">
                        <span>{match[1].toUpperCase()}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ""))}
                          className="hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      {/* Preformatted area */}
                      <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-slate-300">
                        <code className={className}>{children}</code>
                      </pre>
                    </div>
                  );
                },
                a: ({ href, children }) => {
                  const isCitation = href?.startsWith("#cite-");
                  if (href && isCitation) {
                    const citeIndex = parseInt(href.replace("#cite-", ""), 10);
                    return (
                      <button
                        onClick={() => onCitationClick?.(citeIndex)}
                        className="mx-0.5 px-1.5 py-0.5 text-[10px] font-bold font-mono rounded bg-accent-indigo/20 text-accent-cyan hover:bg-accent-indigo/40 hover:text-white border border-accent-cyan/10 transition-colors cursor-pointer align-super"
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-cyan hover:underline font-mono"
                    >
                      {children}
                    </a>
                  );
                }
              }}
            >
              {processedContent}
            </ReactMarkdown>
          )}
        </div>

        {/* Source Badges inside Bubble (if collapsed and we have sources) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[10px] text-slate-500 font-mono self-center mr-1">
              SOURCES:
            </span>
            {message.sources.map((src, i) => (
              <button
                key={i}
                onClick={() => onCitationClick?.(i + 1)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950/80 border border-card-border hover:border-accent-cyan/30 transition-all text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer font-mono"
              >
                <FileText className="w-3 h-3 text-accent-indigo" />
                <span>{src.file_name}</span>
                <span className="text-slate-600">|</span>
                <span className="text-accent-cyan">{Math.round(src.relevance_score * 100)}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
