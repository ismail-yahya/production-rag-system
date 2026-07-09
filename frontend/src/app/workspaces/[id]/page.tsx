"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderGit2, FileText, Users, Settings, ArrowLeft, Plus, Trash2, Shield, UserMinus } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { clsx } from "clsx";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Mock members specifically for workspace groupings
const mockWorkspaceMembers: Record<string, { email: string; name: string; role: "admin" | "member" | "viewer" }[]> = {
  "1": [
    { email: "john.doe@company.com", name: "John Doe", role: "admin" },
    { email: "jane.smith@company.com", name: "Jane Smith", role: "member" },
    { email: "ismail.yahya@company.com", name: "Ismail Yahya", role: "admin" },
  ],
  "2": [
    { email: "ismail.yahya@company.com", name: "Ismail Yahya", role: "admin" },
    { email: "dev.lead@company.com", name: "Dev Lead", role: "member" },
    { email: "qa.engineer@company.com", name: "QA Engineer", role: "viewer" },
  ],
  "3": [
    { email: "ismail.yahya@company.com", name: "Ismail Yahya", role: "member" },
    { email: "marketing.lead@company.com", name: "Marketing Lead", role: "admin" },
  ],
  "4": [
    { email: "ismail.yahya@company.com", name: "Ismail Yahya", role: "admin" },
  ],
};

// Mock files grouped by workspace
const mockWorkspaceDocs: Record<string, { id: string; name: string; size: string; date: string }[]> = {
  "1": [
    { id: "doc-1", name: "q2_financial_report.pdf", size: "4.2 MB", date: "2026-07-08 14:20" },
    { id: "doc-4", name: "legacy_system_documentation.pdf", size: "1.5 MB", date: "2026-07-05 11:32" },
  ],
  "2": [
    { id: "doc-2", name: "employee_handbook_2026.pdf", size: "12.8 MB", date: "2026-07-07 09:12" },
  ],
  "3": [
    { id: "doc-3", name: "cost_structures_2026.pdf", size: "8.1 MB", date: "2026-07-06 18:41" },
  ],
  "4": [],
};

export default function WorkspaceDetail({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { workspaces, setWorkspaces } = useUIStore();
  
  const currentWorkspace = workspaces.find((w) => w.id === id);

  const [activeTab, setActiveTab] = useState<"documents" | "members" | "settings">("documents");
  
  // Local list states initialized from mocks
  const [members, setMembers] = useState(mockWorkspaceMembers[id] || []);
  const [docs, setDocs] = useState(mockWorkspaceDocs[id] || []);
  
  // Add Member input state
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member" | "viewer">("member");
  
  // Rename state
  const [renameValue, setRenameValue] = useState(currentWorkspace?.name || "");

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <FolderGit2 className="w-12 h-12 text-slate-600 animate-pulse" />
        <p className="text-slate-400 font-medium">Workspace not found.</p>
        <Link href="/workspaces" className="text-accent-cyan hover:underline text-xs">
          Back to Workspaces
        </Link>
      </div>
    );
  }

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    const email = newMemberEmail.trim();
    const name = email.split("@")[0].replace(".", " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    const newMember = {
      email,
      name: formattedName,
      role: newMemberRole,
    };

    setMembers([...members, newMember]);
    setNewMemberEmail("");
    setNewMemberRole("member");
  };

  const handleRemoveMember = (email: string) => {
    setMembers(members.filter((m) => m.email !== email));
  };

  const handleRemoveDoc = (docId: string) => {
    setDocs(docs.filter((d) => d.id !== docId));
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) return;

    setWorkspaces(
      workspaces.map((w) => (w.id === id ? { ...w, name: renameValue.trim() } : w))
    );
    alert("Workspace renamed successfully.");
  };

  const handleDeleteWorkspace = () => {
    if (confirm("Are you sure you want to permanently delete this workspace? This will unlink all documents.")) {
      setWorkspaces(workspaces.filter((w) => w.id !== id));
      router.push("/workspaces");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-slate-100">
      {/* Back button and title */}
      <div className="flex items-center gap-4 border-b border-card-border pb-4">
        <Link
          href="/workspaces"
          className="p-2 rounded-lg border border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">{currentWorkspace.name}</h1>
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-950 border border-card-border text-slate-400">
              {currentWorkspace.type}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
            Workspace ID: {currentWorkspace.id}
          </span>
        </div>
      </div>

      {/* Tabs Switcher bar */}
      <div className="flex border-b border-card-border gap-2">
        <button
          onClick={() => setActiveTab("documents")}
          className={clsx(
            "px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-colors cursor-pointer",
            activeTab === "documents"
              ? "border-accent-cyan text-accent-cyan"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Documents ({docs.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={clsx(
            "px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-colors cursor-pointer",
            activeTab === "members"
              ? "border-accent-cyan text-accent-cyan"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Members ({members.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={clsx(
            "px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-colors cursor-pointer",
            activeTab === "settings"
              ? "border-accent-cyan text-accent-cyan"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> Settings
          </span>
        </button>
      </div>

      {/* Dynamic Tab Pane */}
      <div className="bg-glass rounded-xl border border-card-border p-6 shadow-xl relative min-h-64">
        {/* TAB 1: DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h2 className="text-sm font-bold text-slate-300">Bound Documents</h2>
              <button
                onClick={() => alert("Redirecting to Documents view to add files.")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Bind Document</span>
              </button>
            </div>

            {docs.length > 0 ? (
              <div className="divide-y divide-card-border/50">
                {docs.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-200 block truncate">{doc.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{doc.size}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="p-1.5 rounded-lg border border-card-border hover:border-rose-500/30 text-slate-400 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                      title="Unlink Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">No documents linked to this workspace partition.</p>
            )}
          </div>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Invite Form */}
            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-slate-950/35 border border-card-border">
              <input
                type="email"
                required
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="collaborator@company.com"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 placeholder-slate-600 transition-colors"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="member">Workspace Member</option>
                <option value="admin">Workspace Admin</option>
                <option value="viewer">Workspace Viewer</option>
              </select>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Add Member
              </button>
            </form>

            {/* Members List */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-300 border-b border-card-border pb-3">Active Workspace Members</h2>
              <div className="divide-y divide-card-border/50">
                {members.map((member) => (
                  <div key={member.email} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">{member.name}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{member.email}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 border border-card-border text-slate-400">
                        <Shield className="w-3 h-3 text-accent-cyan" /> {member.role}
                      </span>
                      
                      {member.email !== "ismail.yahya@company.com" && (
                        <button
                          onClick={() => handleRemoveMember(member.email)}
                          className="p-1.5 rounded-lg border border-card-border hover:border-rose-500/30 text-slate-400 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                          title="Remove Member"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-8 max-w-xl">
            {/* Rename */}
            <form onSubmit={handleRename} className="space-y-3">
              <h2 className="text-sm font-bold text-slate-300 border-b border-card-border pb-3">Rename Partition</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-card-border text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
                >
                  Save Rename
                </button>
              </div>
            </form>

            {/* Destructive Actions */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-rose-500 border-b border-rose-500/20 pb-3">Destructive Settings</h2>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Permanently archive or delete this workspace. Archiving blocks query accesses but preserves document vectors inside Qdrant. Deleting purges all linked indexes completely.
              </p>
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all shadow-lg cursor-pointer"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
