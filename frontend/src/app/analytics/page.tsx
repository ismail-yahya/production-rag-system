"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, TrendingUp, Clock, Zap, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

// Mock data for visualizations
const tokenCostData = [
  { date: "07-03", input: 12000, output: 8500, cost: 0.12 },
  { date: "07-04", input: 15400, output: 10200, cost: 0.16 },
  { date: "07-05", input: 8900, output: 6100, cost: 0.09 },
  { date: "07-06", input: 22400, output: 14900, cost: 0.24 },
  { date: "07-07", input: 18100, output: 12100, cost: 0.19 },
  { date: "07-08", input: 19500, output: 13400, cost: 0.21 },
  { date: "07-09", input: 24500, output: 18200, cost: 0.28 },
];

const latencyData = [
  { date: "07-03", retrieval: 310, generation: 820, total: 1130 },
  { date: "07-04", retrieval: 340, generation: 910, total: 1250 },
  { date: "07-05", retrieval: 280, generation: 750, total: 1030 },
  { date: "07-06", retrieval: 410, generation: 1100, total: 1510 },
  { date: "07-07", retrieval: 360, generation: 980, total: 1340 },
  { date: "07-08", retrieval: 320, generation: 890, total: 1210 },
  { date: "07-09", retrieval: 300, generation: 840, total: 1140 },
];

const cacheData = [
  { name: "Cache Hits", value: 684, color: "#06B6D4" },
  { name: "Cache Misses", value: 182, color: "#4F46E5" },
];

export default function Analytics() {
  const [timeframe, setTimeframe] = useState("7d");

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-100 relative">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Analytics & Performance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Observe model costs, retrieval pipeline latency metrics, and semantic cache execution.
          </p>
        </div>

        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-slate-300 text-xs focus:outline-none focus:border-accent-cyan/40 cursor-pointer w-40"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* RAGAS & Evaluation Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Faithfulness */}
        <div className="bg-glass rounded-xl p-5 border border-card-border">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Faithfulness (RAGAS)</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/20">Target &gt;= 0.85</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-100 mt-2">0.88</h3>
          <div className="h-1.5 w-full bg-slate-950 rounded mt-3 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded" style={{ width: "88%" }} />
          </div>
        </div>

        {/* Answer Relevancy */}
        <div className="bg-glass rounded-xl p-5 border border-card-border">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Answer Relevancy</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/20">Target &gt;= 0.80</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-100 mt-2">0.84</h3>
          <div className="h-1.5 w-full bg-slate-950 rounded mt-3 overflow-hidden">
            <div className="h-full bg-accent-cyan rounded" style={{ width: "84%" }} />
          </div>
        </div>

        {/* Context Recall */}
        <div className="bg-glass rounded-xl p-5 border border-card-border">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Context Recall</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/20">Target &gt;= 0.75</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-100 mt-2">0.78</h3>
          <div className="h-1.5 w-full bg-slate-950 rounded mt-3 overflow-hidden">
            <div className="h-full bg-accent-indigo rounded" style={{ width: "78%" }} />
          </div>
        </div>

        {/* Cache Hit Ratio */}
        <div className="bg-glass rounded-xl p-5 border border-card-border">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Semantic Cache Hit Rate</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/20 text-purple-400 border border-purple-500/10">Active Cache</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-100 mt-2">82.4%</h3>
          <div className="h-1.5 w-full bg-slate-950 rounded mt-3 overflow-hidden">
            <div className="h-full bg-accent-violet rounded" style={{ width: "82.4%" }} />
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Token Cost Area Chart */}
        <div className="bg-glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-card-border pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-cyan" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Token Expenses & Cost</h2>
            </div>
            <span className="text-xs text-slate-500">Cumulative: $1.29</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokenCostData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0B0F19", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px" }}
                  labelClassName="text-slate-400 text-xs font-semibold"
                />
                <Area type="monotone" dataKey="cost" name="Cost ($)" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Line Chart */}
        <div className="bg-glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-card-border pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-indigo" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Pipeline Latency Trends</h2>
            </div>
            <span className="text-xs text-slate-500">Average: 1.25s</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0B0F19", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px" }}
                />
                <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "bold" }} />
                <Area type="monotone" dataKey="retrieval" name="Retrieval" stroke="#06B6D4" strokeWidth={1.5} fill="transparent" />
                <Area type="monotone" dataKey="total" name="Total RAG pipeline" stroke="#4F46E5" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cache Donut chart & RAGAS Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Donut Chart */}
        <div className="bg-glass rounded-xl p-6 space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-card-border pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-violet" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Cache Efficiency</h2>
            </div>
          </div>

          <div className="h-48 w-full flex justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cacheData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {cacheData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-lg font-bold text-slate-100">866</span>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Queries</p>
            </div>
          </div>

          {/* Legend Table */}
          <div className="space-y-1.5 pt-2">
            {cacheData.map((item) => (
              <div key={item.name} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-semibold text-slate-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Guidelines Card */}
        <div className="bg-glass rounded-xl p-6 lg:col-span-2 flex flex-col justify-between border border-card-border/60">
          <div className="flex items-center justify-between border-b border-card-border pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">RAGAS Quality Gate Guidelines</h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/20">
              CI Quality Gate: PASSING
            </span>
          </div>

          <div className="space-y-4 my-4 text-xs text-slate-400 leading-normal">
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-1.5 shrink-0" />
              <p>
                **Faithfulness (Current: 0.88):** Measures if the generated answer is strictly based on the retrieved document context without hallucinating external details.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-indigo mt-1.5 shrink-0" />
              <p>
                **Answer Relevancy (Current: 0.84):** Assesses if the generated response directly answers the core user question without being overly verbose or drifting off-topic.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-violet mt-1.5 shrink-0" />
              <p>
                **Context Recall (Current: 0.78):** Measures if the retrieval module extracted all necessary information from the corpus to build a complete grounded answer.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/40 border border-card-border flex gap-2 items-center text-[10px] text-slate-500">
            <AlertTriangle className="w-4 h-4 text-accent-indigo shrink-0" />
            <span>
              Evaluation pipelines execute automatically in the GitHub CI environment on every code merge to branch main.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
