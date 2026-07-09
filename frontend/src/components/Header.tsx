"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Server, Cpu, Database, AlertCircle } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { clsx } from "clsx";

export default function Header() {
  const pathname = usePathname();
  const { activeWorkspace } = useUIStore();

  // Convert pathname to readable breadcrumbs
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);
    if (paths.length === 0) return [{ name: "Dashboard", href: "/" }];

    const breadcrumbs = [{ name: "Dashboard", href: "/" }];
    let currentPath = "";

    paths.forEach((p, idx) => {
      currentPath += `/${p}`;
      const name = p
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      breadcrumbs.push({ name, href: currentPath });
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-card-border bg-[#070A10]/80 backdrop-blur-md sticky top-0 z-20">
      {/* Breadcrumbs / Left side */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 font-medium">
          {activeWorkspace?.name || "Global"}
        </span>
        <span className="text-slate-600">/</span>
        {breadcrumbs.map((bc, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <div key={bc.href} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-600">/</span>}
              <span
                className={clsx(
                  "font-medium",
                  isLast ? "text-slate-200" : "text-slate-400 hover:text-slate-200 transition-colors"
                )}
              >
                {bc.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right side actions and health status */}
      <div className="flex items-center gap-6">
        {/* Quick Search */}
        <div className="relative max-w-xs hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Quick search... (Cmd+K)"
            className="w-64 pl-9 pr-4 py-1.5 rounded-lg bg-slate-900/50 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-300 placeholder-slate-500 transition-colors"
          />
        </div>

        {/* System Health Indicators */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/50 border border-card-border">
          <div className="flex items-center gap-1.5" title="PostgreSQL Status">
            <Database className="w-3.5 h-3.5 text-accent-indigo" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="w-px h-3 bg-card-border" />

          <div className="flex items-center gap-1.5" title="Qdrant Vector Store Status">
            <Cpu className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="w-px h-3 bg-card-border" />

          <div className="flex items-center gap-1.5" title="Redis Cache Status">
            <Server className="w-3.5 h-3.5 text-accent-violet" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-slate-900 border border-card-border hover:border-accent-cyan/20 text-slate-400 hover:text-slate-200 transition-all duration-200">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent-cyan rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
        </button>
      </div>
    </header>
  );
}
