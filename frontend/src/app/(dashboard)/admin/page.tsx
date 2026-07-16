"use client";

// ---------------------------------------------------------------------------
// AdminPage — Administration panel coordinating user db, audits, evaluations & tenant configs
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { hasMinRole } from "@/lib/constants";
import { UsersTable } from "@/components/admin/users-table";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { StatsCards } from "@/components/admin/stats-cards";
import { EvalPanel } from "@/components/admin/eval-panel";
import { ConfigForm } from "@/components/admin/config-form";
import {
  ShieldAlert,
  Users,
  Terminal,
  Activity,
  Sliders,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "stats" | "eval" | "config">("users");

  // Route protection: only ADMIN or SUPER_ADMIN
  useEffect(() => {
    if (!isLoading && (!user || !hasMinRole(user.role, "ADMIN"))) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-3 text-[#5A6E85]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-[10px] font-mono uppercase font-bold">Hydrating administrative credentials...</span>
        </div>
      </div>
    );
  }

  // Double check authorization
  if (!user || !hasMinRole(user.role, "ADMIN")) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border-none flex items-center justify-center text-rose-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-rose-600 uppercase font-mono tracking-wider">
            Unauthorized Operator Access
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            You do not possess the required security keys to interface with this console. This event has been dispatched to the audit ledgers.
          </p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      
      {/* Console Header */}
      <div>
        <h1 className="text-xl font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
          Administration Console
        </h1>
        <p className="text-xs text-[#7A8C9E] font-sans mt-1">
          Manage system directories, review audit transcripts, check telemetry, and configuration settings.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap border-b border-slate-200/50">
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "users"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Users className="w-4 h-4" />
          Operator Directory
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "logs"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Terminal className="w-4 h-4" />
          Audit Ledger
        </button>

        <button
          onClick={() => setActiveTab("stats")}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "stats"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Activity className="w-4 h-4" />
          Telemetry Stats
        </button>

        <button
          onClick={() => setActiveTab("eval")}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "eval"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Award className="w-4 h-4" />
          RAGAS Evaluation
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("config")}
            className={cn(
              "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
              activeTab === "config"
                ? "border-primary text-primary bg-blue-50/20"
                : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
            )}
          >
            <Sliders className="w-4 h-4" />
            Tenant Blueprint
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="py-2">
        {activeTab === "users" && <UsersTable />}
        {activeTab === "logs" && <AuditLogTable />}
        {activeTab === "stats" && <StatsCards />}
        {activeTab === "eval" && <EvalPanel />}
        {activeTab === "config" && isSuperAdmin && <ConfigForm />}
      </div>

    </div>
  );
}
