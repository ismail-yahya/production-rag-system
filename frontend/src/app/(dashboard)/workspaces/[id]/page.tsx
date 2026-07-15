"use client";

// ---------------------------------------------------------------------------
// WorkspaceDetailPage — Workspace metrics, documents mapping, member panels
// ---------------------------------------------------------------------------

import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { workspacesService } from "@/services/workspaces.service";
import { documentsService } from "@/services/documents.service";
import { hasMinRole, STATUS_CONFIG, WORKSPACE_TYPE_CONFIG } from "@/lib/constants";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderGit2,
  FileText,
  Users,
  Plus,
  X,
  Loader2,
  Trash2,
  Edit2,
  Check,
  ArrowRight,
  ShieldCheck,
  Mail,
  User,
  Link2,
  Building,
  UploadCloud,
  AlertCircle,
  MoreVertical,
  Search,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceMemberRole } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Zod schemas for modals
const addMemberSchema = z.object({
  email: z.string().email({ message: "Invalid email address format." }).optional().or(z.literal("")),
  user_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: "Must be a valid UUID format." }).optional().or(z.literal("")),
  member_role: z.enum(["ADMIN", "MEMBER", "VIEWER"] as const),
}).refine((data) => data.email || data.user_id, {
  message: "Either Email or User ID must be provided.",
  path: ["email"],
});

