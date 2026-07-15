"use client";

// ---------------------------------------------------------------------------
// Login Page — Onboards user session, validates input, manages JWT state
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Shield, Lock, Mail, Eye, EyeOff, Terminal, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";

// Validation schema using Zod
const loginSchema = z.object({
  tenantId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: "Must be a valid UUID format." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "",
      password: "",
    },
  });

  // Login mutation via TanStack Query
  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const response = await authService.login({
        tenant_id: values.tenantId,
        email: values.email,
        password: values.password,
      });
      return response.data;
    },
    onSuccess: async (data, variables) => {
      // 1. Set context tokens and user profile
      await login(data.access_token, data.refresh_token);

      // 2. Set authorization cookie so proxy.ts middleware can read it
      document.cookie = `rag_auth=${data.access_token}; path=/; max-age=${data.expires_in}; SameSite=Lax; Secure`;

      toast.success("Welcome back! Secure session initialized.");

      // 3. Navigate to Dashboard
      router.push("/");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Authentication request failed.";
      toast.error(msg);
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  return (
    <div className="flex h-screen w-screen bg-[#070A10] text-slate-100 overflow-hidden font-sans">
      {/* Left Column: Visual Showcase (60% width on desktop) */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-[#0B0F19] to-[#05070B] border-r border-card-border p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative Grid Glows */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-indigo/10 blur-[80px] -top-40 -left-40" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-cyan/5 blur-[80px] -bottom-40 right-0" />

        {/* Top Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-indigo to-accent-violet shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              AETHER RAG SYSTEM
            </h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Enterprise Knowledge Engine
            </span>
          </div>
        </div>

        {/* Central visual infographic */}
        <div className="my-auto space-y-8 max-w-lg relative z-10">
          <div>
            <h3 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise-Grade AI Search grounded in your own security rules.
            </h3>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Connect vectors, databases, and LLMs in a single high-security pipeline. Maintain absolute tenant isolation and workspace access controls.
            </p>
          </div>

          {/* Core Pipeline Visual Flow */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-4 p-4 rounded-xl bg-slate-900/30 border border-card-border/50 hover:border-accent-cyan/20 transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan shrink-0">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Tenant & Workspace Separation</h4>
                <p className="text-xs text-slate-400 mt-0.5">Logical access filtering ensures users query only documents assigned to their active workspace.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-slate-900/30 border border-card-border/50 hover:border-accent-indigo/20 transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-indigo/10 border border-accent-indigo/20 text-accent-indigo shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Grounded Prompts & Security Guard</h4>
                <p className="text-xs text-slate-400 mt-0.5">Real-time prompt injection filtering rejects malicious structures before processing starts.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metadata */}
        <div className="text-xs text-slate-500 relative z-10 flex items-center justify-between">
          <span>Version 1.0.0-Beta</span>
          <span>© 2026 Aether Technologies</span>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-[#070A10] relative">
        {/* Glow behind the login card */}
        <div className="absolute w-80 h-80 rounded-full bg-accent-violet/5 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden" />

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sign In to Aether RAG</h1>
            <p className="text-slate-400 text-sm mt-2">
              Enter your corporate credentials to access your workspaces.
            </p>
          </div>

          {/* Alert banner for mutation errors */}
          {loginMutation.isError && (
            <Alert variant="destructive" className="bg-rose-950/40 border-rose-500/20 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Failed</AlertTitle>
              <AlertDescription className="text-xs">
                {loginMutation.error instanceof Error
                  ? loginMutation.error.message
                  : "Invalid credentials or connection issue."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Tenant ID Field */}
            <div className="space-y-1.5">
              <Label htmlFor="tenantId" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Organization Tenant ID
              </Label>
              <div className="relative">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="tenantId"
                  type="text"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className={cn(
                    "pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors font-mono",
                    errors.tenantId && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("tenantId")}
                />
              </div>
              {errors.tenantId && (
                <p className="text-xs text-rose-400 mt-1">{errors.tenantId.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={cn(
                    "pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
                    errors.email && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs text-accent-cyan hover:underline transition-all cursor-pointer"
                  onClick={() => alert("Contact your system administrator to reset password.")}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-10 pr-10 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
                    errors.password && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
            >
              {loginMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Registration Redirect */}
          <div className="text-center text-xs text-slate-400 pt-2 border-t border-card-border/50">
            Don't have an organization account?{" "}
            <Link href="/register" className="text-accent-cyan font-semibold hover:underline">
              Register Tenant
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
