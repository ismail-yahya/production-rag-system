"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, MessageSquare, Trash2, History, Sparkles } from "lucide-react";
import { useChatStream, CitationSource, Message } from "@/hooks/useChatStream";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput from "@/components/chat/ChatInput";
import CitationsPanel from "@/components/chat/CitationsPanel";
import { clsx } from "clsx";

// Mock past threads for the left history rail
const mockThreads = [
  { id: "thread-1", title: "Compliance remote VPN setup" },
  { id: "thread-2", title: "Q2 financial margin audit" },
  { id: "thread-3", title: "CISO firewall rules policy" },
];

export default function Chat() {
  const { messages, isLoading, sendMessage, clearChat } = useChatStream();
  const [selectedSource, setSelectedSource] = useState<CitationSource | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState("thread-new");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSourceClick = (source: CitationSource) => {
    setSelectedSource(source);
    setIsPanelOpen(true);
  };

  const handleSend = (text: string, options: any) => {
    sendMessage(text, options);
  };

  const handleNewChat = () => {
    clearChat();
    setActiveThreadId("thread-new");
    setIsPanelOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full gap-6 max-w-7xl mx-auto overflow-hidden relative">
      {/* Left Pane: Chat History Sidebar (240px width) */}
      <aside className="hidden md:flex w-60 bg-glass rounded-xl border border-card-border p-4 flex-col justify-between shrink-0 shadow-lg">
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.2)] text-xs font-semibold text-white transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* History Header */}
          <div className="flex items-center gap-1.5 px-1 pt-2 border-b border-card-border pb-2">
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Chat History
            </span>
          </div>

          {/* Chat history list */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
            <button
              onClick={() => setActiveThreadId("thread-new")}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer",
                activeThreadId === "thread-new"
                  ? "bg-slate-900 border border-card-border text-accent-cyan"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Active Conversation</span>
            </button>

            {mockThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setActiveThreadId(thread.id);
                  alert("Simulated thread retrieval. Active thread loads previous conversation snapshot.");
                }}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer",
                  activeThreadId === thread.id
                    ? "bg-slate-900 border border-card-border text-accent-cyan"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{thread.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Clear Thread Area */}
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 border border-card-border hover:bg-slate-900/50 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </aside>

      {/* Center Pane: Main Chat Console */}
      <div className="flex-1 flex flex-col bg-glass rounded-xl border border-card-border overflow-hidden relative shadow-lg">
        {/* Chat window Header */}
        <div className="px-6 py-4 border-b border-card-border bg-[#0B0F19]/40 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Interactive Query Console</h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
              Secure grounding pipeline
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
            <span>AI responses strictly grounded in context</span>
          </div>
        </div>

        {/* Messages Feed Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth min-h-0">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSourceClick={handleSourceClick}
            />
          ))}
          {isLoading && (
            <div className="flex items-start gap-4 py-4 px-2 animate-pulse">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-card-border shrink-0">
                <Sparkles className="w-4 h-4 text-accent-cyan" />
              </div>
              <div className="max-w-xl md:max-w-2xl px-5 py-4 rounded-2xl bg-glass border border-card-border/80 space-y-2 flex-1">
                <div className="h-3 w-1/4 bg-slate-800 rounded" />
                <div className="h-3 w-3/4 bg-slate-800 rounded" />
                <div className="h-3 w-1/2 bg-slate-800 rounded" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="p-6 border-t border-card-border bg-slate-950/20 shrink-0">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>

      {/* Right Drawer Panel: Citations Excerpts */}
      <CitationsPanel
        source={selectedSource}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}
