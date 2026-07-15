"use client";

// ---------------------------------------------------------------------------
// ErrorBoundary — Captures rendering crashes and provides retro recovery UI
// ---------------------------------------------------------------------------

import * as React from "react";
import { AlertTriangle, Terminal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled Error Boundary Capture:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#05070c] text-[#d1d5db] font-mono flex items-center justify-center p-6 select-text">
          <div className="max-w-2xl w-full border border-rose-500/30 rounded-xl bg-[#080b11]/80 backdrop-blur-md shadow-2xl p-6 space-y-6 relative overflow-hidden">
            {/* Retro scanline background element */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[#ef4444]/[0.01] to-transparent bg-[length:100%_4px]" />
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                  SYSTEM CORE INTEGRITY FAULT
                </h1>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Code: EXCEPTION_RENDER_CRASH (0xFD8302)
                </p>
              </div>
            </div>

            {/* Error Message Description */}
            <div className="space-y-2 text-xs">
              <p className="leading-relaxed text-slate-300 font-sans">
                A rendering exception has caused a dashboard thread process to crash. Diagnostic registers and component stack trace traces have been dumped to console logs.
              </p>
              {this.state.error && (
                <div className="p-3 bg-rose-950/20 border border-rose-500/10 text-rose-400 font-mono text-[10px] rounded-lg">
                  <span className="font-bold uppercase">Trace:</span> {this.state.error.toString()}
                </div>
              )}
            </div>

            {/* Collapsible Stack Trace details */}
            {this.state.errorInfo && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Component Stack Registry Trace
                </span>
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg max-h-48 overflow-y-auto text-[9px] text-[#00ffcc] leading-normal font-mono scrollbar-thin">
                  <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                </div>
              </div>
            )}

            {/* Footer controls */}
            <div className="flex justify-end gap-3 border-t border-rose-500/20 pt-4 text-xs">
              <Button
                onClick={this.handleReset}
                className="h-9 px-4 bg-rose-950 border border-rose-500/20 text-rose-400 hover:bg-rose-900 cursor-pointer font-mono uppercase tracking-wider flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Initialize System Reset
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
