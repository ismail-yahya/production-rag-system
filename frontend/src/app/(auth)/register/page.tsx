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
      <div className="flex h-screen w-screen bg-[#E6EEF8] text-[#3E4E63] overflow-hidden font-sans">
        {/* Left Column: Visual Showcase (same background & design for layout continuity) */}
        <div className="hidden lg:flex lg:w-3/5 bg-[#E6EEF8] border-r border-slate-200/50 p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/2 blur-[80px] -top-40 -left-40" />
          <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/1 blur-[80px] -bottom-40 right-0" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E6EEF8] text-primary shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-wider font-mono text-[#3E4E63]">
                AETHER RAG SYSTEM
              </h2>
              <span className="text-[10px] text-[#7A8C9E] font-bold uppercase tracking-widest font-mono">
                Enterprise Knowledge Engine
              </span>
            </div>
          </div>

          <div className="my-auto space-y-8 max-w-lg relative z-10">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight text-[#3E4E63] leading-tight">
                Tenant Registration Successful.
              </h3>
              <p className="text-[#5A6E85] text-sm mt-3 leading-relaxed">
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
        <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-[#E6EEF8] relative">
          <div className="absolute w-80 h-80 rounded-full bg-primary/1 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden" />

          <div className="w-full max-w-md space-y-8 relative z-10">
            <div className="text-center lg:text-left space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E6EEF8] text-emerald-500 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-[#3E4E63] tracking-tight">Organization Created</h1>
              <p className="text-[#5A6E85] text-sm">
                Your tenant workspace and root Super Admin account have been created. Copy the Tenant ID below to log in.
              </p>
            </div>

            {/* Tenant details container */}
            <div className="p-5 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest">
                  Organization Name
                </span>
                <p className="text-sm font-bold text-[#3E4E63]">{registerMutation.data.tenant_name}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#7A8C9E] uppercase tracking-widest block">
                  Corporate Tenant ID
                </span>
                <div className="flex gap-2 items-center mt-1">
                  <code className="flex-1 select-all p-2 rounded-lg bg-[#E6EEF8] text-xs text-primary font-mono break-all leading-normal shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff]">
                    {tenantId}
                  </code>
                  <Button
                    type="button"
                    onClick={handleCopyTenantId}
                    variant="outline"
                    className="h-9 px-3 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] shrink-0 cursor-pointer rounded-full"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-600 leading-normal font-bold">
                  ⚠️ Save this ID. You must provide it during sign-in to locate your database scope.
                </p>
              </div>
            </div>

            {/* Login button */}
            <Button
              onClick={() => router.push(`/login?tenantId=${tenantId}`)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] text-sm font-bold text-white transition-all cursor-pointer border-none"
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
    <div className="flex h-screen w-screen bg-[#E6EEF8] text-[#3E4E63] overflow-hidden font-sans">
      {/* Left Column: Visual Showcase (60% width on desktop) */}
      <div className="hidden lg:flex lg:w-3/5 bg-[#E6EEF8] border-r border-slate-200/50 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative Grid Glows */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/2 blur-[80px] -top-40 -left-40" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/1 blur-[80px] -bottom-40 right-0" />

        {/* Top Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E6EEF8] text-primary shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wider font-mono text-[#3E4E63]">
              AETHER RAG SYSTEM
            </h2>
            <span className="text-[10px] text-[#7A8C9E] font-bold uppercase tracking-widest font-mono">
              Enterprise Knowledge Engine
            </span>
          </div>
        </div>

        {/* Central visual infographic */}
        <div className="my-auto space-y-8 max-w-lg relative z-10">
          <div>
            <h3 className="text-3xl font-extrabold tracking-tight text-[#3E4E63] leading-tight">
              Create an isolated organization tenant environment.
            </h3>
            <p className="text-[#5A6E85] text-sm mt-3 leading-relaxed">
              Registering provisions a logical tenant scope, initializing dedicated workspace hierarchies and your root Super Admin account.
            </p>
          </div>

          {/* Registration Info Flow */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-4 p-4 rounded-xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-primary shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#3E4E63]">Isolated Organization Scope</h4>
                <p className="text-xs text-[#5A6E85] mt-0.5">Documents, indexes, and chat sessions are logically partitioned by tenant ID at the database level.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none transition-all duration-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E6EEF8] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-primary shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#3E4E63]">Root Super Admin Provisioning</h4>
                <p className="text-xs text-[#5A6E85] mt-0.5">The tenant registrar is automatically granted the Super Admin role to control tenant policies and LLM endpoints.</p>
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
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-[#E6EEF8] overflow-y-auto relative">
        <div className="absolute w-80 h-80 rounded-full bg-primary/1 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden" />

        <div className="w-full max-w-md my-auto py-8 space-y-6 relative z-10">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-[#3E4E63] tracking-tight">Register Organization</h1>
            <p className="text-[#5A6E85] text-sm mt-2">
              Set up your tenant space and administrator credentials.
            </p>
          </div>

          {/* Alert banner for mutation errors */}
          {registerMutation.isError && (
            <Alert variant="destructive" className="bg-[#E6EEF8] border-none shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-rose-500">
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
              <Label htmlFor="name" className="text-xs font-bold text-[#5A6E85] uppercase tracking-wider block">
                Organization Name
              </Label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Acme Corp"
                  className={cn(
                    "pl-11 pr-4 py-2 bg-[#E6EEF8] rounded-full border-none focus:outline-none text-sm text-[#3E4E63] placeholder-slate-400 shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] transition-all",
                    errors.name && "border border-rose-500/50"
                  )}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-rose-500 font-mono mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Super Admin Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="admin_name" className="text-xs font-bold text-[#5A6E85] uppercase tracking-wider block">
                Super Admin Display Name
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="admin_name"
                  type="text"
                  placeholder="e.g. Jane Doe"
                  className={cn(
                    "pl-11 pr-4 py-2 bg-[#E6EEF8] rounded-full border-none focus:outline-none text-sm text-[#3E4E63] placeholder-slate-400 shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] transition-all",
                    errors.admin_name && "border border-rose-500/50"
                  )}
                  {...register("admin_name")}
                />
              </div>
              {errors.admin_name && (
                <p className="text-xs text-rose-500 font-mono mt-1">{errors.admin_name.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-[#5A6E85] uppercase tracking-wider block">
                Admin Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={cn(
                    "pl-11 pr-4 py-2 bg-[#E6EEF8] rounded-full border-none focus:outline-none text-sm text-[#3E4E63] placeholder-slate-400 shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] transition-all",
                    errors.email && "border border-rose-500/50"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-500 font-mono mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-[#5A6E85] uppercase tracking-wider block">
                Root Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-11 pr-11 py-2 bg-[#E6EEF8] rounded-full border-none focus:outline-none text-sm text-[#3E4E63] placeholder-slate-400 shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] transition-all",
                    errors.password && "border border-rose-500/50"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer z-10"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500 font-mono mt-1">{errors.password.message}</p>
              )}

              {/* Password Strength Meter */}
              {passwordValue && (
                <div className="pt-1.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider font-semibold">
                      Password Strength
                    </span>
                    <span className={cn("text-xs font-medium", strength.textColor)}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-1 w-full bg-slate-200 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] rounded-full overflow-hidden">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 h-full rounded-full transition-all duration-300",
                          idx <= strength.score ? strength.color : "bg-slate-200"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold text-[#5A6E85] uppercase tracking-wider block">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={cn(
                    "pl-11 pr-11 py-2 bg-[#E6EEF8] rounded-full border-none focus:outline-none text-sm text-[#3E4E63] placeholder-slate-400 shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff] transition-all",
                    errors.confirmPassword && "border border-rose-500/50"
                  )}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer z-10"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-rose-500 font-mono mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-sm font-bold text-white transition-all hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none mt-2"
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
          <div className="text-center text-xs text-[#5A6E85] pt-4 border-t border-slate-200/50">
            Already have an organization?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
