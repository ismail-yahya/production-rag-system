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
        <h1 className="text-xl font-bold text-slate-200 uppercase font-mono tracking-wider">
          Settings Console
        </h1>
        <p className="text-xs text-slate-500 font-sans mt-1">
          Manage your secure profile, access credentials, and review tenant configs.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-card-border/60">
        <button
          onClick={() => {
            setActiveTab("profile");
            setDisplayedRawKey(null);
          }}
          className={cn(
            "px-5 py-3 text-xs font-semibold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2",
            activeTab === "profile"
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5"
              : "border-transparent text-slate-500 hover:text-slate-300"
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
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5"
              : "border-transparent text-slate-500 hover:text-slate-300"
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
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5"
              : "border-transparent text-slate-500 hover:text-slate-300"
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
              <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-cyan to-accent-indigo flex items-center justify-center text-xl font-bold text-white shadow-xl shrink-0">
                  {user.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="space-y-2 min-w-0">
                  <h2 className="text-base font-bold text-slate-200 truncate">
                    {user.name}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-accent-indigo/20 text-accent-cyan border border-accent-cyan/15 uppercase font-bold">
                      {user.role}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950/60 text-slate-400 border border-card-border/60">
                      ID: {user.user_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Profile Details */}
              <div className="p-6 rounded-xl bg-slate-900/40 border border-card-border space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider border-b border-card-border/40 pb-2">
                  System Context
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Organization ID</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Building className="w-4 h-4 text-slate-600" />
                      <span>{user.tenant_id}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Email Address</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <User className="w-4 h-4 text-slate-600" />
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Session Created At</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <span>{formatDate(user.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Last Login Timestamp</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <span>{user.last_login_at ? formatDate(user.last_login_at) : "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Password Form & Logout */}
            <div className="space-y-6">
              {/* Change Password Panel */}
              <div className="p-5 rounded-xl bg-slate-900/40 border border-card-border space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-accent-indigo" />
                  Credentials Override
                </h3>

                {passwordStatus.status === "success" && (
                  <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/25 flex items-start gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                {passwordStatus.status === "error" && (
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/25 flex items-start gap-2 text-xs text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4 text-xs">
                  {/* Old Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="old_password" className="text-[10px] uppercase font-bold font-mono text-slate-500">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="old_password"
                        type={showOldPassword ? "text" : "password"}
                        className="bg-slate-950/40 border-card-border/60 text-slate-300 text-xs focus-visible:ring-accent-indigo/20 pr-10"
                        {...passwordForm.register("old_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.old_password && (
                      <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                        {passwordForm.formState.errors.old_password.message}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password" className="text-[10px] uppercase font-bold font-mono text-slate-500">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        className="bg-slate-950/40 border-card-border/60 text-slate-300 text-xs focus-visible:ring-accent-indigo/20 pr-10"
                        {...passwordForm.register("new_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.new_password && (
                      <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                        {passwordForm.formState.errors.new_password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password" className="text-[10px] uppercase font-bold font-mono text-slate-500">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        className="bg-slate-950/40 border-card-border/60 text-slate-300 text-xs focus-visible:ring-accent-indigo/20 pr-10"
                        {...passwordForm.register("confirm_password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirm_password && (
                      <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                        {passwordForm.formState.errors.confirm_password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="w-full h-9 bg-slate-900 border border-card-border hover:bg-slate-800 text-slate-200 cursor-pointer uppercase font-mono tracking-wider font-bold"
                  >
                    {passwordMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    ) : null}
                    Save Override
                  </Button>
                </form>
              </div>

              {/* Dangerous Area */}
              <div className="p-5 rounded-xl bg-rose-950/10 border border-rose-500/20 space-y-3">
                <span className="text-[10px] font-bold text-rose-400 font-mono uppercase tracking-wider block">
                  Session Operations
                </span>
                <Button
                  onClick={logout}
                  className="w-full h-9 bg-rose-950 border border-rose-500/20 hover:bg-rose-900 text-rose-400 font-bold uppercase font-mono tracking-wider flex items-center justify-center gap-2 cursor-pointer"
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
              <div className="p-5 rounded-xl bg-cyan-950/20 border border-accent-cyan/30 space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-accent-cyan font-mono uppercase tracking-wider">
                      Credentials Generated Successfully
                    </h4>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      Copy the API key below. For your security, this key is only displayed **once**. You will not be able to retrieve it again.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/80 p-3 rounded-lg border border-card-border/80 font-mono text-sm">
                  <span className="text-slate-300 break-all select-all flex-1">{displayedRawKey}</span>
                  <button
                    onClick={handleCopyRawKey}
                    className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-accent-cyan border border-card-border hover:text-white transition-all cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* List and Create Bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-widest block">
                Access keys ({apiKeysQuery.data?.total ?? 0})
              </span>
              
              <Button
                onClick={() => setIsKeyModalOpen(true)}
                className="h-9 px-4 bg-gradient-to-tr from-accent-indigo to-accent-violet hover:shadow-[0_0_12px_rgba(79,70,229,0.3)] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Generate Key
              </Button>
            </div>

            {/* Keys Table */}
            <div className="border border-card-border rounded-xl bg-slate-900/20 overflow-hidden">
              <table className="min-w-full divide-y divide-card-border text-xs text-left">
                <thead className="bg-slate-950/50 font-mono uppercase tracking-wider text-[10px] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Key Name</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Generated</th>
                    <th className="px-5 py-3 font-semibold">Expires</th>
                    <th className="px-5 py-3 font-semibold">Last Used</th>
                    <th className="px-5 py-3 font-semibold text-right">Console Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/40 font-mono text-slate-300">
                  {apiKeysQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-accent-cyan mx-auto mb-2" />
                        <span>Loading active key list...</span>
                      </td>
                    </tr>
                  ) : !apiKeysQuery.data?.api_keys || apiKeysQuery.data.api_keys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        <span>No API keys defined. Generate one above to access client tools.</span>
                      </td>
                    </tr>
                  ) : (
                    apiKeysQuery.data.api_keys.map((key) => (
                      <tr key={key.key_id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-200">{key.name}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider",
                            key.is_active 
                              ? "bg-emerald-950/40 border border-emerald-500/20 text-emerald-400"
                              : "bg-rose-950/40 border border-rose-500/20 text-rose-400"
                          )}>
                            {key.is_active ? "Active" : "Revoked"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400">{formatDate(key.created_at)}</td>
                        <td className="px-5 py-4 text-slate-400">
                          {key.expires_at ? formatDate(key.expires_at) : "Never"}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {key.last_used_at ? formatDate(key.last_used_at) : "Never"}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setDisplayedRawKey(null);
                              rotateKeyMutation.mutate(key.key_id);
                            }}
                            disabled={rotateKeyMutation.isPending}
                            className="p-1.5 rounded bg-slate-950 border border-card-border/60 hover:border-accent-cyan/30 text-slate-400 hover:text-accent-cyan transition-all cursor-pointer"
                            title="Rotate Key"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setKeyToRevoke(key.key_id)}
                            className="p-1.5 rounded bg-slate-950 border border-card-border/60 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
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
              <div className="fixed inset-0 bg-[#020408]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-[#080F1E] border border-card-border rounded-xl shadow-2xl p-6 space-y-4 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-card-border/60 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-cyan" />
                      Generate API Key
                    </h3>
                    <button
                      onClick={() => setIsKeyModalOpen(false)}
                      className="p-1 rounded hover:bg-slate-950 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={apiKeyForm.handleSubmit(onSubmitApiKey)} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <Label htmlFor="key-name" className="text-slate-400 font-mono uppercase text-[10px]">
                        API Key Identifier
                      </Label>
                      <Input
                        id="key-name"
                        value={apiKeyForm.watch("name")}
                        placeholder="e.g. Jenkins CI/CD integration"
                        className="bg-slate-950/40 border-card-border/60 text-slate-300 placeholder-slate-600 focus-visible:ring-accent-cyan/20 focus-visible:border-accent-cyan/40"
                        {...apiKeyForm.register("name")}
                        required
                      />
                      {apiKeyForm.formState.errors.name && (
                        <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                          {apiKeyForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsKeyModalOpen(false)}
                        className="h-9 px-4 border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer font-mono uppercase tracking-wider"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createKeyMutation.isPending}
                        className="h-9 px-4 bg-gradient-to-tr from-accent-indigo to-accent-violet hover:shadow-[0_0_12px_rgba(79,70,229,0.3)] text-white cursor-pointer font-mono uppercase tracking-wider"
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
              <div className="fixed inset-0 bg-[#020408]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-[#080F1E] border border-card-border rounded-xl shadow-2xl p-6 space-y-4 animate-scale-in">
                  <h3 className="text-sm font-bold text-rose-400 uppercase font-mono tracking-wider">
                    Confirm Key Revocation
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Are you sure you want to revoke this API key? Applications using this credential will lose access to RAG endpoints immediately.
                  </p>
                  <div className="flex justify-end gap-3 pt-2 text-xs">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setKeyToRevoke(null)}
                      className="h-9 px-4 border-card-border hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer font-mono uppercase tracking-wider"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => revokeKeyMutation.mutate(keyToRevoke)}
                      disabled={revokeKeyMutation.isPending}
                      className="h-9 px-4 bg-rose-950 border border-rose-500/20 text-rose-400 hover:bg-rose-900 cursor-pointer font-mono uppercase tracking-wider"
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
          <div className="p-6 rounded-xl bg-slate-900/40 border border-card-border space-y-6 max-w-2xl">
            <div className="flex items-center gap-2 border-b border-card-border/60 pb-3">
              <Sliders className="w-5 h-5 text-accent-cyan" />
              <h3 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider">
                Grounded Model Blueprint
              </h3>
            </div>

            {tenantConfigQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-accent-cyan" />
                <span className="text-[10px] font-mono uppercase">Loading blueprint...</span>
              </div>
            ) : tenantConfigQuery.isError ? (
              <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs text-rose-400">
                Failed to load tenant configurations. Please contact your administrator.
              </div>
            ) : tenantConfigQuery.data ? (
              <div className="space-y-5 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">LLM Provider</span>
                    <span className="text-sm font-semibold text-slate-300">{tenantConfigQuery.data.llm_provider.toUpperCase()}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Active Model ID</span>
                    <span className="text-sm font-semibold text-slate-300 truncate block">{tenantConfigQuery.data.llm_model}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Temperature Bias</span>
                    <span className="text-sm font-semibold text-slate-300">{tenantConfigQuery.data.temperature}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Query Expansion Context</span>
                    <span className={cn(
                      "text-xs font-bold font-mono px-2 py-0.5 rounded inline-block mt-1 border",
                      tenantConfigQuery.data.query_expansion
                        ? "bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan"
                        : "bg-slate-900 border-card-border/80 text-slate-500"
                    )}>
                      {tenantConfigQuery.data.query_expansion ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Ingestion Rate Limit</span>
                    <span className="text-sm font-semibold text-slate-300">{tenantConfigQuery.data.rate_limit_ingest} req/min</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/40 border border-card-border/50 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Search Rate Limit</span>
                    <span className="text-sm font-semibold text-slate-300">{tenantConfigQuery.data.rate_limit_query} req/min</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-950/20 border border-card-border/50 text-slate-500 leading-normal flex gap-2 font-sans">
                  <AlertCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
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
