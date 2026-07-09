"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore, Workspace } from "../store/uiStore";
import {
  LayoutDashboard,
  MessageSquareCode,
  FileText,
  FolderGit2,
  BarChart3,
  Users,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Chat Interface", href: "/chat", icon: MessageSquareCode },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Workspaces", href: "/workspaces", icon: FolderGit2 },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "User Management", href: "/users", icon: Users, adminOnly: true },
  { name: "Audit Logs", href: "/audit-logs", icon: ShieldCheck, adminOnly: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, activeWorkspace, workspaces, setActiveWorkspace } = useUIStore();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setWorkspaceMenuOpen(false);
  };

  return (
    <aside
      className={clsx(
        "flex flex-col h-screen border-r border-card-border bg-[#0B0F19] transition-all duration-300 relative z-30",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-card-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-indigo to-accent-violet shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              AETHER RAG
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="flex items-center justify-center w-full">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-indigo to-accent-violet">
              <Database className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="px-3 py-4 border-b border-card-border relative">
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-accent-cyan transition-colors"
              title={activeWorkspace?.name || "Workspace"}
            >
              <FolderGit2 className="w-5 h-5 text-accent-cyan" />
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-card-border text-slate-300 hover:text-white transition-all duration-200"
            >
              <div className="flex items-center gap-2 truncate">
                <FolderGit2 className="w-4 h-4 text-accent-cyan shrink-0" />
                <span className="text-sm font-medium truncate">
                  {activeWorkspace?.name || "Select Workspace"}
                </span>
              </div>
              <ChevronDown className={clsx("w-4 h-4 text-slate-400 shrink-0 transition-transform", workspaceMenuOpen && "rotate-180")} />
            </button>

            {workspaceMenuOpen && (
              <div className="absolute left-3 right-3 mt-1 py-1 rounded-lg bg-slate-950 border border-card-border shadow-2xl z-50">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleWorkspaceSelect(ws)}
                    className={clsx(
                      "flex items-center justify-between w-full px-3 py-2 text-left text-sm hover:bg-slate-900 transition-colors",
                      activeWorkspace?.id === ws.id ? "text-accent-cyan font-semibold" : "text-slate-400"
                    )}
                  >
                    <span>{ws.name}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 border border-card-border text-slate-400">
                      {ws.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative",
                isActive
                  ? "bg-glass text-accent-cyan font-medium border-l-2 border-l-accent-cyan shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              )}
            >
              <Icon
                className={clsx(
                  "w-5 h-5 shrink-0 transition-colors duration-200",
                  isActive ? "text-accent-cyan" : "text-slate-400 group-hover:text-accent-cyan"
                )}
              />
              {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              {sidebarCollapsed && (
                <div className="absolute left-14 scale-0 group-hover:scale-100 bg-slate-950 border border-card-border text-slate-200 text-xs rounded-md px-2 py-1.5 whitespace-nowrap shadow-2xl transition-all duration-150 z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="p-3 border-t border-card-border bg-slate-950/40">
        <div className={clsx("flex items-center gap-3", sidebarCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan to-accent-indigo flex items-center justify-center text-xs font-semibold text-white">
              IY
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <p className="text-xs font-medium text-slate-200 truncate">Ismail Yahya</p>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-accent-indigo/20 text-accent-cyan border border-accent-cyan/20">
                  ADMIN
                </span>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              className="p-1.5 text-slate-400 hover:text-accent-violet hover:bg-slate-900 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full border border-card-border bg-[#0B0F19] text-slate-400 hover:text-accent-cyan shadow-xl cursor-pointer hover:border-accent-cyan/30 transition-all duration-200 z-50"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
