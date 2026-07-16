"use client";

// ---------------------------------------------------------------------------
// SettingsPage — Profile, change password, API key management & tenant config
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/store/toast-store";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { usersService } from "@/services/users.service";
import { settingsService } from "@/services/settings.service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Key,
  Sliders,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Building,
  Calendar,
  Lock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

// Change Password Validation Schema
const passwordSchema = z
  .object({
    old_password: z.string().min(1, { message: "Current password is required." }),
    new_password: z.string().min(8, { message: "New password must be at least 8 characters." }),
    confirm_password: z.string().min(1, { message: "Please confirm your new password." }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "New passwords do not match.",
    path: ["confirm_password"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

// Create API Key Schema
const apiKeySchema = z.object({
  name: z.string().min(1, { message: "API key name is required." }),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"profile" | "api-keys" | "config">("profile");

  // Show/Hide Password States
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password update feedback
  const [passwordStatus, setPasswordStatus] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // Modal & API Key Display State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [displayedRawKey, setDisplayedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  
  // Confirmation state for revoking a key
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);

  // Queries
  const apiKeysQuery = useQuery({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const response = await authService.listApiKeys();
      return response.data;
    },
    enabled: activeTab === "api-keys",
  });

  const tenantConfigQuery = useQuery({
    queryKey: ["tenantConfig"],
    queryFn: async () => {
      const response = await settingsService.getConfig();
      return response.data;
    },
    enabled: activeTab === "config",
  });

  // Forms
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const apiKeyForm = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
    },
  });

  // Mutations
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      if (!user) throw new Error("Not logged in");
      setPasswordStatus({ status: "idle" });
      await usersService.updatePassword(user.user_id, {
        old_password: data.old_password,
        new_password: data.new_password,
      });
    },
    onSuccess: () => {
      setPasswordStatus({
        status: "success",
        message: "Password changed successfully.",
      });
      passwordForm.reset();
      setTimeout(() => setPasswordStatus({ status: "idle" }), 4000);
    },
    onError: (err: unknown) => {
      setPasswordStatus({
        status: "error",
        message: (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to change password. Please check your credentials.",
      });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormValues) => {
      const response = await authService.createApiKey({ name: data.name });
      return response.data;
    },
    onSuccess: (data) => {
      setDisplayedRawKey(data.raw_key);
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      apiKeyForm.reset();
      setIsKeyModalOpen(false);
      toast.success("API key generated successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to generate API key.";
      toast.error(msg);
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await authService.rotateApiKey(keyId);
      return response.data;
    },
    onSuccess: (data) => {
      setDisplayedRawKey(data.raw_key);
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.success("API key successfully rotated.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to rotate API key.";
      toast.error(msg);
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await authService.deleteApiKey(keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      setKeyToRevoke(null);
      toast.success("API key successfully revoked.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to revoke API key.";
      toast.error(msg);
    },
  });

  const handleCopyRawKey = () => {
    if (displayedRawKey) {
      navigator.clipboard.writeText(displayedRawKey);
      setCopiedKey(true);
      toast.success("API key copied to clipboard.");
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const onSubmitPassword = (data: PasswordFormValues) => {
    passwordMutation.mutate(data);
  };

  const onSubmitApiKey = (data: ApiKeyFormValues) => {
    createKeyMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
          Settings Console
        </h1>
        <p className="text-xs text-[#7A8C9E] font-sans mt-1">
          Manage your secure profile, access credentials, and review tenant configs.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200/50">
        <button
          onClick={() => {
            setActiveTab("profile");
            setDisplayedRawKey(null);
          }}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "profile"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <User className="w-4 h-4" />
          Profile
        </button>
        <button
          onClick={() => {
            setActiveTab("api-keys");
            setDisplayedRawKey(null);
          }}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "api-keys"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Key className="w-4 h-4" />
          API Keys
        </button>
        <button
          onClick={() => {
            setActiveTab("config");
            setDisplayedRawKey(null);
          }}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "config"
              ? "border-primary text-primary bg-blue-50/20"
              : "border-transparent text-[#7A8C9E] hover:text-[#3E4E63]"
          )}
        >
          <Sliders className="w-4 h-4" />
          Tenant Config
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div className="space-y-6">
        
        {/* 1. PROFILE TAB */}
        {activeTab === "profile" && user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: User Profile Info */}
            <div className="md:col-span-2 space-y-6">
              <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] shrink-0">
                  {user.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="space-y-2 min-w-0">
                  <h2 className="text-base font-bold text-[#3E4E63] truncate">
                    {user.name}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 uppercase font-bold">
                      {user.role}
                    </span>
                    <span className="px-2 py-0.5 rounded border border-[#c2d0e6] bg-[#E6EEF8] shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-[#7A8C9E]">
                      ID: {user.user_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Profile Details */}
              <div className="p-6 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none space-y-4">
                <h3 className="text-xs font-bold text-[#5A6E85] uppercase font-mono tracking-wider border-b border-slate-200 pb-2">
                  System Context
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7A8C9E] uppercase font-bold block">Organization ID</span>
                    <div className="flex items-center gap-1.5 text-[#3E4E63]">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span>{user.tenant_id}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7A8C9E] uppercase font-bold block">Email Address</span>
                    <div className="flex items-center gap-1.5 text-[#3E4E63]">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7A8C9E] uppercase font-bold block">Session Created At</span>
                    <div className="flex items-center gap-1.5 text-[#3E4E63]">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{formatDate(user.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#7A8C9E] uppercase font-bold block">Last Login Timestamp</span>
                    <div className="flex items-center gap-1.5 text-[#3E4E63]">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{user.last_login_at ? formatDate(user.last_login_at) : "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Password Form & Logout */}
            <div className="space-y-6">
              {/* Change Password Panel */}
              <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none space-y-4">
                <h3 className="text-xs font-bold text-[#3E4E63] uppercase font-mono tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Credentials Override
                </h3>

                {passwordStatus.status === "success" && (
                  <div className="p-3 rounded-xl bg-emerald-50 border-none flex items-start gap-2 text-xs text-emerald-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                {passwordStatus.status === "error" && (
                  <div className="p-3 rounded-xl bg-rose-50 border-none flex items-start gap-2 text-xs text-rose-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4 text-xs">
                  {/* Old Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="old_password" className="text-[10px] uppercase font-bold font-mono text-[#7A8C9E]">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="old_password"
                        type={showOldPassword ? "text" : "password"}
                        className="bg-[#E6EEF8] border-none text-[#3E4E63] text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 rounded-full pr-10 pl-4 h-9"
                        {...passwordForm.register("old_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-[#3E4E63] cursor-pointer"
                      >
                        {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.old_password && (
                      <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                        {passwordForm.formState.errors.old_password.message}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password" className="text-[10px] uppercase font-bold font-mono text-[#7A8C9E]">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        className="bg-[#E6EEF8] border-none text-[#3E4E63] text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 rounded-full pr-10 pl-4 h-9"
                        {...passwordForm.register("new_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-[#3E4E63] cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.new_password && (
                      <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                        {passwordForm.formState.errors.new_password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password" className="text-[10px] uppercase font-bold font-mono text-[#7A8C9E]">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        className="bg-[#E6EEF8] border-none text-[#3E4E63] text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 rounded-full pr-10 pl-4 h-9"
                        {...passwordForm.register("confirm_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-[#3E4E63] cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirm_password && (
                      <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                        {passwordForm.formState.errors.confirm_password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="w-full h-9 bg-gradient-to-r from-blue-400 to-blue-600 text-white cursor-pointer uppercase font-mono tracking-wider font-bold rounded-full border-none shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:brightness-110"
                  >
                    {passwordMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-white" />
                    ) : null}
                    Save Override
                  </Button>
                </form>
              </div>

              {/* Dangerous Area */}
              <div className="p-5 rounded-2xl bg-rose-50 border-none space-y-3 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff]">
                <span className="text-[10px] font-bold text-rose-600 font-mono uppercase tracking-wider block">
                  Session Operations
                </span>
                <Button
                  onClick={logout}
                  className="w-full h-9 bg-rose-100 border-none hover:bg-rose-200 text-rose-600 font-bold uppercase font-mono tracking-wider flex items-center justify-center gap-2 cursor-pointer rounded-full shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]"
                >
                  <LogOut className="w-4 h-4" />
                  Close Terminal Session
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. API KEYS TAB */}
        {activeTab === "api-keys" && (
          <div className="space-y-6">
            
            {/* Warning / Raw Key Output Header */}
            {displayedRawKey && (
              <div className="p-5 rounded-2xl bg-blue-50 border-none space-y-3 animate-fade-in shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">
                      Credentials Generated Successfully
                    </h4>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed">
                      Copy the API key below. For your security, this key is only displayed **once**. You will not be able to retrieve it again.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#E6EEF8] p-3 rounded-full shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] font-mono text-sm">
                  <span className="text-[#3E4E63] break-all select-all flex-1 pl-3">{displayedRawKey}</span>
                  <button
                    onClick={handleCopyRawKey}
                    className="p-2 rounded-full hover:shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] text-primary transition-all cursor-pointer bg-[#E6EEF8]"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* List and Create Bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#5A6E85] font-mono uppercase tracking-widest block">
                Access keys ({apiKeysQuery.data?.total ?? 0})
              </span>
              
              <Button
                onClick={() => setIsKeyModalOpen(true)}
                className="h-9 px-4 bg-gradient-to-r from-blue-400 to-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer border-none shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] rounded-full"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Generate Key
              </Button>
            </div>

            {/* Keys Table */}
            <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-[#D0DBEA]/30 font-mono uppercase tracking-wider text-[10px] text-[#7A8C9E]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Key Name</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Generated</th>
                    <th className="px-5 py-3 font-semibold">Expires</th>
                    <th className="px-5 py-3 font-semibold">Last Used</th>
                    <th className="px-5 py-3 font-semibold text-right">Console Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[#3E4E63]">
                  {apiKeysQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#7A8C9E]">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        <span>Loading active key list...</span>
                      </td>
                    </tr>
                  ) : !apiKeysQuery.data?.api_keys || apiKeysQuery.data.api_keys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#7A8C9E] italic">
                        <span>No API keys defined. Generate one above to access client tools.</span>
                      </td>
                    </tr>
                  ) : (
                    apiKeysQuery.data.api_keys.map((key) => (
                      <tr key={key.key_id} className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer">
                        <td className="px-5 py-4 font-semibold">{key.name}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider border",
                            key.is_active 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                              : "bg-rose-50 border-rose-200 text-rose-600"
                          )}>
                            {key.is_active ? "Active" : "Revoked"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#5A6E85]">{formatDate(key.created_at)}</td>
                        <td className="px-5 py-4 text-[#5A6E85]">
                          {key.expires_at ? formatDate(key.expires_at) : "Never"}
                        </td>
                        <td className="px-5 py-4 text-[#5A6E85]">
                          {key.last_used_at ? formatDate(key.last_used_at) : "Never"}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setDisplayedRawKey(null);
                              rotateKeyMutation.mutate(key.key_id);
                            }}
                            disabled={rotateKeyMutation.isPending}
                            className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-primary transition-all cursor-pointer border-none"
                            title="Rotate Key"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setKeyToRevoke(key.key_id)}
                            className="p-1.5 rounded-full bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff] text-slate-500 hover:text-rose-600 transition-all cursor-pointer border-none"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* CREATE KEY MODAL */}
            {isKeyModalOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                    <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      Generate API Key
                    </h3>
                    <button
                      onClick={() => setIsKeyModalOpen(false)}
                      className="p-1.5 rounded-full hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={apiKeyForm.handleSubmit(onSubmitApiKey)} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <Label htmlFor="key-name" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                        API Key Identifier
                      </Label>
                      <Input
                        id="key-name"
                        value={apiKeyForm.watch("name")}
                        placeholder="e.g. Jenkins CI/CD integration"
                        className="bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 focus-visible:border-primary/40 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full pl-4"
                        {...apiKeyForm.register("name")}
                        required
                      />
                      {apiKeyForm.formState.errors.name && (
                        <p className="text-[10px] text-rose-500 font-mono mt-0.5">
                          {apiKeyForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsKeyModalOpen(false)}
                        className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createKeyMutation.isPending}
                        className="h-9 px-4 bg-gradient-to-tr from-blue-400 to-blue-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] border-none text-white cursor-pointer font-mono uppercase tracking-wider rounded-full"
                      >
                        {createKeyMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        ) : null}
                        Generate
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* REVOKE CONFIRMATION MODAL */}
            {keyToRevoke && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
                  <h3 className="text-sm font-bold text-rose-600 uppercase font-mono tracking-wider">
                    Confirm Key Revocation
                  </h3>
                  <p className="text-xs text-[#5A6E85] leading-relaxed">
                    Are you sure you want to revoke this API key? Applications using this credential will lose access to RAG endpoints immediately.
                  </p>
                  <div className="flex justify-end gap-3 pt-2 text-xs">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setKeyToRevoke(null)}
                      className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => revokeKeyMutation.mutate(keyToRevoke)}
                      disabled={revokeKeyMutation.isPending}
                      className="h-9 px-4 bg-rose-100 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-rose-600 hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] cursor-pointer font-mono uppercase tracking-wider border-none rounded-full"
                    >
                      {revokeKeyMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                      ) : null}
                      Confirm Revoke
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. TENANT CONFIG TAB */}
        {activeTab === "config" && (
          <div className="p-6 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none space-y-6 max-w-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Sliders className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider">
                Grounded Model Blueprint
              </h3>
            </div>

            {tenantConfigQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-[10px] font-mono uppercase">Loading blueprint...</span>
              </div>
            ) : tenantConfigQuery.isError ? (
              <div className="p-4 rounded-xl bg-rose-50 border-none text-xs text-rose-600 font-bold shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]">
                Failed to load tenant configurations. Please contact your administrator.
              </div>
            ) : tenantConfigQuery.data ? (
              <div className="space-y-5 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">LLM Provider</span>
                    <span className="text-sm font-bold text-[#3E4E63]">{tenantConfigQuery.data.llm_provider.toUpperCase()}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">Active Model ID</span>
                    <span className="text-sm font-bold text-[#3E4E63] truncate block">{tenantConfigQuery.data.llm_model}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">Temperature Bias</span>
                    <span className="text-sm font-bold text-[#3E4E63]">{tenantConfigQuery.data.temperature}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">Query Expansion Context</span>
                    <span className={cn(
                      "text-xs font-bold font-mono px-2 py-0.5 rounded-full inline-block mt-1 border",
                      tenantConfigQuery.data.query_expansion
                        ? "bg-blue-50 border-blue-200 text-blue-600"
                        : "bg-slate-100 border-slate-200 text-slate-500"
                    )}>
                      {tenantConfigQuery.data.query_expansion ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">Ingestion Rate Limit</span>
                    <span className="text-sm font-bold text-[#3E4E63]">{tenantConfigQuery.data.rate_limit_ingest} req/min</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] border-none space-y-1">
                    <span className="text-[9px] text-[#7A8C9E] uppercase font-bold block">Search Rate Limit</span>
                    <span className="text-sm font-bold text-[#3E4E63]">{tenantConfigQuery.data.rate_limit_query} req/min</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] border-none text-[#7A8C9E] leading-normal flex gap-2 font-sans">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[10px]">
                    To edit tenant config parameters (LLM provider models, biases, and rate limits), please coordinate with your Super Admin via the Administration Console.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

      </div>
    </div>
  );
}