type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export default function WorkspaceDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Unwrap params via React 19 standard
  const { id: workspaceId } = React.use(params);

  // Tabs state
  const [activeTab, setActiveTab] = useState<"documents" | "members">("documents");

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Modals state
  const [isLinkDocModalOpen, setIsLinkDocModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [addMode, setAddMode] = useState<"email" | "id">("email");

  // Document selection for linking
  const [docSearchTerm, setDocSearchTerm] = useState("");

  // Direct upload status
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // 1. Fetch Workspace Details
  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const response = await workspacesService.getById(workspaceId);
      return response.data;
    },
    enabled: !!workspaceId,
  });

  // Sync edit state values on load
  useEffect(() => {
    if (workspaceQuery.data) {
      setEditName(workspaceQuery.data.name);
      setEditDesc(workspaceQuery.data.description || "");
    }
  }, [workspaceQuery.data]);

  // 2. Fetch Workspace Linked Documents
  const workspaceDocsQuery = useQuery({
    queryKey: ["workspace", workspaceId, "documents"],
    queryFn: async () => {
      const response = await workspacesService.listDocuments(workspaceId);
      return response.data;
    },
    enabled: !!workspaceId,
  });

  // 3. Fetch Workspace Members
  const membersQuery = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: async () => {
      const response = await workspacesService.listMembers(workspaceId);
      return response.data;
    },
    enabled: !!workspaceId,
  });

  // 4. Fetch All Documents in Tenant (for linking)
  const allDocsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await documentsService.list();
      return response.data;
    },
    enabled: isLinkDocModalOpen,
  });

  // Permissions helper
  const isAdmin = user ? hasMinRole(user.role, "ADMIN") : false;
  const currentMember = membersQuery.data?.find((m) => m.user_id === user?.user_id);
  const memberRole = currentMember?.member_role;

  const hasWriteAccess = isAdmin || memberRole === "ADMIN" || memberRole === "MEMBER";
  const hasAdminAccess = isAdmin || memberRole === "ADMIN";

  // MUTATIONS

  // Edit Workspace details
  const updateWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const response = await workspacesService.update(workspaceId, {
        name: editName,
        description: editDesc,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  // Delete Workspace
  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      await workspacesService.delete(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push("/workspaces");
    },
  });

  // Link Document
  const linkDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await workspacesService.linkDocument(workspaceId, docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "documents"] });
    },
  });

  // Unlink Document
  const unlinkDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await workspacesService.unlinkDocument(workspaceId, docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "documents"] });
    },
  });

  // Upload to workspace directly
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus({ status: "uploading" });
      const response = await documentsService.upload(file, workspaceId);
      return response.data;
    },
    onSuccess: () => {
      setUploadStatus({ status: "success", message: "File uploaded and linked." });
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
    },
    onError: (err) => {
      setUploadStatus({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
      setTimeout(() => setUploadStatus({ status: "idle" }), 5000);
    },
  });

  // Add Member
  const addMemberForm = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: "",
      user_id: "",
      member_role: "MEMBER",
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (values: AddMemberFormValues) => {
      if (addMode === "email" && values.email) {
        await workspacesService.addMemberByEmail(workspaceId, {
          email: values.email,
          member_role: values.member_role,
        });
      } else if (addMode === "id" && values.user_id) {
        await workspacesService.addMember(workspaceId, {
          user_id: values.user_id,
          member_role: values.member_role,
        });
      }
    },
    onSuccess: () => {
      setIsAddMemberModalOpen(false);
      addMemberForm.reset();
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
    },
  });

  // Remove Member
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await workspacesService.removeMember(workspaceId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
    },
  });

  // Update Member Role
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceMemberRole }) => {
      await workspacesService.updateMemberRole(workspaceId, userId, {
        member_role: role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
    },
  });

  // Uploader triggers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!hasWriteAccess) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasWriteAccess) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-1/2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        
        {/* Tabs Skeleton */}
        <div className="flex gap-2 border-b border-card-border/60 pb-px">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
        
        {/* Table/Content Skeleton */}
        <div className="border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex justify-between items-center py-2 border-b border-card-border/40">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
        <h3 className="text-sm font-semibold text-slate-300">Workspace Resolution Failed</h3>
        <p className="text-xs text-slate-500">The requested workspace parameters do not exist or access is restricted.</p>
        <Link
          href="/workspaces"
          className={cn(buttonVariants({ variant: "outline" }), "h-8 border-card-border text-slate-400")}
        >
          Back to Workspaces
        </Link>
      </div>
    );
  }

  const workspace = workspaceQuery.data;

  // Filter documents in Link Modal (only show unlinked documents in the organization)
  const linkedDocIds = new Set((workspaceDocsQuery.data || []).map((d) => d.id));
  const unlinkedDocs = (allDocsQuery.data?.documents || []).filter(
    (d) => !linkedDocIds.has(d.id) && d.file_name.toLowerCase().includes(docSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* 1. Header Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0B1224] to-[#060A12] border border-card-border/80 shadow-xl relative overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-accent-cyan/5 blur-[80px] -right-25 -top-25 pointer-events-none" />
        
        {isEditing ? (
          <div className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workspace Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-950 border-card-border text-sm text-slate-100 max-w-md h-9"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</Label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full max-w-xl p-2.5 rounded-lg bg-slate-950 border border-card-border text-xs text-slate-300 placeholder-slate-600 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => updateWorkspaceMutation.mutate()}
                disabled={updateWorkspaceMutation.isPending}
                className="flex items-center gap-1.5 h-8 py-0 px-3.5 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-md text-xs font-semibold text-white border-none cursor-pointer"
              >
                {updateWorkspaceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                variant="outline"
                className="h-8 py-0 px-3.5 border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative z-10">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderGit2 className="w-5 h-5 text-accent-cyan" />
                <h1 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
                  {workspace.name}
                </h1>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono tracking-wider uppercase",
                  WORKSPACE_TYPE_CONFIG[workspace.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.className
                )}>
                  {WORKSPACE_TYPE_CONFIG[workspace.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.label}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {workspace.description || "No description provided for this partition."}
              </p>
              <div className="text-[10px] text-slate-500 font-mono pt-1">
                Context ID: <span className="text-slate-400 select-all">{workspace.id}</span> • Created {formatDate(workspace.created_at)}
              </div>
            </div>

            {/* Management actions */}
            {hasAdminAccess && (
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="h-8 px-2.5 text-xs border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  <span>Edit</span>
                </Button>

                {isConfirmDeleteOpen ? (
                  <div className="flex items-center gap-1.5 bg-rose-950/20 border border-rose-500/25 p-1 rounded-lg">
                    <span className="text-[9px] text-rose-300 font-mono px-1">Purge WS?</span>
                    <Button
                      onClick={() => deleteWorkspaceMutation.mutate()}
                      disabled={deleteWorkspaceMutation.isPending}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-semibold h-6 py-0 px-2.5 cursor-pointer text-[10px] border-none"
                    >
                      {deleteWorkspaceMutation.isPending ? "Purging..." : "Confirm"}
                    </Button>
                    <Button
                      onClick={() => setIsConfirmDeleteOpen(false)}
                      variant="outline"
                      className="h-6 py-0 px-2 border-card-border hover:bg-slate-950 text-slate-400 text-[10px]"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    variant="outline"
                    className="h-8 px-2.5 text-xs border-rose-500/30 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Tab Navigation Toggle */}
      <div className="flex border-b border-card-border/60">
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === "documents"
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Grounded Documents ({workspaceDocsQuery.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === "members"
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Access Members ({membersQuery.data?.length || 0})</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* Document Operations Bar */}
          {hasWriteAccess && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Link existing Document Widget */}
              <div className="p-4 rounded-xl bg-slate-900/30 border border-card-border/60 flex flex-col justify-between h-36">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
                    <Link2 className="w-4 h-4 text-accent-indigo" />
                    <span>Link Existing Document</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Map an existing file from the corporate corpus list into this workspace search partition.
                  </p>
                </div>
                <Button
                  onClick={() => setIsLinkDocModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 h-8 bg-slate-900 border border-card-border hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs cursor-pointer rounded-lg"
                >
                  <span>Link Document Context</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Upload directly Widget (takes 2/3 width on md+) */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "md:col-span-2 p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center select-none cursor-pointer h-36 relative overflow-hidden",
                  isDragging
                    ? "border-accent-cyan bg-accent-cyan/5 text-accent-cyan"
                    : "border-card-border/60 hover:border-card-border bg-slate-900/10 text-slate-400"
                )}
              >
                <input
                  type="file"
                  id="ws-direct-file-upload"
                  className="hidden"
                  accept=".pdf,.txt,.md,image/*"
                  onChange={handleFileSelect}
                />
                <label htmlFor="ws-direct-file-upload" className="cursor-pointer block space-y-1">
                  <UploadCloud className="w-6 h-6 mx-auto text-slate-500" />
                  <div className="text-xs font-semibold">
                    <span className="text-accent-cyan hover:underline">Upload and link new document</span>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                    PDF, TXT, MD, Images (Max 10MB)
                  </p>
                </label>

                {/* Upload Status toast overlay */}
                {uploadStatus.status !== "idle" && (
                  <div className={cn(
                    "absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded border text-[10px] flex items-center gap-1.5 shadow-2xl",
                    uploadStatus.status === "uploading" && "bg-blue-950 border-blue-500/25 text-blue-400",
                    uploadStatus.status === "success" && "bg-emerald-950 border-emerald-500/25 text-emerald-400",
                    uploadStatus.status === "error" && "bg-rose-950 border-rose-500/25 text-rose-400"
                  )}>
                    {uploadStatus.status === "uploading" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : uploadStatus.status === "success" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>{uploadStatus.message || "Uploading..."}</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Linked Documents Table */}
          <div className="rounded-xl border border-card-border/80 bg-slate-950/20 overflow-hidden">
            {workspaceDocsQuery.isPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
              </div>
            ) : !workspaceDocsQuery.data || workspaceDocsQuery.data.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <FileText className="w-10 h-10 text-slate-700 mx-auto" />
                <h4 className="text-xs font-semibold text-slate-400">No documents mapped</h4>
                <p className="text-[10px] text-slate-600">Link or upload documents to query workspace partitions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-950/50 text-slate-500 uppercase tracking-wider font-mono text-[9px]">
                      <th className="p-3.5 font-semibold">File Name</th>
                      <th className="p-3.5 font-semibold">Type</th>
                      <th className="p-3.5 font-semibold">Size</th>
                      <th className="p-3.5 font-semibold">Chunks</th>
                      <th className="p-3.5 font-semibold">Status</th>
                      {hasWriteAccess && <th className="p-3.5 font-semibold text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/40 text-slate-300">
                    {workspaceDocsQuery.data.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="p-3.5 font-medium text-slate-200 truncate max-w-xs">{doc.file_name}</td>
                        <td className="p-3.5 text-slate-400 font-mono text-[10px] uppercase">
                          {doc.file_type.split("/").pop()}
                        </td>
                        <td className="p-3.5 text-slate-400">{formatFileSize(doc.file_size_bytes)}</td>
                        <td className="p-3.5 text-slate-400 font-mono">{doc.chunk_count}</td>
                        <td className="p-3.5">
                          <span className={cn(
                            "text-[8px] px-2 py-0.2 rounded-full border font-bold uppercase tracking-wider font-mono",
                            STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.className
                          )}>
                            {STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.label}
                          </span>
                        </td>
                        {hasWriteAccess && (
                          <td className="p-3.5 text-right">
                            <Button
                              onClick={() => unlinkDocMutation.mutate(doc.id)}
                              disabled={unlinkDocMutation.isPending}
                              variant="outline"
                              className="h-7 px-2 border-rose-500/20 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 cursor-pointer text-[10px]"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              <span>Unlink</span>
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Members Table Operations Bar */}
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
              Access Group Directory
            </h3>
            
            {/* Add Member button (visible to Workspace ADMIN, Tenant ADMIN+) */}
            {hasAdminAccess && (
              <Button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 border border-card-border hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </Button>
            )}
          </div>

          {/* Members list Table */}
          <div className="rounded-xl border border-card-border/80 bg-slate-950/20 overflow-hidden">
            {membersQuery.isPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-accent-cyan" />
              </div>
            ) : !membersQuery.data || membersQuery.data.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Users className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500">No members configured in the access table.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-950/50 text-slate-500 uppercase tracking-wider font-mono text-[9px]">
                      <th className="p-3.5 font-semibold">User Display Name</th>
                      <th className="p-3.5 font-semibold">Corporate Email</th>
                      <th className="p-3.5 font-semibold">Joined At</th>
                      <th className="p-3.5 font-semibold">Workspace Role</th>
                      {hasAdminAccess && <th className="p-3.5 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/40 text-slate-300">
                    {membersQuery.data.map((mem) => {
                      const isSelf = mem.user_id === user?.user_id;
                      
                      return (
                        <tr key={mem.user_id} className="hover:bg-slate-900/10 transition-colors">
                          <td className="p-3.5 font-medium text-slate-200">
                            {mem.name} {isSelf && <span className="text-[9px] text-slate-500 font-mono">(You)</span>}
                          </td>
                          <td className="p-3.5 text-slate-400 font-mono">{mem.email}</td>
                          <td className="p-3.5 text-slate-500 font-mono">{formatDate(mem.joined_at)}</td>
                          
                          {/* Workspace role editing dropdown */}
                          <td className="p-3.5">
                            {hasAdminAccess && !isSelf ? (
                              <select
                                value={mem.member_role}
                                onChange={(e) => updateMemberRoleMutation.mutate({
                                  userId: mem.user_id,
                                  role: e.target.value as WorkspaceMemberRole
                                })}
                                className="bg-slate-950 border border-card-border rounded text-[10.5px] text-slate-300 px-2 py-1 font-mono focus:outline-none cursor-pointer focus:border-accent-cyan/40"
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                            ) : (
                              <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded border font-bold font-mono tracking-wider",
                                mem.member_role === "ADMIN" && "bg-violet-950/30 border-violet-500/20 text-violet-400",
                                mem.member_role === "MEMBER" && "bg-blue-950/30 border-blue-500/20 text-blue-400",
                                mem.member_role === "VIEWER" && "bg-slate-800/60 border-slate-600/30 text-slate-400"
                              )}>
                                {mem.member_role}
                              </span>
                            )}
                          </td>

                          {/* Member Removal Actions */}
                          {hasAdminAccess && (
                            <td className="p-3.5 text-right">
                              {!isSelf && (
                                <Button
                                  onClick={() => removeMemberMutation.mutate(mem.user_id)}
                                  disabled={removeMemberMutation.isPending}
                                  variant="outline"
                                  className="h-7 px-2 border-rose-500/20 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 cursor-pointer text-[10px]"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  <span>Remove</span>
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LINK DOCUMENT MODAL */}
      {isLinkDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#020408]/60 backdrop-blur-sm" onClick={() => setIsLinkDocModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-[#080F1E] border border-card-border rounded-2xl shadow-2xl p-6 space-y-6 z-10">
            <div className="flex items-center justify-between border-b border-card-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-accent-cyan" />
                <h3 className="font-bold text-slate-200 text-sm font-mono tracking-wide uppercase">
                  Link Corpus Document
                </h3>
              </div>
              <button
                onClick={() => setIsLinkDocModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Search files in corporate tenant list..."
                value={docSearchTerm}
                onChange={(e) => setDocSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950 border-card-border text-xs text-slate-300 placeholder-slate-600"
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto border border-card-border/50 rounded-xl divide-y divide-card-border/30 bg-slate-950/20 text-xs">
              {allDocsQuery.isPending ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-cyan" />
                </div>
              ) : unlinkedDocs.length === 0 ? (
                <div className="text-center py-10 text-slate-600 italic">
                  No unlinked files available.
                </div>
              ) : (
                unlinkedDocs.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-3 hover:bg-slate-900/10">
                    <div className="truncate max-w-[280px]">
                      <p className="font-semibold text-slate-300 truncate" title={doc.file_name}>{doc.file_name}</p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatFileSize(doc.file_size_bytes)} • {doc.file_type.split("/").pop()?.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      onClick={() => linkDocMutation.mutate(doc.id)}
                      disabled={linkDocMutation.isPending}
                      variant="outline"
                      className="h-7 px-3 border-card-border hover:bg-slate-800 text-accent-cyan hover:text-slate-200 text-[10px] shrink-0 font-semibold cursor-pointer"
                    >
                      {linkDocMutation.isPending ? "Linking..." : "Link"}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-card-border/50">
              <Button
                onClick={() => setIsLinkDocModalOpen(false)}
                variant="outline"
                className="h-8 py-0 px-4 border-card-border hover:bg-slate-900 text-slate-400 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#020408]/60 backdrop-blur-sm" onClick={() => setIsAddMemberModalOpen(false)} />

          <div className="relative w-full max-w-md bg-[#080F1E] border border-card-border rounded-2xl shadow-2xl p-6 space-y-5 z-10">
            <div className="flex items-center justify-between border-b border-card-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent-cyan" />
                <h3 className="font-bold text-slate-200 text-sm font-mono tracking-wide uppercase">
                  Invite Member to WS
                </h3>
              </div>
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error alerts */}
            {addMemberMutation.isError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10.5px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {addMemberMutation.error instanceof Error
                    ? addMemberMutation.error.message
                    : "Failed to invite user membership."}
                </span>
              </div>
            )}

            {/* Tab selection within modal */}
            <div className="flex border-b border-card-border/40 text-xs">
              <button
                onClick={() => setAddMode("email")}
                className={cn(
                  "flex-1 py-2 font-semibold text-center border-b-2 cursor-pointer transition-all",
                  addMode === "email" ? "border-accent-cyan text-accent-cyan" : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                Invite by Email
              </button>
              <button
                onClick={() => setAddMode("id")}
                className={cn(
                  "flex-1 py-2 font-semibold text-center border-b-2 cursor-pointer transition-all",
                  addMode === "id" ? "border-accent-cyan text-accent-cyan" : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                Invite by User ID
              </button>
            </div>

            {/* Form */}
            <form onSubmit={addMemberForm.handleSubmit((v) => addMemberMutation.mutate(v))} className="space-y-4 text-xs">
              
              {addMode === "email" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="mem-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Corporate Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="mem-email"
                      type="email"
                      placeholder="colleague@company.com"
                      className={cn(
                        "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 text-xs text-slate-300 placeholder-slate-600",
                        addMemberForm.formState.errors.email && "border-rose-500/50"
                      )}
                      {...addMemberForm.register("email")}
                    />
                  </div>
                  {addMemberForm.formState.errors.email && (
                    <p className="text-xs text-rose-400 mt-1">{addMemberForm.formState.errors.email.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="mem-userid" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    User UUID
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="mem-userid"
                      type="text"
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className={cn(
                        "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 text-xs text-slate-300 placeholder-slate-600 font-mono",
                        addMemberForm.formState.errors.user_id && "border-rose-500/50"
                      )}
                      {...addMemberForm.register("user_id")}
                    />
                  </div>
                  {addMemberForm.formState.errors.user_id && (
                    <p className="text-xs text-rose-400 mt-1">{addMemberForm.formState.errors.user_id.message}</p>
                  )}
                </div>
              )}

              {/* Role Select */}
              <div className="space-y-1.5">
                <Label htmlFor="mem-role" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Workspace Access Role
                </Label>
                <select
                  id="mem-role"
                  className="w-full h-9 rounded-lg bg-slate-900 border border-card-border text-slate-300 px-3 focus:outline-none focus:border-accent-cyan/50 cursor-pointer font-mono"
                  {...addMemberForm.register("member_role")}
                >
                  <option value="MEMBER">MEMBER (Read & write document mappings)</option>
                  <option value="VIEWER">VIEWER (Read-only query access)</option>
                  <option value="ADMIN">ADMIN (Full management and role editing)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-card-border/50">
                <Button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  variant="outline"
                  className="h-8 py-0 px-4 border-card-border hover:bg-slate-900 text-slate-400 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="flex items-center gap-1.5 py-0 h-8 px-4 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-md font-semibold text-white border-none cursor-pointer"
                >
                  {addMemberMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Invite</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
