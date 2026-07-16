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
        <h3 className="text-sm font-semibold text-[#5A6E85]">Workspace Resolution Failed</h3>
        <p className="text-xs text-slate-400">The requested workspace parameters do not exist or access is restricted.</p>
        <Link
          href="/workspaces"
          className={cn(buttonVariants({ variant: "outline" }), "h-8 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] rounded-full font-bold")}
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
      <div className="p-6 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none relative overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-primary/5 blur-[80px] -right-25 -top-25 pointer-events-none" />
        
        {isEditing ? (
          <div className="space-y-4 relative z-10 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest">Workspace Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-[#E6EEF8] border-none text-sm text-[#3E4E63] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 max-w-md h-9 rounded-full"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest">Description</Label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full max-w-xl p-2.5 rounded-2xl bg-[#E6EEF8] border-none text-xs text-[#3E4E63] placeholder-slate-400 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => updateWorkspaceMutation.mutate()}
                disabled={updateWorkspaceMutation.isPending}
                className="flex items-center gap-1.5 h-8 py-0 px-3.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 hover:brightness-110 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] text-xs font-bold text-white border-none cursor-pointer"
              >
                {updateWorkspaceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                className="h-8 py-0 px-3.5 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] text-xs cursor-pointer rounded-full font-bold"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative z-10">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderGit2 className="w-5 h-5 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold text-[#3E4E63] tracking-tight">
                  {workspace.name}
                </h1>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono tracking-wider uppercase",
                  WORKSPACE_TYPE_CONFIG[workspace.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.className
                )}>
                  {WORKSPACE_TYPE_CONFIG[workspace.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.label}
                </span>
              </div>
              <p className="text-[#5A6E85] text-xs leading-relaxed">
                {workspace.description || "No description provided for this partition."}
              </p>
              <div className="text-[10px] text-[#7A8C9E] font-mono pt-1">
                Context ID: <span className="text-[#3E4E63] select-all">{workspace.id}</span> • Created {formatDate(workspace.created_at)}
              </div>
            </div>

            {/* Management actions */}
            {hasAdminAccess && (
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <Button
                  onClick={() => setIsEditing(true)}
                  className="h-8 px-2.5 text-xs border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer rounded-full font-bold"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  <span>Edit</span>
                </Button>

                {isConfirmDeleteOpen ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border-none p-1 rounded-full shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]">
                    <span className="text-[9px] text-rose-600 font-mono px-2 font-bold">Purge WS?</span>
                    <Button
                      onClick={() => deleteWorkspaceMutation.mutate()}
                      disabled={deleteWorkspaceMutation.isPending}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-semibold h-6 py-0 px-2.5 cursor-pointer text-[10px] border-none rounded-full"
                    >
                      {deleteWorkspaceMutation.isPending ? "Purging..." : "Confirm"}
                    </Button>
                    <Button
                      onClick={() => setIsConfirmDeleteOpen(false)}
                      className="h-6 py-0 px-2.5 border-none bg-[#E6EEF8] shadow-[1.5px_1.5px_3px_#c2d0e6,-1.5px_-1.5px_3px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-400 text-[10px] rounded-full"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    className="h-8 px-2.5 text-xs border-none bg-rose-100 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-rose-600 font-bold cursor-pointer rounded-full"
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
      <div className="flex border-b border-slate-200/50">
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === "documents"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
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
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
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
              <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex flex-col justify-between h-36">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#3E4E63] font-bold text-xs">
                    <Link2 className="w-4 h-4 text-primary" />
                    <span>Link Existing Document</span>
                  </div>
                  <p className="text-[11px] text-[#7A8C9E] leading-normal font-sans">
                    Map an existing file from the corporate index into this workspace search partition.
                  </p>
                </div>
                <Button
                  onClick={() => setIsLinkDocModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 h-8 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] font-bold text-xs cursor-pointer rounded-full transition-all"
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
                  "md:col-span-2 p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center select-none cursor-pointer h-36 relative overflow-hidden transition-all",
                  isDragging
                    ? "border-primary bg-blue-50 text-primary shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff]"
                    : "border-[#c2d0e6] bg-[#E6EEF8] hover:border-primary/40 text-[#7A8C9E]"
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
                  <UploadCloud className="w-6 h-6 mx-auto text-[#7A8C9E]" />
                  <div className="text-xs font-semibold">
                    <span className="text-primary hover:underline font-bold">Upload and link new document</span>
                  </div>
                  <p className="text-[9px] text-[#5A6E85] uppercase tracking-widest">
                    PDF, TXT, MD, Images (Max 10MB)
                  </p>
                </label>

                {/* Upload Status toast overlay */}
                {uploadStatus.status !== "idle" && (
                  <div className={cn(
                    "absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl border-none text-[10px] flex items-center gap-1.5 shadow-2xl",
                    uploadStatus.status === "uploading" && "bg-blue-50 border-blue-200 text-blue-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]",
                    uploadStatus.status === "success" && "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]",
                    uploadStatus.status === "error" && "bg-rose-50 border-rose-200 text-rose-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]"
                  )}>
                    {uploadStatus.status === "uploading" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : uploadStatus.status === "success" ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="font-semibold">{uploadStatus.message || "Uploading..."}</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Linked Documents Table */}
          <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
            {workspaceDocsQuery.isPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !workspaceDocsQuery.data || workspaceDocsQuery.data.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <FileText className="w-10 h-10 text-[#7A8C9E] mx-auto animate-pulse" />
                <h4 className="text-xs font-semibold text-[#5A6E85]">No documents mapped</h4>
                <p className="text-[10px] text-slate-400">Link or upload documents to query workspace partitions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/50 bg-[#D0DBEA]/30 text-[#7A8C9E] uppercase tracking-wider font-mono text-[9px]">
                      <th className="p-3.5 font-semibold">File Name</th>
                      <th className="p-3.5 font-semibold">Type</th>
                      <th className="p-3.5 font-semibold">Size</th>
                      <th className="p-3.5 font-semibold">Chunks</th>
                      <th className="p-3.5 font-semibold">Status</th>
                      {hasWriteAccess && <th className="p-3.5 font-semibold text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[#3E4E63]">
                    {workspaceDocsQuery.data.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer">
                        <td className="p-3.5 font-medium truncate max-w-xs">{doc.file_name}</td>
                        <td className="p-3.5 text-[#5A6E85] font-mono text-[10px] uppercase">
                          {doc.file_type.split("/").pop()}
                        </td>
                        <td className="p-3.5 text-[#5A6E85]">{formatFileSize(doc.file_size_bytes)}</td>
                        <td className="p-3.5 text-[#5A6E85] font-mono">{doc.chunk_count}</td>
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
                              className="h-7 px-2 border-none bg-rose-100 text-rose-600 hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] cursor-pointer text-[10px] rounded-full font-bold"
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
            <h3 className="text-xs font-bold text-[#5A6E85] uppercase tracking-widest font-mono">
              Access Group Directory
            </h3>
            
            {/* Add Member button (visible to Workspace ADMIN, Tenant ADMIN+) */}
            {hasAdminAccess && (
              <Button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] font-bold text-xs cursor-pointer rounded-full"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </Button>
            )}
          </div>

          {/* Members list Table */}
          <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
            {membersQuery.isPending ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !membersQuery.data || membersQuery.data.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Users className="w-10 h-10 text-[#7A8C9E] mx-auto animate-pulse" />
                <p className="text-xs text-slate-400">No members configured in the access table.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/50 bg-[#D0DBEA]/30 text-[#7A8C9E] uppercase tracking-wider font-mono text-[9px]">
                      <th className="p-3.5 font-semibold">User Display Name</th>
                      <th className="p-3.5 font-semibold">Corporate Email</th>
                      <th className="p-3.5 font-semibold">Joined At</th>
                      <th className="p-3.5 font-semibold">Workspace Role</th>
                      {hasAdminAccess && <th className="p-3.5 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[#3E4E63]">
                    {membersQuery.data.map((mem) => {
                      const isSelf = mem.user_id === user?.user_id;
                      
                      return (
                        <tr key={mem.user_id} className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer">
                          <td className="p-3.5 font-medium">
                            {mem.name} {isSelf && <span className="text-[9px] text-[#7A8C9E] font-mono">(You)</span>}
                          </td>
                          <td className="p-3.5 text-[#5A6E85] font-mono">{mem.email}</td>
                          <td className="p-3.5 text-[#7A8C9E] font-mono">{formatDate(mem.joined_at)}</td>
                          
                          {/* Workspace role editing dropdown */}
                          <td className="p-3.5">
                            {hasAdminAccess && !isSelf ? (
                              <select
                                value={mem.member_role}
                                onChange={(e) => updateMemberRoleMutation.mutate({
                                  userId: mem.user_id,
                                  role: e.target.value as WorkspaceMemberRole
                                })}
                                className="bg-[#E6EEF8] border-none rounded-full text-[10.5px] text-[#3E4E63] px-2.5 py-1 font-mono focus:outline-none cursor-pointer shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">ADMIN</option>
                                <option value="MEMBER" className="bg-[#E6EEF8] text-[#3E4E63]">MEMBER</option>
                                <option value="VIEWER" className="bg-[#E6EEF8] text-[#3E4E63]">VIEWER</option>
                              </select>
                            ) : (
                              <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded border font-bold font-mono tracking-wider",
                                mem.member_role === "ADMIN" && "bg-violet-50 border-violet-200 text-violet-600",
                                mem.member_role === "MEMBER" && "bg-blue-50 border-blue-200 text-blue-600",
                                mem.member_role === "VIEWER" && "bg-slate-100 border-slate-200 text-slate-500"
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
                                  className="h-7 px-2 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer text-[10px] rounded-full font-bold"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLinkDocModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-6 z-10">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-[#3E4E63] text-sm font-mono tracking-wide uppercase">
                  Link Corpus Document
                </h3>
              </div>
              <button
                onClick={() => setIsLinkDocModalOpen(false)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                type="text"
                placeholder="Search files in corporate tenant list..."
                value={docSearchTerm}
                onChange={(e) => setDocSearchTerm(e.target.value)}
                className="pl-9 bg-[#E6EEF8] border-none text-xs text-[#3E4E63] placeholder-slate-400 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full focus-visible:ring-primary/20"
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto border-none rounded-xl divide-y divide-slate-200 bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-xs">
              {allDocsQuery.isPending ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : unlinkedDocs.length === 0 ? (
                <div className="text-center py-10 text-[#7A8C9E] italic font-mono">
                  No unlinked files available.
                </div>
              ) : (
                unlinkedDocs.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-3 hover:bg-[#E6EEF8]/60">
                    <div className="truncate max-w-[280px]">
                      <p className="font-bold text-[#3E4E63] truncate" title={doc.file_name}>{doc.file_name}</p>
                      <span className="text-[10px] text-[#7A8C9E] font-mono">
                        {formatFileSize(doc.file_size_bytes)} • {doc.file_type.split("/").pop()?.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      onClick={() => linkDocMutation.mutate(doc.id)}
                      disabled={linkDocMutation.isPending}
                      className="h-7 px-3 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-primary hover:text-primary/80 text-[10px] shrink-0 font-bold cursor-pointer rounded-full transition-all"
                    >
                      {linkDocMutation.isPending ? "Linking..." : "Link"}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200/50">
              <Button
                onClick={() => setIsLinkDocModalOpen(false)}
                className="h-8 py-0 px-4 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer text-xs rounded-full font-bold"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddMemberModalOpen(false)} />

          <div className="relative w-full max-w-md bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-5 z-10">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-[#3E4E63] text-sm font-mono tracking-wide uppercase">
                  Invite Member to WS
                </h3>
              </div>
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error alerts */}
            {addMemberMutation.isError && (
              <div className="p-3 rounded-xl bg-rose-50 border-none text-rose-600 text-[10.5px] flex items-center gap-2 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {addMemberMutation.error instanceof Error
                    ? addMemberMutation.error.message
                    : "Failed to invite user membership."}
                </span>
              </div>
            )}

            {/* Tab selection within modal */}
            <div className="flex border-b border-slate-200/50 text-xs">
              <button
                type="button"
                onClick={() => setAddMode("email")}
                className={cn(
                  "flex-1 py-2 font-semibold text-center border-b-2 cursor-pointer transition-all",
                  addMode === "email" ? "border-primary text-primary" : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
                )}
              >
                Invite by Email
              </button>
              <button
                type="button"
                onClick={() => setAddMode("id")}
                className={cn(
                  "flex-1 py-2 font-semibold text-center border-b-2 cursor-pointer transition-all",
                  addMode === "id" ? "border-primary text-primary" : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
                )}
              >
                Invite by User ID
              </button>
            </div>

            {/* Form */}
            <form onSubmit={addMemberForm.handleSubmit((v) => addMemberMutation.mutate(v))} className="space-y-4 text-xs">
              
              {addMode === "email" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="mem-email" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                    Corporate Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="mem-email"
                      type="email"
                      placeholder="colleague@company.com"
                      className={cn(
                        "pl-10 pr-4 py-2 rounded-full bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20",
                        addMemberForm.formState.errors.email && "shadow-[inset_2px_2px_4px_#ef4444,inset_-2px_-2px_4px_#ffffff]"
                      )}
                      {...addMemberForm.register("email")}
                    />
                  </div>
                  {addMemberForm.formState.errors.email && (
                    <p className="text-xs text-rose-600 mt-1">{addMemberForm.formState.errors.email.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="mem-userid" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                    User UUID
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="mem-userid"
                      type="text"
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className={cn(
                        "pl-10 pr-4 py-2 rounded-full bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 font-mono",
                        addMemberForm.formState.errors.user_id && "shadow-[inset_2px_2px_4px_#ef4444,inset_-2px_-2px_4px_#ffffff]"
                      )}
                      {...addMemberForm.register("user_id")}
                    />
                  </div>
                  {addMemberForm.formState.errors.user_id && (
                    <p className="text-xs text-rose-600 mt-1">{addMemberForm.formState.errors.user_id.message}</p>
                  )}
                </div>
              )}

              {/* Role Select */}
              <div className="space-y-1.5">
                <Label htmlFor="mem-role" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Workspace Access Role
                </Label>
                <select
                  id="mem-role"
                  className="w-full h-9 rounded-full bg-[#E6EEF8] border-none text-[#3E4E63] px-3 focus:outline-none cursor-pointer font-mono shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20"
                  {...addMemberForm.register("member_role")}
                >
                  <option value="MEMBER" className="bg-[#E6EEF8] text-[#3E4E63]">MEMBER (Read & write document mappings)</option>
                  <option value="VIEWER" className="bg-[#E6EEF8] text-[#3E4E63]">VIEWER (Read-only query access)</option>
                  <option value="ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">ADMIN (Full management and role editing)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                <Button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="h-8 py-0 px-4 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer rounded-full font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="flex items-center gap-1.5 py-0 h-8 px-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 hover:brightness-110 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] font-bold text-white border-none cursor-pointer"
                >
                  {addMemberMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
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
