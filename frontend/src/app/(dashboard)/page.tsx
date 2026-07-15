"use client";

// ---------------------------------------------------------------------------
// DashboardPage — Central operating dashboard displaying stats and workspace metrics
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { adminService } from "@/services/admin.service";
import { workspacesService } from "@/services/workspaces.service";
import { chatService } from "@/services/chat.service";
import { documentsService } from "@/services/documents.service";
import { hasMinRole, STATUS_CONFIG, ROLE_BADGE_CONFIG, WORKSPACE_TYPE_CONFIG } from "@/lib/constants";
import { cn, formatFileSize, formatDate, formatLatency } from "@/lib/utils";
import { QuickQueryDrawer } from "@/components/dashboard/quick-query-drawer";
import Link from "next/link";
import {
  Database,
  Cpu,
  MessageSquare,
  Clock,
  ArrowRight,
  UploadCloud,
  FileText,
  FolderGit2,
  Terminal,
  Settings2,
  AlertCircle,
  Plus,
  Loader2,
  ArrowUpRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search / Quick Query State
  const [searchValue, setSearchValue] = useState("");
  const [queryMode, setQueryMode] = useState<"standard" | "strict">("standard");
  const [drawerQuestion, setDrawerQuestion] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // Defer date rendering to client only — avoids SSR/client hydration mismatch
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  // 1. Fetch Admin Stats (conditional on role >= ADMIN)
  const isAdmin = user ? hasMinRole(user.role, "ADMIN") : false;
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const response = await adminService.getStats();
      return response.data;
    },
    enabled: !!user && isAdmin,
  });

  // 2. Fetch Workspaces
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await workspacesService.list();
      return response.data;
    },
    enabled: !!user,
  });

  // 3. Fetch Recent Chat Threads
  const threadsQuery = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: async () => {
      const response = await chatService.listThreads();
      return response.data;
    },
    enabled: !!user,
  });

  // 4. Fetch Documents
  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await documentsService.list();
      return response.data;
    },
    enabled: !!user,
  });

  // File Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus({ status: "uploading" });
      const response = await documentsService.upload(file);
      return response.data;
    },
    onSuccess: () => {
      setUploadStatus({ status: "success", message: "Document uploaded successfully." });
      // Invalidate queries to reload documents list & dashboard metrics
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (isAdmin) {
        queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      }
      setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
    },
    onError: (error) => {
      setUploadStatus({
        status: "error",
        message: error instanceof Error ? error.message : "File upload failed.",
      });
      setTimeout(() => setUploadStatus({ status: "idle" }), 5000);
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    setDrawerQuestion(searchValue);
    setIsDrawerOpen(true);
    setSearchValue("");
  };

  // Compute document status distribution
  const docStatusCounts = {
    pending: 0,
    processing: 0,
    indexed: 0,
    failed: 0,
  };

  const docsList = documentsQuery.data?.documents || [];
  docsList.forEach((doc) => {
    if (doc.status in docStatusCounts) {
      docStatusCounts[doc.status as keyof typeof docStatusCounts]++;
    }
  });

  const recentDocs = docsList.slice(0, 5);
  const recentThreads = (threadsQuery.data || []).slice(0, 5);
  const recentWorkspaces = (workspacesQuery.data || []).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0B1224] to-[#060A12] border border-card-border/80 relative overflow-hidden shadow-xl">
        <div className="absolute w-96 h-96 rounded-full bg-accent-cyan/5 blur-[80px] -right-20 -top-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
                Welcome back, {user?.name || "User"}
              </h1>
              {user?.role && (
                <span className={cn(
                  "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border tracking-wider",
                  ROLE_BADGE_CONFIG[user.role as keyof typeof ROLE_BADGE_CONFIG]?.className
                )}>
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Logical organization scope partition loaded: <span className="font-mono text-accent-cyan text-xs">{user?.tenant_id}</span>
            </p>
          </div>
          
          {currentDate && (
            <div className="text-xs text-slate-500 font-mono self-start md:self-center" suppressHydrationWarning>
              {currentDate}
            </div>
          )}
        </div>
      </div>

      {/* 2. Admin stats cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Documents */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-card-border shadow-md flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-accent-cyan/0 group-hover:bg-accent-cyan/[0.02] transition-colors" />
            <div className="p-2.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Documents</span>
              <span className="text-xl font-bold text-slate-200">
                {statsQuery.isPending ? "..." : statsQuery.data?.total_documents}
              </span>
            </div>
          </div>

          {/* Card 2: Total Chunks */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-card-border shadow-md flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-accent-indigo/0 group-hover:bg-accent-indigo/[0.02] transition-colors" />
            <div className="p-2.5 rounded-lg bg-accent-indigo/10 border border-accent-indigo/20 text-accent-indigo">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Vector Chunks</span>
              <span className="text-xl font-bold text-slate-200">
                {statsQuery.isPending ? "..." : statsQuery.data?.total_chunks}
              </span>
            </div>
          </div>

          {/* Card 3: Total Queries */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-card-border shadow-md flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-accent-violet/0 group-hover:bg-accent-violet/[0.02] transition-colors" />
            <div className="p-2.5 rounded-lg bg-accent-violet/10 border border-accent-violet/20 text-accent-violet">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Queries Run</span>
              <span className="text-xl font-bold text-slate-200">
                {statsQuery.isPending ? "..." : statsQuery.data?.total_queries}
              </span>
            </div>
          </div>

          {/* Card 4: Average Latency */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-card-border shadow-md flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/[0.02] transition-colors" />
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avg Latency</span>
              <span className="text-xl font-bold text-slate-200">
                {statsQuery.isPending ? "..." : formatLatency(statsQuery.data?.average_latency_ms || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Quick Query Bar */}
      <div className="p-6 rounded-2xl bg-[#090F1E]/50 border border-card-border/80 relative shadow-lg">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-semibold tracking-wide text-slate-300 font-mono uppercase">
              AI Command Console
            </h2>
            <p className="text-xs text-slate-400">
              Submit a natural language grounded request to search files immediately.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 relative">
            <div className="relative flex-1">
              <Terminal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Ask Aether RAG to search your workspaces..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-11 pr-24 py-3 rounded-xl bg-slate-950 border-card-border text-slate-200 placeholder-slate-600 focus:border-accent-cyan/50 focus:ring-0 text-sm font-sans"
              />
              
              {/* Mode switch button inside input */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-slate-900 border border-card-border/80 px-2 py-1 rounded-md">
                <Settings2 className="w-3 h-3 text-slate-400" />
                <select
                  value={queryMode}
                  onChange={(e) => setQueryMode(e.target.value as "standard" | "strict")}
                  className="bg-transparent border-none text-[10px] text-slate-400 font-bold focus:outline-none tracking-wider uppercase cursor-pointer"
                >
                  <option value="standard" className="bg-slate-950 text-slate-400">RAG</option>
                  <option value="strict" className="bg-slate-950 text-slate-400">Strict</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!searchValue.trim()}
              className="px-5 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-md text-sm font-semibold text-white border-none shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* 4. Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Workspaces widget (takes 2/3 cols on lg desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/30 border border-card-border shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-accent-indigo" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Active Workspaces
                </h3>
              </div>
              {hasMinRole(user?.role || "USER", "MANAGER") && (
                <Link
                  href="/workspaces"
                  className={cn(buttonVariants({ variant: "outline" }), "h-8 px-2.5 text-xs border-card-border hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer")}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Create</span>
                </Link>
              )}
            </div>

            {workspacesQuery.isPending ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
              </div>
            ) : recentWorkspaces.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-card-border/50 rounded-xl space-y-2">
                <FolderGit2 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500">No workspaces allocated to your account.</p>
                {hasMinRole(user?.role || "USER", "MANAGER") && (
                  <Link
                    href="/workspaces"
                    className={cn(buttonVariants({ variant: "link" }), "text-accent-cyan text-xs")}
                  >
                    Create your first workspace
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentWorkspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`/workspaces/${ws.id}`}
                    className="p-4 rounded-xl bg-slate-950/40 border border-card-border/80 hover:border-accent-cyan/30 transition-all hover:bg-slate-950/70 group"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-semibold text-slate-200 group-hover:text-accent-cyan transition-colors">
                        {ws.name}
                      </h4>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono",
                        WORKSPACE_TYPE_CONFIG[ws.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.className
                      )}>
                        {WORKSPACE_TYPE_CONFIG[ws.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed h-8">
                      {ws.description || "No description provided."}
                    </p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-card-border/40 text-[10px] text-slate-500 font-mono">
                      <span>Created {formatDate(ws.created_at)}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:text-accent-cyan transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ingest & Activity widgets */}
        <div className="space-y-6">
          {/* Recent Chats Widget */}
          <div className="p-5 rounded-2xl bg-slate-900/30 border border-card-border shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-violet" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Recent Threads
                </h3>
              </div>
              <Link
                href="/chat"
                className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 text-xs text-accent-cyan hover:underline cursor-pointer")}
              >
                View All
              </Link>
            </div>

            {threadsQuery.isPending ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-accent-cyan" />
              </div>
            ) : recentThreads.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-card-border/50 rounded-xl space-y-1.5">
                <p className="text-xs text-slate-500">No active threads found.</p>
                <Link
                  href="/chat"
                  className={cn(buttonVariants({ variant: "outline", size: "xs" }), "text-xs border-card-border hover:bg-slate-800 text-slate-400")}
                >
                  Open Chat
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/chat?threadId=${thread.id}`}
                    className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/20 border border-card-border/40 hover:bg-slate-900/30 hover:border-card-border/80 transition-all text-xs"
                  >
                    <span className="text-slate-300 font-medium truncate max-w-[150px]">
                      {thread.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {formatDate(thread.updated_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Ingest summary & upload widget */}
          <div className="p-5 rounded-2xl bg-slate-900/30 border border-card-border shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-cyan" />
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                My Documents
              </h3>
            </div>

            {/* Ingestion stats indicators */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono font-bold">
              <div className="p-2 rounded bg-amber-950/10 border border-amber-500/10">
                <span className="text-amber-400 block">{docStatusCounts.pending}</span>
                <span className="text-slate-500 text-[8px] uppercase tracking-wider block mt-0.5">Pend</span>
              </div>
              <div className="p-2 rounded bg-blue-950/10 border border-blue-500/10">
                <span className="text-blue-400 block">{docStatusCounts.processing}</span>
                <span className="text-slate-500 text-[8px] uppercase tracking-wider block mt-0.5">Proc</span>
              </div>
              <div className="p-2 rounded bg-emerald-950/10 border border-emerald-500/10">
                <span className="text-emerald-400 block">{docStatusCounts.indexed}</span>
                <span className="text-slate-500 text-[8px] uppercase tracking-wider block mt-0.5">Idx</span>
              </div>
              <div className="p-2 rounded bg-rose-950/10 border border-rose-500/10">
                <span className="text-rose-400 block">{docStatusCounts.failed}</span>
                <span className="text-slate-500 text-[8px] uppercase tracking-wider block mt-0.5">Fail</span>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "p-4 rounded-xl border border-dashed text-center transition-all cursor-pointer select-none",
                isDragging
                  ? "border-accent-cyan bg-accent-cyan/5 text-accent-cyan"
                  : "border-card-border hover:border-card-border/80 text-slate-400"
              )}
            >
              <input
                type="file"
                id="dashboard-file-upload"
                className="hidden"
                accept=".pdf,.txt,.md,image/*"
                onChange={handleFileSelect}
              />
              <label htmlFor="dashboard-file-upload" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-6 h-6 mx-auto text-slate-500" />
                <div className="text-xs">
                  <span className="text-accent-cyan font-medium">Click to upload</span> or drag and drop
                </div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                  PDF, TXT, MD, Images (Max 10MB)
                </p>
              </label>
            </div>

            {/* Upload Notification Alert */}
            {uploadStatus.status !== "idle" && (
              <div className={cn(
                "p-3 rounded-lg border text-xs flex items-center gap-2",
                uploadStatus.status === "uploading" && "bg-blue-950/20 border-blue-500/20 text-blue-400",
                uploadStatus.status === "success" && "bg-emerald-950/20 border-emerald-500/20 text-emerald-400",
                uploadStatus.status === "error" && "bg-rose-950/20 border-rose-500/20 text-rose-400"
              )}>
                {uploadStatus.status === "uploading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : uploadStatus.status === "success" ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {uploadStatus.status === "uploading" ? "Uploading and scheduling ingestion job..." : uploadStatus.message}
                </span>
              </div>
            )}

            {/* Recent Uploads List */}
            {recentDocs.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Recent Uploads
                </span>
                <div className="space-y-1.5">
                  {recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-950/20 border border-card-border/30 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                        <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-slate-300 truncate font-medium" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.2 rounded-full font-semibold border scale-95",
                        STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.className
                      )}>
                        {STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RAG Drawer portal */}
      <QuickQueryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        question={drawerQuestion}
        mode={queryMode}
      />
    </div>
  );
}
