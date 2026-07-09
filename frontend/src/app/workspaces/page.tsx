"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FolderGit2, Plus, Users, FileText, Calendar, ArrowRight, X, Sparkles } from "lucide-react";
import { useUIStore, Workspace } from "@/store/uiStore";
import { clsx } from "clsx";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export default function Workspaces() {
  const { workspaces, setWorkspaces } = useUIStore();
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"central" | "team" | "personal">("team");

  const fetchWorkspaces = async () => {
    const token = getCookie("session_token");
    if (!token) return;

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
          setWorkspaces(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch workspaces from API:", err);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          workspace_type: type.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create workspace.");
      }

      await fetchWorkspaces();
      setName("");
      setType("team");
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Workspace creation failed: ${err.message}`);
    }
  };

  // Mock workspace counts to enrich cards visual metadata
  const getMockMetadata = (wsId: string, wsType: string) => {
    switch (wsId) {
      case "1":
        return { docs: 8, members: 16, date: "2026-07-02" };
      case "2":
        return { docs: 12, members: 8, date: "2026-07-04" };
      case "3":
        return { docs: 6, members: 4, date: "2026-07-05" };
      case "4":
        return { docs: 3, members: 1, date: "2026-07-06" };
      default:
        return { 
          docs: 0, 
          members: wsType === "personal" ? 1 : 2, 
          date: new Date().toISOString().slice(0, 10) 
        };
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-100 relative">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Workspaces Governance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure logical data segments and audit document-level permissions inside your organization.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workspace</span>
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((ws) => {
          const meta = getMockMetadata(ws.id, ws.type);
          return (
            <div
              key={ws.id}
              className="bg-glass rounded-xl p-6 border border-card-border/60 hover:border-slate-700/50 flex flex-col justify-between h-56 transition-all duration-300 hover:-translate-y-1 shadow-lg"
              style={{ boxShadow: "0 4px 30px rgba(0, 0, 0, 0.4)" }}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-card-border text-accent-cyan">
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-card-border text-slate-400">
                    {ws.type}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-200 mt-4 truncate" title={ws.name}>
                  {ws.name}
                </h3>
              </div>

              {/* Card Meta Stats */}
              <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider py-4 my-2 border-y border-card-border/30">
                <div className="flex items-center gap-1.5" title="Documents indexed">
                  <FileText className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>{meta.docs} Files</span>
                </div>
                <div className="flex items-center gap-1.5" title="Workspace members">
                  <Users className="w-3.5 h-3.5 text-accent-indigo" />
                  <span>{meta.members} Members</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto" title="Creation Date">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  <span>{meta.date}</span>
                </div>
              </div>

              {/* Card Footer action */}
              <Link
                href={`/workspaces/${ws.id}`}
                className="w-full py-2 rounded-lg border border-card-border hover:border-accent-cyan/20 bg-slate-950/40 hover:bg-slate-900 hover:text-white transition-all text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5"
              >
                <span>Manage Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Create Workspace Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div
            className="w-full max-w-md bg-[#0B0F19] border border-card-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ boxShadow: "0 10px 50px rgba(0, 0, 0, 0.6)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-slate-950/20">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-accent-cyan" />
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">New Workspace</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Workspace Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Operations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors"
                />
              </div>

              {/* Workspace Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Partition Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-sm text-slate-300 focus:outline-none focus:border-accent-cyan/40"
                >
                  <option value="team">Team Workspace (Shared Department)</option>
                  <option value="central">Central Workspace (Global Tenant-Wide)</option>
                  <option value="personal">Personal Workspace (Isolated Sandbox)</option>
                </select>
                <p className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent-cyan shrink-0 mt-0.5" />
                  <span>
                    {type === "team" && "Allows all workspace members to ingest files, query references, and view activity."}
                    {type === "central" && "Central workspace accessible to all user profiles under this organization account."}
                    {type === "personal" && "Private sandbox. Documents and chat logs are visible only to the creator account."}
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-card-border/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
