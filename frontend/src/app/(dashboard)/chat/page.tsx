"use client";

// ---------------------------------------------------------------------------
// ChatPage — Main layout coordinating history, bubbles, inputs & citations
// ---------------------------------------------------------------------------

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ThreadSidebar } from "@/components/chat/thread-sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { CitationsPanel } from "@/components/chat/citations-panel";
import { 
  Terminal, 
  BookOpen, 
  HelpCircle,
  AlertCircle,
  MessageSquareCode,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ threadId?: string }>;
}

export default function ChatPage({ searchParams }: PageProps) {
  const router = useRouter();
  
  // Unwrap Next.js searchParams
  const { threadId: rawThreadId } = React.use(searchParams);
  const activeThreadId = rawThreadId || null;

  // Citations panel toggles
  const [isCitationsOpen, setIsCitationsOpen] = useState(true);
  const [highlightedCitationIndex, setHighlightedCitationIndex] = useState<number | null>(null);

  // Hook for handling SSE stream
  const {
    messages,
    isLoading,
    isStreaming,
    error: streamError,
    sendMessage,
  } = useChatStream(activeThreadId);

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Handle thread selection
  const handleSelectThread = (id: string | null) => {
    if (id) {
      router.push(`/chat?threadId=${id}`);
    } else {
      router.push("/chat");
    }
  };

  // Find the sources for the active display
  // We prioritize the last assistant message's sources
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const activeSources = lastAssistantMessage?.sources || null;

  // Handle clicking inline citation badges in message bubble
  const handleCitationClick = (index: number) => {
    setIsCitationsOpen(true);
    setHighlightedCitationIndex(index);
    
    // Scroll to the citation card inside the citations panel
    setTimeout(() => {
      const element = document.getElementById(`citation-${index}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    // Clear highlight after some time
    setTimeout(() => {
      setHighlightedCitationIndex(null);
    }, 3000);
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      
      {/* 1. Left Conversation History Sidebar */}
      <ThreadSidebar
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#070A10]/30 min-w-0">
        
        {/* Chat Area Header */}
        <div className="h-14 px-6 border-b border-card-border/60 bg-[#070A10]/50 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-cyan" />
            <h1 className="font-semibold text-xs font-mono uppercase text-slate-300 tracking-wider">
              {activeThreadId ? "Secure RAG Console" : "Select Conversation"}
            </h1>
          </div>

          {activeThreadId && (
            <div className="flex items-center gap-2">
              {/* Citations panel toggle */}
              <button
                onClick={() => setIsCitationsOpen(!isCitationsOpen)}
                className={cn(
                  "p-1.5 rounded-lg flex items-center gap-1 text-xs font-mono transition-all border cursor-pointer",
                  isCitationsOpen
                    ? "bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan"
                    : "border-card-border/60 text-slate-500 hover:text-slate-300"
                )}
                title="Toggle Citations"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px] font-bold">CITATIONS</span>
              </button>
            </div>
          )}
        </div>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!activeThreadId ? (
            /* Empty State: No Thread Selected */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-card-border/80 flex items-center justify-center text-slate-400 shadow-xl">
                <MessageSquareCode className="w-6 h-6 text-accent-cyan animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider">
                  Knowledge Base Terminal
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Select an existing conversation from the history sidebar, or click the <span className="font-bold text-slate-300 font-mono">NEW</span> button to start a fresh thread scoped to a specific workspace.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-4">
                <div className="p-4 rounded-xl bg-slate-950/40 border border-card-border/50 space-y-1 font-sans">
                  <span className="text-[9px] font-bold text-accent-indigo font-mono uppercase block">Standard mode</span>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Answers queries using document contexts, synthesizing additional general facts when helpful.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/40 border border-card-border/50 space-y-1 font-sans">
                  <span className="text-[9px] font-bold text-rose-400 font-mono uppercase block">Strict compliance</span>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Answers strictly with document information, raising explicit notices on missing references.
                  </p>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            /* Loading State: Loading messages */
            <div className="h-full flex flex-col items-center justify-center space-y-3 text-slate-500">
              <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-mono uppercase">Retrieving transcript...</span>
            </div>
          ) : (
            /* Active Conversation Bubble Stream */
            <div className="w-full flex flex-col">
              {messages.length === 0 ? (
                /* Thread empty state */
                <div className="p-8 text-center text-slate-500 font-mono space-y-2 max-w-md mx-auto mt-12">
                  <Sparkles className="w-6 h-6 text-accent-indigo mx-auto animate-pulse" />
                  <p className="text-xs uppercase">Terminal Initialized</p>
                  <p className="text-[10px] text-slate-600 font-sans">
                    Scope validated. Type your question below to search local index.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onCitationClick={handleCitationClick}
                  />
                ))
              )}

              {/* Streaming Indicator */}
              {isStreaming && !lastAssistantMessage?.content && (
                <div className="flex w-full gap-4 py-6 px-4 md:px-6 border-b border-card-border/40 bg-[#090F1E]/20">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-gradient-to-br from-accent-indigo to-accent-violet border-accent-indigo/30 text-white animate-pulse">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      AETHER AI
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <span className="w-2 h-2 rounded-full bg-accent-cyan animate-ping" />
                      <span>Synthesizing fact-grounded response...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stream Error Alert */}
              {streamError && (
                <div className="p-4 m-4 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-rose-400 font-mono uppercase">
                      Streaming Pipeline Interrupted
                    </h4>
                    <p className="text-xs text-rose-300 font-sans">
                      {streamError}
                    </p>
                  </div>
                </div>
              )}

              {/* Dummy bottom ref for scroll */}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Message Input box */}
        {activeThreadId && (
          <ChatInput
            onSend={sendMessage}
            isStreaming={isStreaming}
          />
        )}
      </div>

      {/* 3. Right Grounded Citations Drawer */}
      {activeThreadId && (
        <CitationsPanel
          sources={activeSources}
          highlightedIndex={highlightedCitationIndex}
          onClose={() => setIsCitationsOpen(false)}
          isOpen={isCitationsOpen}
        />
      )}

    </div>
  );
}
