"use client";

// ---------------------------------------------------------------------------
// Header — breadcrumbs, health indicators, workspace scope display
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Server, Cpu, Database, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

export function Header() {
  const pathname = usePathname();
  const [dbHealthy, setDbHealthy] = useState(true);
  const [qdrantHealthy, setQdrantHealthy] = useState(true);
  const [redisHealthy, setRedisHealthy] = useState(true);

  // Poll /ready endpoint every 30s
  useEffect(() => {
    const checkReadiness = async () => {
      try {
        const response = await fetch("/api/ready");
        if (response.ok) {
          setDbHealthy(true);
          setQdrantHealthy(true);
          setRedisHealthy(true);
        } else {
          const data = await response.json();
          const detail = data.detail ?? "";
          setDbHealthy(!detail.includes("Database"));
          setQdrantHealthy(!detail.includes("Vector store"));
          setRedisHealthy(true);
        }
      } catch {
        setDbHealthy(false);
        setQdrantHealthy(false);
        setRedisHealthy(false);
      }
    };
    checkReadiness();
    const interval = setInterval(checkReadiness, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Build breadcrumbs from pathname
  const breadcrumbs = (() => {
    const paths = pathname.split("/").filter(Boolean);
    if (paths.length === 0) return [{ name: "Dashboard", href: "/" }];

    const crumbs = [{ name: "Dashboard", href: "/" }];
    let current = "";
    for (const p of paths) {
      current += `/${p}`;
      const name = p
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      crumbs.push({ name, href: current });
    }
    return crumbs;
  })();

  const { toggleMobileSidebar } = useUIStore();

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-slate-200/50 bg-[#E6EEF8] sticky top-0 z-20">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-sm">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-1 mr-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {breadcrumbs.map((bc, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <div key={bc.href} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-400">/</span>}
              <span
                className={cn(
                  "font-medium",
                  isLast
                    ? "text-[#3E4E63] font-bold"
                    : "text-[#7A8C9E] hover:text-[#3E4E63] transition-colors"
                )}
              >
                {bc.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Health Indicators */}
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff]">
        <HealthDot label="PostgreSQL" healthy={dbHealthy} icon={Database} iconColor="text-[#7A8C9E]" />
        <div className="w-px h-3 bg-slate-200/50" />
        <HealthDot label="Qdrant" healthy={qdrantHealthy} icon={Cpu} iconColor="text-[#7A8C9E]" />
        <div className="w-px h-3 bg-slate-200/50" />
        <HealthDot label="Redis" healthy={redisHealthy} icon={Server} iconColor="text-[#7A8C9E]" />
      </div>
    </header>
  );
}

function HealthDot({
  label,
  healthy,
  icon: Icon,
  iconColor,
}: {
  label: string;
  healthy: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      title={healthy ? `${label} Connected` : `${label} Disconnected`}
    >
      <Icon className={cn("w-3.5 h-3.5", healthy ? iconColor : "text-rose-500")} />
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            healthy ? "bg-emerald-400" : "bg-rose-400"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            healthy ? "bg-emerald-500" : "bg-rose-500"
          )}
        />
      </span>
    </div>
  );
}
