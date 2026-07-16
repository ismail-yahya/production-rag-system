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
          <h1 className="text-xl md:text-2xl font-bold text-[#3E4E63] tracking-tight">
            Workspaces
          </h1>
          <p className="text-[#7A8C9E] text-sm">
            Logical partitions segmenting indexes, members, and prompt-grounded search scopes.
          </p>
        </div>
        
        {/* Create workspace button visible to MANAGER+ */}
        {canCreate && (
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 hover:brightness-110 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-sm font-bold text-white border-none cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workspace</span>
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 z-10" />
          <Input
            type="text"
            placeholder="Search workspaces by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 rounded-full"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-40 bg-[#E6EEF8] border-none rounded-full py-1.5 px-3 text-[#5A6E85] hover:text-[#3E4E63] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all text-xs font-mono outline-none cursor-pointer"
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
            <div key={n} className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] min-h-[160px] flex flex-col justify-between">
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
        <div className="text-center py-24 border-2 border-dashed border-[#c2d0e6] bg-[#E6EEF8] rounded-2xl space-y-4 shadow-sm">
          <FolderGit2 className="w-14 h-14 text-[#7A8C9E] mx-auto animate-pulse" />
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h4 className="text-sm font-semibold text-[#5A6E85]">No workspaces matching filters</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Active indexes and document memberships are scoped inside a workspace. Create or request access to start searching files.
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={handleOpenCreateModal}
              className="border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] text-xs py-0 h-8 px-3 cursor-pointer mt-1 rounded-full font-bold"
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
              className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all flex flex-col justify-between group relative overflow-hidden min-h-[160px]"
            >
              <div className="absolute inset-0 bg-transparent" />

              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="text-sm font-bold text-[#3E4E63] group-hover:text-primary transition-colors truncate">
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

                <p className="text-xs text-[#5A6E85] line-clamp-3 leading-relaxed">
                  {ws.description || "No description provided for this partition context."}
                </p>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200/50 text-[10px] text-[#7A8C9E] font-mono">
                <span>Created {formatDate(ws.created_at)}</span>
                <span className="flex items-center gap-1 text-[#7A8C9E] group-hover:text-primary transition-colors font-medium">
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={handleCloseCreateModal}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-6 z-10 transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-[#3E4E63] text-sm font-mono tracking-wide uppercase">
                  Initialize Workspace
                </h3>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error handling alert */}
            {createMutation.isError && (
              <div className="p-3 rounded-xl bg-rose-50 border-none text-rose-600 text-xs flex items-center gap-2 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold">
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
                <Label htmlFor="create-ws-name" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Workspace Name
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="create-ws-name"
                    type="text"
                    placeholder="e.g. Finance Research"
                    className={cn(
                      "pl-10 pr-4 py-2 rounded-full bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20",
                      errors.name && "shadow-[inset_2px_2px_4px_#ef4444,inset_-2px_-2px_4px_#ffffff]"
                    )}
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Type Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="create-ws-type" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Workspace Type
                </Label>
                <select
                  id="create-ws-type"
                  className={cn(
                    "w-full h-9 rounded-full bg-[#E6EEF8] border-none text-[#3E4E63] px-3 focus:outline-none cursor-pointer font-mono shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20",
                    errors.workspace_type && "shadow-[inset_2px_2px_4px_#ef4444,inset_-2px_-2px_4px_#ffffff]"
                  )}
                  {...register("workspace_type")}
                >
                  <option value="TEAM" className="bg-[#E6EEF8] text-[#3E4E63]">Team (Shared workspace for organization members)</option>
                  <option value="CENTRAL" className="bg-[#E6EEF8] text-[#3E4E63]">Central (Global indexing boundary)</option>
                  <option value="PERSONAL" className="bg-[#E6EEF8] text-[#3E4E63]">Personal (Private sandboxed workspace)</option>
                </select>
                {errors.workspace_type && (
                  <p className="text-xs text-rose-600 mt-1">{errors.workspace_type.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="create-ws-desc" className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Description
                </Label>
                <textarea
                  id="create-ws-desc"
                  rows={3}
                  placeholder="Summarize the core grounding context and boundaries of this workspace..."
                  className="w-full p-3 rounded-2xl bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus:outline-none resize-none shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20"
                  {...register("description")}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200/50">
                <Button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="h-9 py-0 px-4 border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer rounded-full font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 py-0 h-9 px-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 hover:brightness-110 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] font-bold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
