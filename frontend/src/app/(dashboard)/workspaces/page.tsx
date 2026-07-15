"use client";

// ---------------------------------------------------------------------------
// WorkspacesPage — Grid display and management controls for workspaces
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspacesService } from "@/services/workspaces.service";
import { useAuth } from "@/providers/auth-provider";
import { hasMinRole, WORKSPACE_TYPE_CONFIG } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import {
  FolderGit2,
  Plus,
  Search,
  Filter,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceType } from "@/types";

// Schema for Workspace Creation Form
const createWorkspaceSchema = z.object({
  name: z.string().min(2, { message: "Workspace name must be at least 2 characters." }),
  workspace_type: z.enum(["CENTRAL", "TEAM", "PERSONAL"]),
  description: z.string().optional(),
});

type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceSchema>;

export default function WorkspacesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 1. Fetch Workspaces Query
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await workspacesService.list();
      return response.data;
    },
    enabled: !!user,
  });

  // 2. React Hook Form Setup for Workspace Creation
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      workspace_type: "TEAM",
      description: "",
    },
  });

  // 3. Create Workspace Mutation
  const createMutation = useMutation({
    mutationFn: async (values: CreateWorkspaceFormValues) => {
      const response = await workspacesService.create({
        name: values.name,
        workspace_type: values.workspace_type,
        description: values.description || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsCreateModalOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const onSubmit = (values: CreateWorkspaceFormValues) => {
    createMutation.mutate(values);
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    createMutation.reset();
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    reset();
  };

  // Filter workspaces list
  const workspacesList = workspacesQuery.data || [];
  const filteredWorkspaces = workspacesList.filter((ws) => {
    const matchesSearch = ws.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || ws.workspace_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Check roles
  const canCreate = user ? hasMinRole(user.role, "MANAGER") : false;

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
            Workspaces
          </h1>
          <p className="text-slate-400 text-sm">
            Logical partitions segmenting indexes, members, and prompt-grounded search scopes.
          </p>
        </div>
        
        {/* Create workspace button visible to MANAGER+ */}
        {canCreate && (
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-md text-sm font-semibold text-white border-none cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workspace</span>
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-xl bg-slate-900/20 border border-card-border/60">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search workspaces by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950 border-card-border text-slate-300 placeholder-slate-600 text-xs"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg bg-slate-950 border border-card-border text-slate-400 px-3 text-xs font-mono focus:outline-none focus:border-accent-cyan/40 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="CENTRAL">Central</option>
            <option value="TEAM">Team</option>
            <option value="PERSONAL">Personal</option>
          </select>
        </div>
      </div>

      {/* Workspaces Grid */}
      {workspacesQuery.isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="p-5 rounded-2xl bg-slate-900/30 border border-card-border/80 min-h-[160px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 shrink-0" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-card-border/50 rounded-2xl space-y-4">
          <FolderGit2 className="w-14 h-14 text-slate-700 mx-auto" />
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h4 className="text-sm font-semibold text-slate-300">No workspaces matching filters</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Active indexes and document memberships are scoped inside a workspace. Create or request access to start searching files.
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={handleOpenCreateModal}
              variant="outline"
              className="border-card-border hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs py-0 h-8 px-3 cursor-pointer mt-1"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create first workspace</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="p-5 rounded-2xl bg-slate-900/30 border border-card-border/80 hover:border-accent-cyan/30 transition-all hover:bg-slate-900/60 shadow-md flex flex-col justify-between group relative overflow-hidden min-h-[160px]"
            >
              {/* Card Glow overlay */}
              <div className="absolute inset-0 bg-accent-cyan/0 group-hover:bg-accent-cyan/[0.01] transition-colors" />

              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className="w-4 h-4 text-accent-cyan shrink-0" />
                    <h3 className="text-sm font-bold text-slate-200 group-hover:text-accent-cyan transition-colors truncate">
                      {ws.name}
                    </h3>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono tracking-wider shrink-0 uppercase",
                    WORKSPACE_TYPE_CONFIG[ws.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.className
                  )}>
                    {WORKSPACE_TYPE_CONFIG[ws.workspace_type as keyof typeof WORKSPACE_TYPE_CONFIG]?.label}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {ws.description || "No description provided for this partition context."}
                </p>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-card-border/40 text-[10px] text-slate-500 font-mono">
                <span>Created {formatDate(ws.created_at)}</span>
                <span className="flex items-center gap-1 text-slate-400 group-hover:text-accent-cyan transition-colors font-medium">
                  <span>Enter</span>
                  <ArrowRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE WORKSPACE MODAL OVERLAY */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#020408]/60 backdrop-blur-sm transition-opacity"
            onClick={handleCloseCreateModal}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-[#080F1E] border border-card-border rounded-2xl shadow-2xl p-6 space-y-6 z-10 transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-card-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-cyan" />
                <h3 className="font-bold text-slate-200 text-sm font-mono tracking-wide uppercase">
                  Initialize Workspace
                </h3>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error handling alert */}
            {createMutation.isError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : "Failed to initialize workspace."}
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
              
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="create-ws-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Workspace Name
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="create-ws-name"
                    type="text"
                    placeholder="e.g. Finance Research"
                    className={cn(
                      "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-300 placeholder-slate-600 transition-colors",
                      errors.name && "border-rose-500/50 focus:border-rose-500"
                    )}
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Type Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="create-ws-type" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Workspace Type
                </Label>
                <select
                  id="create-ws-type"
                  className={cn(
                    "w-full h-9 rounded-lg bg-slate-900 border border-card-border text-slate-300 px-3 focus:outline-none focus:border-accent-cyan/50 cursor-pointer font-mono",
                    errors.workspace_type && "border-rose-500/50"
                  )}
                  {...register("workspace_type")}
                >
                  <option value="TEAM">Team (Shared workspace for organization members)</option>
                  <option value="CENTRAL">Central (Global indexing boundary)</option>
                  <option value="PERSONAL">Personal (Private sandboxed workspace)</option>
                </select>
                {errors.workspace_type && (
                  <p className="text-xs text-rose-400 mt-1">{errors.workspace_type.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="create-ws-desc" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Description
                </Label>
                <textarea
                  id="create-ws-desc"
                  rows={3}
                  placeholder="Summarize the core grounding context and boundaries of this workspace..."
                  className="w-full p-3 rounded-lg bg-slate-900 border border-card-border text-slate-300 placeholder-slate-600 focus:outline-none focus:border-accent-cyan/50 transition-colors resize-none"
                  {...register("description")}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-card-border/50">
                <Button
                  type="button"
                  onClick={handleCloseCreateModal}
                  variant="outline"
                  className="h-9 py-0 px-4 border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 py-0 h-9 px-4 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-md font-semibold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Initialize</span>
                      <ArrowRight className="w-4 h-4" />
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
