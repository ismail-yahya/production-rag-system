"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore, Workspace } from "@/store/uiStore";
import { FolderGit2, LogOut, LayoutGrid, Plus, ArrowRight } from "lucide-react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export default function SelectWorkspace() {
  const router = useRouter();
  const { workspaces, setWorkspaces, setActiveWorkspace } = useUIStore();
  const [localWorkspaces, setLocalWorkspaces] = useState<Workspace[]>(workspaces);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      const token = getCookie("session_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch("/api/v1/workspaces", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const mapped = data.map((ws: any) => ({
              id: ws.id,
              name: ws.name,
              type: ws.workspace_type.toLowerCase() as any,
            }));
            setLocalWorkspaces(mapped);
            setWorkspaces(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to fetch workspaces from API, using defaults:", err);
      }
    };

    fetchWorkspaces();
  }, [router, setWorkspaces]);

  const handleSelect = (ws: Workspace) => {
    // Write active workspace ID to cookie so middleware can read it on next page loads
    document.cookie = `active_workspace_id=${ws.id}; path=/; max-age=86400; SameSite=Lax`;
    setActiveWorkspace(ws);
    router.push("/");
  };

  const handleSignOut = () => {
    // Clear cookies
    document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "active_workspace_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-[#070A10] text-slate-100 p-6 font-sans relative overflow-hidden">
      {/* Visual background glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-indigo/10 blur-[80px] -top-40 -left-40" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-cyan/5 blur-[80px] -bottom-40 -right-40" />

      <div className="w-full max-w-2xl space-y-8 relative z-10">
        {/* Top header block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-indigo to-accent-violet">
              <FolderGit2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-wider text-slate-200">AETHER PORTAL</span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-lg border border-card-border hover:bg-slate-900"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Title text */}
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Select Workspace</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Aether RAG scopes search queries, documents, and logs to your active workspace. Select a workspace partition to enter.
          </p>
        </div>

        {/* Grid of Workspaces */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localWorkspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws)}
              className="group text-left p-6 rounded-xl bg-glass border border-card-border/60 hover:border-accent-cyan/30 hover:bg-slate-900/35 transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between h-44 shadow-xl"
              style={{
                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.4)",
              }}
            >
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-slate-950/45 border border-card-border group-hover:border-accent-cyan/20 text-accent-cyan transition-colors">
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-card-border text-slate-400">
                    {ws.type}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-200 mt-4 group-hover:text-white transition-colors">
                  {ws.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {ws.type === "central" 
                    ? "Centralized repository for global organization-wide document search."
                    : ws.type === "team"
                    ? "Shared environment for department documentation, assets, and QA."
                    : "Private sandbox for individual user analysis and personal file search."}
                </p>
              </div>

              <div className="flex items-center justify-end w-full pt-4 border-t border-card-border/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] font-bold text-accent-cyan flex items-center gap-1">
                  Enter Workspace <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}

          {/* Add Workspace Action Card */}
          <button
            onClick={() => alert("Create workspace modal is part of Milestone 3/Workspaces Page.")}
            className="text-left p-6 rounded-xl border border-dashed border-card-border hover:border-accent-cyan/30 hover:bg-slate-900/10 transition-all duration-300 flex flex-col items-center justify-center h-44 gap-3 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <div className="p-3 rounded-full bg-slate-950/30 border border-card-border">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold">Create New Workspace</span>
          </button>
        </div>

        {/* System telemetry warning */}
        <div className="p-4 rounded-xl bg-slate-900/20 border border-card-border/40 text-[11px] text-slate-500 leading-normal flex items-start gap-2.5">
          <LayoutGrid className="w-4 h-4 shrink-0 text-slate-400" />
          <span>
            Workspace scopes cannot cross-contaminate. Switching workspaces re-calculates all vector similarity search thresholds and invalidates cached prompt contexts automatically.
          </span>
        </div>
      </div>
    </div>
  );
}
