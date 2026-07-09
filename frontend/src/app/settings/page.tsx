"use client";

import { useState } from "react";
import { User, Key, Sliders, Shield, Copy, Check, Trash2, Plus, Terminal, RefreshCw } from "lucide-react";
import { clsx } from "clsx";

interface APIKeyItem {
  id: string;
  name: string;
  keySuffix: string;
  created: string;
  lastUsed: string;
}

const initialKeys: APIKeyItem[] = [
  { id: "key-1", name: "Production Ingestion Client", keySuffix: "4f46", created: "2026-07-04", lastUsed: "3 mins ago" },
  { id: "key-2", name: "Dev CLI script", keySuffix: "06b6", created: "2026-07-06", lastUsed: "Yesterday" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"profile" | "developer" | "system">("profile");

  // Profile Form States
  const [profileName, setProfileName] = useState("Ismail Yahya");
  const [profileEmail] = useState("ismail.yahya@company.com");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Developer Keys States
  const [keys, setKeys] = useState<APIKeyItem[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // System Configuration States (Admin fields)
  const [defaultLLM, setDefaultLLM] = useState("gpt-4o");
  const [defaultEmbedder, setDefaultEmbedder] = useState("openai");
  const [rateLimitIngest, setRateLimitIngest] = useState(20);
  const [rateLimitQuery, setRateLimitQuery] = useState(100);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Profile configurations updated successfully.");
    setPassword("");
    setNewPassword("");
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const rawKey = `sk_aether_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const suffix = rawKey.slice(-4);

    const newKey: APIKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      keySuffix: suffix,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: "Never",
    };

    setKeys([newKey, ...keys]);
    setGeneratedKey(rawKey);
    setNewKeyName("");
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeKey = (id: string) => {
    if (confirm("Are you sure you want to revoke this API Key? Programmatic client integrations using it will immediately fail.")) {
      setKeys(keys.filter((k) => k.id !== id));
    }
  };

  const handleSystemSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert("System rate limit overrides and model fallbacks updated successfully.");
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] w-full gap-6 max-w-5xl mx-auto overflow-hidden relative font-sans text-slate-100">
      {/* Left rail navigation (Vertical Tabs) */}
      <aside className="w-full md:w-56 bg-glass rounded-xl border border-card-border p-4 flex flex-col gap-1 shrink-0 h-fit">
        <button
          onClick={() => { setActiveTab("profile"); setGeneratedKey(null); }}
          className={clsx(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer",
            activeTab === "profile" ? "bg-slate-900 border border-card-border text-accent-cyan" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          )}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>Profile Settings</span>
        </button>

        <button
          onClick={() => { setActiveTab("developer"); setGeneratedKey(null); }}
          className={clsx(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer",
            activeTab === "developer" ? "bg-slate-900 border border-card-border text-accent-cyan" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          )}
        >
          <Key className="w-4 h-4 shrink-0" />
          <span>Developer API Keys</span>
        </button>

        <button
          onClick={() => { setActiveTab("system"); setGeneratedKey(null); }}
          className={clsx(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer",
            activeTab === "system" ? "bg-slate-900 border border-card-border text-accent-cyan" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
          )}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>System Configuration</span>
        </button>
      </aside>

      {/* Main panel card */}
      <div className="flex-1 bg-glass rounded-xl border border-card-border p-6 overflow-y-auto shadow-xl relative min-h-0">
        
        {/* TAB 1: PROFILE SETTINGS */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave} className="space-y-6 max-w-lg">
            <div className="border-b border-card-border pb-3">
              <h2 className="text-base font-bold text-slate-200">Profile Settings</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Manage personal user settings</p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 transition-colors"
              />
            </div>

            {/* Email (Read only) */}
            <div className="space-y-1.5 opacity-65">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email Address (Tenant ID Locked)</label>
              <input
                type="email"
                disabled
                value={profileEmail}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-card-border text-xs text-slate-400"
              />
            </div>

            {/* Password changes */}
            <div className="border-t border-card-border/50 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Change Password</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Current Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-lg text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Update Profile
            </button>
          </form>
        )}

        {/* TAB 2: DEVELOPER API KEYS */}
        {activeTab === "developer" && (
          <div className="space-y-6">
            <div className="border-b border-card-border pb-3">
              <h2 className="text-base font-bold text-slate-200">Developer API Keys</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Programmatic API integration keys</p>
            </div>

            {/* Generated Key Show Once block */}
            {generatedKey && (
              <div className="p-4 rounded-xl bg-slate-950 border border-accent-cyan/25 space-y-3 relative overflow-hidden">
                <div className="absolute w-20 h-20 bg-accent-cyan/5 blur-xl -top-4 -left-4" />
                <span className="text-[10px] text-accent-cyan font-bold uppercase tracking-wider block">Copy API Key</span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Make sure to copy this key now. For security purposes, it will not be displayed again.
                </p>
                <div className="flex gap-2 p-2 rounded-lg bg-slate-900 border border-card-border/80 relative z-10">
                  <code className="flex-1 font-mono text-xs text-slate-200 select-all overflow-x-auto whitespace-nowrap self-center px-1">
                    {generatedKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 rounded hover:bg-slate-950 border border-card-border text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Key creator form */}
            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-slate-950/35 border border-card-border">
              <input
                type="text"
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CLI Scraper Script"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-xs text-slate-200 placeholder-slate-600 transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-lg text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Key</span>
              </button>
            </form>

            {/* List table */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-card-border pb-3">Active Access Tokens</h3>
              {keys.length > 0 ? (
                <div className="divide-y divide-card-border/50">
                  {keys.map((k) => (
                    <div key={k.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">{k.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[10px] font-mono text-slate-500 font-bold bg-slate-900 border border-card-border px-1.5 py-0.5 rounded">
                            sk_...{k.keySuffix}
                          </code>
                          <span className="text-slate-700 text-xs">•</span>
                          <span className="text-[10px] text-slate-500">Created: {k.created}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Last Used</span>
                          <span className="text-xs text-slate-300 font-medium block mt-0.5">{k.lastUsed}</span>
                        </div>
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="p-1.5 rounded-lg border border-card-border hover:border-rose-500/30 text-slate-400 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-8">No developer keys created. API keys are required for CLI scraping integrations.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM CONFIG */}
        {activeTab === "system" && (
          <form onSubmit={handleSystemSave} className="space-y-6 max-w-lg">
            <div className="border-b border-card-border pb-3">
              <h2 className="text-base font-bold text-slate-200">System Configuration</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Scoping rules and server limits (Admin-only overrides)</p>
            </div>

            {/* Providers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Default LLM */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Default LLM Model</label>
                <select
                  value={defaultLLM}
                  onChange={(e) => setDefaultLLM(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40"
                >
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="claude-3-5-sonnet">Anthropic Claude 3.5</option>
                  <option value="gemini-1-5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>

              {/* Embedder */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Default Embeddings Model</label>
                <select
                  value={defaultEmbedder}
                  onChange={(e) => setDefaultEmbedder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40"
                >
                  <option value="openai">OpenAI text-embedding-3</option>
                  <option value="cohere">Cohere embed-multilingual-v3</option>
                  <option value="local">Local sentence-transformers</option>
                </select>
              </div>
            </div>

            {/* Rate Limit Settings */}
            <div className="border-t border-card-border/50 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Rate Limiting Thresholds (Redis bucket)</h3>
              
              {/* Ingestion Limit */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>File Ingestions limit</span>
                  <span className="text-accent-cyan">{rateLimitIngest}/min</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={rateLimitIngest}
                  onChange={(e) => setRateLimitIngest(parseInt(e.target.value))}
                  className="w-full accent-accent-cyan cursor-pointer"
                />
              </div>

              {/* Query Limit */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Queries/Search requests limit</span>
                  <span className="text-accent-cyan">{rateLimitQuery}/min</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={rateLimitQuery}
                  onChange={(e) => setRateLimitQuery(parseInt(e.target.value))}
                  className="w-full accent-accent-cyan cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/20 border border-card-border/60 flex items-start gap-2.5 text-[10px] text-slate-500">
              <Shield className="w-4 h-4 text-accent-indigo shrink-0 mt-0.5" />
              <span>
                Altering thresholds affects Redis throttling keys. Overly high limits risk API budget exhaustion or service depletion under concurrent loads.
              </span>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-lg text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Update System Settings
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
