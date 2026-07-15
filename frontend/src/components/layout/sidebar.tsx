"use client";

// ---------------------------------------------------------------------------
// Sidebar — Role-aware navigation with workspace selector
// (Placeholder — will be fully built in Phase 3)
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useUIStore } from "@/store/ui-store";
import { hasMinRole, ROUTES } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquareCode,
  FileText,
  FolderGit2,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: "ADMIN" | "SUPER_ADMIN";
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: "Chat", href: ROUTES.CHAT, icon: MessageSquareCode },
  { name: "Documents", href: ROUTES.DOCUMENTS, icon: FileText },
  { name: "Workspaces", href: ROUTES.WORKSPACES, icon: FolderGit2 },
  { name: "Settings", href: ROUTES.SETTINGS, icon: Settings },
  { name: "Administration", href: ROUTES.ADMIN, icon: ShieldCheck, minRole: "ADMIN" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const { 
    sidebarCollapsed, 
    toggleSidebar, 
    mobileSidebarOpen, 
    setMobileSidebarOpen 
  } = useUIStore();

  // Close mobile sidebar on route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-[#020408]/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <aside
        className={cn(
          "flex flex-col h-screen border-r border-card-border bg-[#0B0F19] transition-all duration-300 relative",
          // Desktop styles
          "hidden md:flex md:relative md:z-30 md:inset-y-auto md:left-auto md:shadow-none",
          sidebarCollapsed ? "md:w-16" : "md:w-64",
          // Mobile drawer styles
          "fixed inset-y-0 left-0 w-64 z-40 bg-[#0B0F19] shadow-2xl transition-transform duration-300 md:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
      {/* Brand */}
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => {
            if (item.minRole && role) {
              return hasMinRole(role, item.minRole);
            }
            return !item.minRole;
          })
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative",
                  isActive
                    ? "bg-glass text-accent-cyan font-medium border-l-2 border-l-accent-cyan shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-accent-cyan"
                      : "text-slate-400 group-hover:text-accent-cyan"
                  )}
                />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
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
        <div
          className={cn(
            "flex items-center gap-3",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan to-accent-indigo flex items-center justify-center text-xs font-semibold text-white">
              {user ? getInitials(user.name) : ".."}
            </div>
            {!sidebarCollapsed && user && (
              <div className="truncate">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {user.name}
                </p>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-accent-indigo/20 text-accent-cyan border border-accent-cyan/20">
                  {user.role}
                </span>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-accent-violet hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
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
        className="absolute -right-3 top-20 hidden md:flex items-center justify-center w-6 h-6 rounded-full border border-card-border bg-[#0B0F19] text-slate-400 hover:text-accent-cyan shadow-xl cursor-pointer hover:border-accent-cyan/30 transition-all duration-200 z-50"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
    </>
  );
}
