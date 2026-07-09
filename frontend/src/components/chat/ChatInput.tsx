"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sliders, Sparkles, AlertCircle } from "lucide-react";
import { clsx } from "clsx";

interface ChatInputProps {
  onSend: (text: string, options: { model: string; temperature: number; queryExpansion: boolean; mockMode: boolean }) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  
  // Input configuration overrides
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.2);
  const [queryExpansion, setQueryExpansion] = useState(true);
  const [mockMode, setMockMode] = useState(true); // Default to true so it works out-of-the-box locally

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize input height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;

    onSend(text, { model, temperature, queryExpansion, mockMode });
    setText("");
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full space-y-3 relative">
      {/* Option settings panel */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-glass border border-card-border shadow-2xl absolute bottom-full left-0 right-0 mb-3 z-20 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-1.5 border-b border-card-border pb-2">
            <Sliders className="w-4 h-4 text-accent-cyan" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Query Configuration</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* LLM Provider */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Model Provider
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40"
              >
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Anthropic Claude 3.5</option>
                <option value="gemini-1-5-pro">Gemini 1.5 Pro</option>
                <option value="ollama-local">Ollama (Local LLM)</option>
              </select>
            </div>

            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Temperature</span>
                <span className="text-accent-cyan">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-accent-cyan cursor-pointer mt-1"
              />
            </div>

            {/* Query Expansion Toggle */}
            <div className="flex items-center justify-between sm:justify-center gap-3">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Query Expansion
                </span>
                <span className="text-[10px] text-slate-400">Generate alternatives</span>
              </div>
              <button
                type="button"
                onClick={() => setQueryExpansion(!queryExpansion)}
                className={clsx(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  queryExpansion ? "bg-accent-cyan" : "bg-slate-800"
                )}
              >
                <span
                  className={clsx(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    queryExpansion ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Mock Mode Toggle */}
            <div className="flex items-center justify-between sm:justify-center gap-3">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Simulation Engine
                </span>
                <span className="text-[10px] text-slate-400">Run offline mock</span>
              </div>
              <button
                type="button"
                onClick={() => setMockMode(!mockMode)}
                className={clsx(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  mockMode ? "bg-accent-violet" : "bg-slate-800"
                )}
              >
                <span
                  className={clsx(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    mockMode ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main text input form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-3 p-2 rounded-xl bg-glass border border-card-border shadow-xl relative"
        style={{ boxShadow: "0 4px 30px rgba(0, 0, 0, 0.4)" }}
      >
        {/* Toggle options buttons */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={clsx(
            "p-2.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-card-border text-slate-400 hover:text-slate-200 transition-colors shrink-0",
            showSettings && "bg-slate-900 border-card-border text-accent-cyan"
          )}
          title="Query settings"
        >
          <Sliders className="w-4.5 h-4.5" />
        </button>

        {/* Input Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your indexed files..."
          disabled={isLoading}
          className="flex-1 max-h-[180px] min-h-[40px] py-2 px-2 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-slate-200 placeholder-slate-500 overflow-y-auto leading-relaxed"
        />

        {/* Action Button */}
        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="p-2.5 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {isLoading ? (
            <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4.5 h-4.5" />
          )}
        </button>
      </form>
      
      {/* Simulation active status alert */}
      {mockMode && (
        <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-end gap-1 px-1">
          <Sparkles className="w-3 h-3 text-accent-cyan shrink-0" />
          <span>Local Simulation Active (Word-by-word streaming offline template)</span>
        </div>
      )}
    </div>
  );
}
