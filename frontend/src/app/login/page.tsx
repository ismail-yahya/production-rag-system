"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Database, Shield, Lock, Mail, Eye, EyeOff, Terminal, ArrowRight } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("00000000-0000-0000-0000-000000000001");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantId.trim(),
          email: email.trim(),
          password: password,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Authentication failed. Check credentials.");
      }

      const data = await response.json();
      
      // Set real JWT cookies
      document.cookie = `session_token=${data.access_token}; path=/; max-age=${data.expires_in}; SameSite=Lax`;
      document.cookie = `tenant_id=${tenantId.trim()}; path=/; max-age=${data.expires_in}; SameSite=Lax`;
      
      router.push("/select-workspace");
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setIsLoading(false);
    }
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

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tenant ID Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Organization Tenant ID
              </label>
              <div className="relative">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Password
                </label>
                <Link
                  href="/login"
                  className="text-xs text-accent-cyan hover:underline transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Contact your system administrator to reset password.");
                  }}
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
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

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
