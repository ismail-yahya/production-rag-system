"use client";

import { useState } from "react";
import {
  FileText,
  Layers,
  MessageSquare,
  Clock,
  ArrowUpRight,
  Activity,
  Plus,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/store/uiStore";
import { clsx } from "clsx";

// Mock data for Dashboard metrics
const metrics = [
  {
    name: "Total Documents",
    value: "142",
    change: "+12% from last week",
    icon: FileText,
    glow: "rgba(6, 182, 212, 0.15)",
    iconColor: "text-accent-cyan",
  },
  {
    name: "Chunks Indexed",
    value: "18,492",
    change: "+1,204 today",
    icon: Layers,
    glow: "rgba(79, 70, 229, 0.15)",
    iconColor: "text-accent-indigo",
  },
  {
    name: "Queries Executed",
    value: "2,841",
    change: "+182 last 24h",
    icon: MessageSquare,
    glow: "rgba(124, 58, 237, 0.15)",
    iconColor: "text-accent-violet",
  },
  {
    name: "Avg LLM Latency",
    value: "1.24s",
    change: "-180ms optimization",
    icon: Clock,
    glow: "rgba(244, 63, 94, 0.15)",
    iconColor: "text-rose-500",
  },
];

const recentJobs = [
  {
    id: "job-1",
    fileName: "q3_financial_report.pdf",
    status: "indexed",
    size: "4.2 MB",
    time: "10 mins ago",
  },
  {
    id: "job-2",
    fileName: "employee_handbook_2026.pdf",
    status: "processing",
    size: "12.8 MB",
    time: "Running for 45s",
  },
  {
    id: "job-3",
    fileName: "unstructured_api_diagram.png",
    status: "failed",
    size: "1.5 MB",
    time: "1 hour ago",
    error: "OCR failed: Image resolution too low",
  },
  {
    id: "job-4",
    fileName: "product_specification_v4.pdf",
    status: "indexed",
    size: "8.1 MB",
    time: "2 hours ago",
  },
];

const recentQueries = [
  {
    id: "q-1",
    query: "What are the compliance guidelines for remote employees?",
    user: "john.doe@company.com",
    sources: 3,
    time: "5 mins ago",
  },
  {
    id: "q-2",
    query: "How much did revenue grow in Q2 compared to Q1?",
    user: "ismail.yahya@company.com",
    sources: 4,
    time: "12 mins ago",
  },
  {
    id: "q-3",
    query: "Who is the primary contact for API gateway configurations?",
    user: "dev.lead@company.com",
    sources: 2,
    time: "32 mins ago",
  },
];

export default function Dashboard() {
  const { activeWorkspace } = useUIStore();
  const [timeframe, setTimeframe] = useState("7d");

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title section with quick actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Welcome Back, Ismail
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Overview for the active workspace: <span className="text-accent-cyan font-medium">{activeWorkspace?.name}</span>
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-slate-300 text-sm focus:outline-none focus:border-accent-cyan/40 transition-colors"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <Link
            href="/documents"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-card-border text-sm font-medium text-slate-200 hover:text-white transition-all duration-200"
          >
            <Plus className="w-4 h-4 text-accent-cyan" />
            Upload Document
          </Link>

          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_15px_rgba(79,70,229,0.3)] text-sm font-medium text-white transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            New Chat
          </Link>
        </div>
      </div>

      {/* Metrics Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.name}
              className="bg-glass rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-700/50"
              style={{
                boxShadow: `0 4px 30px rgba(0, 0, 0, 0.4), inset 0 0 12px ${metric.glow}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  {metric.name}
                </span>
                <div className={`p-2 rounded-lg bg-slate-950/40 border border-card-border ${metric.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{metric.value}</h3>
                <span className="text-emerald-500 text-xs mt-1 block font-medium">{metric.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visualizations and Feed panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart Placeholder */}
        <div className="bg-glass rounded-xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-card-border pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent-cyan" />
              <h2 className="text-lg font-bold text-slate-200">Query & Ingestion Activity</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">Real-time telemetry</span>
          </div>

          {/* Interactive placeholder area with sleek CSS visualizer */}
          <div className="h-64 rounded-lg bg-slate-950/50 border border-card-border/50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Visual glow element */}
            <div className="absolute w-72 h-72 rounded-full bg-accent-indigo/10 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            
            {/* Simulated bar chart layout */}
            <div className="flex items-end gap-3 w-full h-40 max-w-md relative z-10">
              {[45, 60, 30, 80, 55, 95, 65, 40, 85, 75, 90, 110, 80].map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div 
                    className="w-full rounded-t bg-gradient-to-t from-accent-indigo/80 to-accent-cyan/90 transition-all duration-500 hover:brightness-125"
                    style={{ height: `${(val / 120) * 100}%` }}
                    title={`Day ${idx + 1}: ${val} queries`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between w-full max-w-md mt-4 text-[10px] text-slate-500 font-bold uppercase relative z-10 px-1">
              <span>July 02</span>
              <span>July 09 (Today)</span>
            </div>
          </div>
        </div>

        {/* System Health / Status Stats */}
        <div className="bg-glass rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-card-border pb-4 mb-4">
            <CheckCircle2 className="w-5 h-5 text-accent-violet" />
            <h2 className="text-lg font-bold text-slate-200">System Telemetry</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-400">PostgreSQL Pool Utilization</span>
                <span className="text-slate-200">12% (3/25 connections)</span>
              </div>
              <div className="h-2 rounded bg-slate-900 overflow-hidden border border-card-border">
                <div className="h-full bg-accent-indigo rounded" style={{ width: "12%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-400">Redis Cache Hit Rate</span>
                <span className="text-slate-200">84.2%</span>
              </div>
              <div className="h-2 rounded bg-slate-900 overflow-hidden border border-card-border">
                <div className="h-full bg-accent-violet rounded" style={{ width: "84.2%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-400">Qdrant Vector Index Size</span>
                <span className="text-slate-200">22.4 MB</span>
              </div>
              <div className="h-2 rounded bg-slate-900 overflow-hidden border border-card-border">
                <div className="h-full bg-accent-cyan rounded" style={{ width: "42%" }} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-card-border/50 mt-4 text-xs text-slate-500 flex items-center justify-between">
            <span>Uptime: 99.98%</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Live sync
            </span>
          </div>
        </div>
      </div>

      {/* Tables - Jobs and Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ingestion Jobs Feed */}
        <div className="bg-glass rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-card-border pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-200">Recent Ingestion Jobs</h2>
            <Link href="/documents" className="text-xs text-accent-cyan hover:underline flex items-center gap-1">
              View all documents <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-card-border/50">
            {recentJobs.map((job) => (
              <div key={job.id} className="py-3 flex items-center justify-between gap-4">
                <div className="truncate">
                  <p className="text-sm font-medium text-slate-300 truncate">{job.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-medium">{job.size}</span>
                    <span className="text-slate-600 text-xs">•</span>
                    <span className="text-[10px] text-slate-500 font-medium">{job.time}</span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  <span
                    className={clsx(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                      job.status === "indexed" && "bg-emerald-950/40 text-emerald-400 border-emerald-500/20",
                      job.status === "processing" && "bg-amber-950/40 text-amber-400 border-amber-500/20",
                      job.status === "failed" && "bg-rose-950/40 text-rose-400 border-rose-500/20"
                    )}
                  >
                    {job.status}
                  </span>
                  {job.status === "failed" && (
                    <span className="text-[10px] text-rose-400/80 mt-1 max-w-[150px] truncate" title={job.error}>
                      {job.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Queries Feed */}
        <div className="bg-glass rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-card-border pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-200">Recent User Queries</h2>
            <Link href="/chat" className="text-xs text-accent-cyan hover:underline flex items-center gap-1">
              Open chat console <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-card-border/50">
            {recentQueries.map((query) => (
              <div key={query.id} className="py-3 flex items-center justify-between gap-4">
                <div className="truncate">
                  <p className="text-sm font-medium text-slate-300 truncate" title={query.query}>
                    "{query.query}"
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-medium">{query.user}</span>
                    <span className="text-slate-600 text-xs">•</span>
                    <span className="text-[10px] text-slate-500 font-medium">{query.time}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-[10px] bg-slate-900 border border-card-border text-slate-400 px-2 py-0.5 rounded font-medium">
                    {query.sources} sources
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
