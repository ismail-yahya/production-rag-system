"use client";

// ---------------------------------------------------------------------------
// Register Page — Onboards new organization, validates input, shows Tenant ID
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Database,
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Terminal,
  ArrowRight,
  AlertCircle,
  Building,
  User,
  Check,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";

// Validation schema using Zod
const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    admin_name: z.string().min(2, { message: "Super Admin name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email address." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// Password strength calculator
const getPasswordStrength = (pass: string) => {
  if (!pass) return { score: 0, label: "None", color: "bg-slate-800", textColor: "text-slate-500" };
  
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) {
    return { score, label: "Very Weak", color: "bg-rose-500", textColor: "text-rose-400" };
  } else if (score === 2) {
    return { score, label: "Weak", color: "bg-amber-500", textColor: "text-amber-400" };
  } else if (score === 3) {
    return { score, label: "Medium", color: "bg-blue-500", textColor: "text-blue-400" };
  } else if (score === 4) {
    return { score, label: "Strong", color: "bg-emerald-500", textColor: "text-emerald-400" };
  } else {
    return { score, label: "Excellent", color: "bg-teal-400", textColor: "text-teal-400" };
  }
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      admin_name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = watch("password", "");
  const strength = getPasswordStrength(passwordValue);

  // Tenant Register mutation via TanStack Query
  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      const response = await authService.register({
        name: values.name,
        admin_name: values.admin_name,
        email: values.email,
        password: values.password,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Organization onboarded successfully.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Registration request failed.";
      toast.error(msg);
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(values);
  };

  const handleCopyTenantId = () => {
    if (registerMutation.data?.tenant_id) {
      navigator.clipboard.writeText(registerMutation.data.tenant_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SUCCESS STATE
  if (registerMutation.isSuccess && registerMutation.data) {
    const tenantId = registerMutation.data.tenant_id;
    return (
      <div className="flex h-screen w-screen bg-[#070A10] text-slate-100 overflow-hidden font-sans">
        {/* Left Column: Visual Showcase (same background & design for layout continuity) */}
        <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-[#0B0F19] to-[#05070B] border-r border-card-border p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-indigo/10 blur-[80px] -top-40 -left-40" />
          <div className="absolute w-[500px] h-[500px] rounded-full bg-accent-cyan/5 blur-[80px] -bottom-40 right-0" />

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

          <div className="my-auto space-y-8 max-w-lg relative z-10">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                Tenant Registration Successful.
              </h3>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Your isolated organization environment is provisioned. Please note your organization details below to complete your system administration login.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 relative z-10 flex items-center justify-between">
            <span>Version 1.0.0-Beta</span>
            <span>© 2026 Aether Technologies</span>
          </div>
        </div>

        {/* Right Column: Registration Success Container */}
        <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-[#070A10] relative">
          <div className="absolute w-80 h-80 rounded-full bg-accent-violet/5 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden" />

          <div className="w-full max-w-md space-y-8 relative z-10">
            <div className="text-center lg:text-left space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Organization Created</h1>
              <p className="text-slate-400 text-sm">
                Your tenant workspace and root Super Admin account have been created. Copy the Tenant ID below to log in.
              </p>
            </div>

            {/* Tenant details container */}
            <div className="p-5 rounded-xl bg-slate-900/60 border border-card-border/60 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Organization Name
                </span>
                <p className="text-sm font-semibold text-slate-200">{registerMutation.data.tenant_name}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Corporate Tenant ID
                </span>
                <div className="flex gap-2 items-center mt-1">
                  <code className="flex-1 select-all p-2 rounded bg-slate-950 border border-card-border/80 text-xs text-accent-cyan font-mono break-all leading-normal">
                    {tenantId}
                  </code>
                  <Button
                    type="button"
                    onClick={handleCopyTenantId}
                    variant="outline"
                    className="h-9 px-3 border-card-border hover:bg-slate-800 text-slate-400 hover:text-slate-100 shrink-0 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-400/80 leading-normal">
                  ⚠️ Save this ID. You must provide it during sign-in to locate your database scope.
                </p>
              </div>
            </div>

            {/* Login button */}
            <Button
              onClick={() => router.push(`/login?tenantId=${tenantId}`)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-sm font-semibold text-white transition-all cursor-pointer border-none"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD FORM STATE
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
              Create an isolated organization tenant environment.
            </h3>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Registering provisions a logical tenant scope, initializing dedicated workspace hierarchies and your root Super Admin account.
            </p>
          </div>

          {/* Registration Info Flow */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-4 p-4 rounded-xl bg-slate-900/30 border border-card-border/50 hover:border-accent-cyan/20 transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Isolated Organization Scope</h4>
                <p className="text-xs text-slate-400 mt-0.5">Documents, indexes, and chat sessions are logically partitioned by tenant ID at the database level.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-slate-900/30 border border-card-border/50 hover:border-accent-indigo/20 transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-indigo/10 border border-accent-indigo/20 text-accent-indigo shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Root Super Admin Provisioning</h4>
                <p className="text-xs text-slate-400 mt-0.5">The tenant registrar is automatically granted the Super Admin role to control tenant policies and LLM endpoints.</p>
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

      {/* Right Column: Register Form Card */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-[#070A10] overflow-y-auto relative">
        <div className="absolute w-80 h-80 rounded-full bg-accent-violet/5 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden" />

        <div className="w-full max-w-md my-auto py-8 space-y-6 relative z-10">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Register Organization</h1>
            <p className="text-slate-400 text-sm mt-2">
              Set up your tenant space and administrator credentials.
            </p>
          </div>

          {/* Alert banner for mutation errors */}
          {registerMutation.isError && (
            <Alert variant="destructive" className="bg-rose-950/40 border-rose-500/20 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Registration Failed</AlertTitle>
              <AlertDescription className="text-xs">
                {registerMutation.error instanceof Error
                  ? registerMutation.error.message
                  : "An error occurred during registration. Please check the network."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Organization Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Organization Name
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Acme Corp"
                  className={cn(
                    "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
                    errors.name && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Super Admin Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="admin_name" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Super Admin Display Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="admin_name"
                  type="text"
                  placeholder="e.g. Jane Doe"
                  className={cn(
                    "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
                    errors.admin_name && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("admin_name")}
                />
              </div>
              {errors.admin_name && (
                <p className="text-xs text-rose-400 mt-1">{errors.admin_name.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Admin Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={cn(
                    "pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
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
              <Label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Root Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-10 pr-10 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
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

              {/* Password Strength Meter */}
              {passwordValue && (
                <div className="pt-1.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Password Strength
                    </span>
                    <span className={cn("text-xs font-medium", strength.textColor)}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 h-full rounded-full transition-all duration-300",
                          idx <= strength.score ? strength.color : "bg-slate-800"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-10 pr-10 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors",
                    errors.confirmPassword && "border-rose-500/50 focus:border-rose-500"
                  )}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-rose-400 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none mt-2"
            >
              {registerMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Organization</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Login Redirect */}
          <div className="text-center text-xs text-slate-400 pt-4 border-t border-card-border/50">
            Already have an organization?{" "}
            <Link href="/login" className="text-accent-cyan font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
