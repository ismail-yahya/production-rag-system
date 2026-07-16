"use client";

// ---------------------------------------------------------------------------
// UsersTable — Searchable list of tenant users with CRUD operations & escalation guards
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService } from "@/services/users.service";
import { useAuth } from "@/providers/auth-provider";
import { ROLE_BADGE_CONFIG } from "@/lib/constants";
import { toast } from "@/store/toast-store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Key,
  ShieldAlert,
  Loader2,
  X,
  UserCheck,
  UserX,
  Mail,
  User,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import type { UserResponse } from "@/types";

// Create User Schema
const createUserSchema = z.object({
  email: z.string().email({ message: "Invalid email format." }),
  name: z.string().min(1, { message: "Name is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  role: z.enum(["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

// Edit User Schema
const editUserSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  role: z.enum(["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const),
  is_active: z.boolean(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

// Reset Password Schema
const adminResetPasswordSchema = z.object({
  new_password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type AdminResetPasswordFormValues = z.infer<typeof adminResetPasswordSchema>;

export function UsersTable() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserResponse | null>(null);
  const [selectedUserForPasswordReset, setSelectedUserForPasswordReset] = useState<UserResponse | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  // Queries
  const usersQuery = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const response = await usersService.list();
      return response.data;
    },
  });

  // Forms
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: "USER",
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });

  const resetPasswordForm = useForm<AdminResetPasswordFormValues>({
    resolver: zodResolver(adminResetPasswordSchema),
    defaultValues: {
      new_password: "",
    },
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormValues) => {
      await usersService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setIsCreateModalOpen(false);
      createForm.reset();
      toast.success("User onboarded successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to onboard user.";
      toast.error(msg);
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async (data: EditUserFormValues) => {
      if (!selectedUserForEdit) return;
      await usersService.update(selectedUserForEdit.user_id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setSelectedUserForEdit(null);
      toast.success("User profile updated successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to update user profile.";
      toast.error(msg);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: AdminResetPasswordFormValues) => {
      if (!selectedUserForPasswordReset) return;
      await usersService.updatePassword(selectedUserForPasswordReset.user_id, {
        new_password: data.new_password,
      });
    },
    onSuccess: () => {
      setSelectedUserForPasswordReset(null);
      resetPasswordForm.reset();
      toast.success("User password reset successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to reset password.";
      toast.error(msg);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await usersService.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setUserToDelete(null);
      toast.success("User account deactivated successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to deactivate user.";
      toast.error(msg);
    },
  });

  // Security Guards helper (current user vs target user)
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  
  const canModifyUser = (targetUser: UserResponse) => {
    // Cannot modify self through user list table (self operations are in settings)
    if (targetUser.user_id === currentUser?.user_id) return false;
    // ADMIN cannot modify SUPER_ADMIN
    if (targetUser.role === "SUPER_ADMIN" && !isSuperAdmin) return false;
    return true;
  };

  const handleOpenEdit = (target: UserResponse) => {
    setSelectedUserForEdit(target);
    editForm.reset({
      name: target.name,
      role: target.role,
      is_active: target.is_active,
    });
  };

  const onSubmitCreate = (data: CreateUserFormValues) => {
    createUserMutation.mutate(data);
  };

  const onSubmitEdit = (data: EditUserFormValues) => {
    editUserMutation.mutate(data);
  };

  const onSubmitResetPassword = (data: AdminResetPasswordFormValues) => {
    resetPasswordMutation.mutate(data);
  };

  const usersList = usersQuery.data?.users || [];
  const filteredUsers = usersList.filter((usr) => {
    const matchesSearch =
      usr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usr.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || usr.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#E6EEF8] p-4 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user database..."
              className="pl-9 h-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs focus-visible:ring-primary/20 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#E6EEF8] border-none rounded-full py-1 px-3 text-[#3E4E63] hover:text-[#3E4E63] transition-all text-xs font-mono outline-none cursor-pointer h-9 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] focus:ring-1 focus:ring-primary/20"
            >
              <option value="all" className="bg-[#E6EEF8] text-[#3E4E63]">All Roles</option>
              <option value="USER" className="bg-[#E6EEF8] text-[#3E4E63]">User</option>
              <option value="MANAGER" className="bg-[#E6EEF8] text-[#3E4E63]">Manager</option>
              <option value="ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Admin</option>
              <option value="SUPER_ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Super Admin</option>
            </select>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="h-9 px-4 bg-gradient-to-r from-blue-400 to-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer border-none shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] rounded-full hover:brightness-110"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Onboard User
        </Button>
      </div>

      {/* Users Database Table */}
      <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
          <thead className="bg-[#D0DBEA]/30 font-mono uppercase tracking-wider text-[10px] text-[#7A8C9E]">
            <tr>
              <th className="px-5 py-3 font-semibold">User Details</th>
              <th className="px-5 py-3 font-semibold">Role Badge</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Joined At</th>
              <th className="px-5 py-3 font-semibold">Last Login</th>
              <th className="px-5 py-3 font-semibold text-right">Access Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-[#3E4E63]">
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#7A8C9E]">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <span>Loading user profiles...</span>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#7A8C9E] italic">
                  <span>No user accounts found matching selected criteria.</span>
                </td>
              </tr>
            ) : (
              filteredUsers.map((usr) => {
                const canModify = canModifyUser(usr);
                return (
                  <tr key={usr.user_id} className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer">
                    <td className="px-5 py-4">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[#3E4E63] truncate">{usr.name}</span>
                        <span className="text-[10px] text-[#7A8C9E] truncate mt-0.5">{usr.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider border",
                        ROLE_BADGE_CONFIG[usr.role]?.className || "bg-slate-100 border-slate-200 text-slate-500"
                      )}>
                        {usr.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "flex items-center gap-1.5 text-[10px] font-bold",
                        usr.is_active ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {usr.is_active ? <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> : <UserX className="w-3.5 h-3.5 text-rose-600" />}
                        {usr.is_active ? "Enabled" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#5A6E85]">{formatDate(usr.created_at)}</td>
                    <td className="px-5 py-4 text-[#5A6E85]">
                      {usr.last_login_at ? formatDate(usr.last_login_at) : "Never"}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {canModify ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(usr)}
                            className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-primary transition-all cursor-pointer border-none"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPasswordReset(usr)}
                            className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-primary transition-all cursor-pointer border-none"
                            title="Override Credentials"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(usr)}
                            className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-rose-600 transition-all cursor-pointer border-none"
                            title="Deactivate User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : usr.user_id === currentUser?.user_id ? (
                        <span className="text-[10px] text-[#7A8C9E] italic pr-2 font-mono">Self Account</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider pr-2">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          Elevated Guard
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Onboard Workspace Operator
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                  <Input
                    id="email"
                    placeholder="e.g. operator@domain.com"
                    className="pl-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 pr-10 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full h-9"
                    {...createForm.register("email")}
                    required
                  />
                </div>
                {createForm.formState.errors.email && (
                  <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                    {createForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Operator Display Name
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                  <Input
                    id="name"
                    placeholder="e.g. John Doe"
                    className="pl-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 pr-10 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full h-9"
                    {...createForm.register("name")}
                    required
                  />
                </div>
                {createForm.formState.errors.name && (
                  <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password-field" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Temporary Password
                </Label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                  <Input
                    id="password-field"
                    type={showPassword ? "text" : "password"}
                    className="pl-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 pr-10 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full h-9"
                    {...createForm.register("password")}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-[#3E4E63] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createForm.formState.errors.password && (
                  <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                    {createForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role-select" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Assigned Authority Scope
                </Label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                  <select
                    id="role-select"
                    className="pl-9 w-full bg-[#E6EEF8] border-none rounded-full py-2 px-3 text-[#3E4E63] text-xs font-mono outline-none cursor-pointer shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20"
                    {...createForm.register("role")}
                  >
                    <option value="USER" className="bg-[#E6EEF8] text-[#3E4E63]">User (Query and Chat)</option>
                    <option value="MANAGER" className="bg-[#E6EEF8] text-[#3E4E63]">Manager (Manage Workspaces)</option>
                    <option value="ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Admin (Manage Users and Audits)</option>
                    {isSuperAdmin && (
                      <option value="SUPER_ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Super Admin (Full Tenant Config)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="h-9 px-4 bg-gradient-to-r from-blue-400 to-blue-600 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] border-none text-white cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-white" />
                  ) : null}
                  Confirm Onboard
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
                Edit Authority Details
              </h3>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Display Name
                </Label>
                <Input
                  id="edit-name"
                  className="bg-[#E6EEF8] border-none text-[#3E4E63] focus-visible:ring-primary/20 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full h-9 pl-4"
                  {...editForm.register("name")}
                  required
                />
                {editForm.formState.errors.name && (
                  <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-role" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Assigned Authority Scope
                </Label>
                <select
                  id="edit-role"
                  className="w-full bg-[#E6EEF8] border-none rounded-full py-2 px-3 text-[#3E4E63] text-xs font-mono outline-none cursor-pointer shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus:ring-1 focus:ring-primary/20"
                  {...editForm.register("role")}
                >
                  <option value="USER" className="bg-[#E6EEF8] text-[#3E4E63]">User (Query and Chat)</option>
                  <option value="MANAGER" className="bg-[#E6EEF8] text-[#3E4E63]">Manager (Manage Workspaces)</option>
                  <option value="ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Admin (Manage Users and Audits)</option>
                  {isSuperAdmin && (
                    <option value="SUPER_ADMIN" className="bg-[#E6EEF8] text-[#3E4E63]">Super Admin (Full Tenant Config)</option>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none">
                <Label htmlFor="edit-active" className="text-[#7A8C9E] font-mono uppercase text-[10px] cursor-pointer font-bold">
                  Operator Enabled
                </Label>
                <input
                  id="edit-active"
                  type="checkbox"
                  className="w-4 h-4 accent-primary bg-[#E6EEF8] border-[#c2d0e6] text-primary rounded cursor-pointer"
                  {...editForm.register("is_active")}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editUserMutation.isPending}
                  className="h-9 px-4 bg-gradient-to-r from-blue-400 to-blue-600 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] border-none text-white cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
                >
                  {editUserMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-white" />
                  ) : null}
                  Confirm
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE PASSWORD MODAL */}
      {selectedUserForPasswordReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <h3 className="text-sm font-bold text-rose-600 uppercase font-mono tracking-wider">
                Reset Operator Password
              </h3>
              <button
                onClick={() => setSelectedUserForPasswordReset(null)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={resetPasswordForm.handleSubmit(onSubmitResetPassword)} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-rose-50 border-none text-rose-600 text-[10px] leading-normal font-sans shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold">
                You are resetting the password for <span className="font-bold font-mono">{selectedUserForPasswordReset.name}</span>. This will override their credentials immediately.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  New Override Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    className="bg-[#E6EEF8] border-none text-[#3E4E63] focus-visible:ring-primary/20 pr-10 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full h-9 pl-4"
                    {...resetPasswordForm.register("new_password")}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-[#3E4E63] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {resetPasswordForm.formState.errors.new_password && (
                  <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                    {resetPasswordForm.formState.errors.new_password.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setSelectedUserForPasswordReset(null)}
                  className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="h-9 px-4 bg-rose-100 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-rose-600 hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] cursor-pointer font-mono uppercase tracking-wider border-none rounded-full font-bold"
                >
                  {resetPasswordMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-rose-600" />
                  ) : null}
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-rose-600 uppercase font-mono tracking-wider">
              Confirm Account Deactivation
            </h3>
            <p className="text-xs text-[#5A6E85] leading-relaxed">
              Are you sure you want to deactivate <span className="font-bold text-[#3E4E63]">{userToDelete.name}</span>? Their access credentials will be blocked immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2 text-xs">
              <Button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => deleteUserMutation.mutate(userToDelete.user_id)}
                disabled={deleteUserMutation.isPending}
                className="h-9 px-4 bg-rose-100 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-rose-600 hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] cursor-pointer font-mono uppercase tracking-wider border-none rounded-full font-bold"
              >
                {deleteUserMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-rose-600" />
                ) : null}
                Confirm Block
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
