"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Lock, ShieldAlert, Shield, X, AlertCircle, Trash2, ShieldCheck, Mail } from "lucide-react";
import { clsx } from "clsx";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";
  isActive: boolean;
  lastLogin: string;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

// Initial mock list of organization users (fallback)
const initialUsers: UserItem[] = [
  { id: "1", email: "ismail.yahya@company.com", name: "Ismail Yahya", role: "SUPER_ADMIN", isActive: true, lastLogin: "2 mins ago" },
  { id: "2", email: "john.doe@company.com", name: "John Doe", role: "ADMIN", isActive: true, lastLogin: "2 hours ago" },
  { id: "3", email: "jane.smith@company.com", name: "Jane Smith", role: "MANAGER", isActive: true, lastLogin: "1 day ago" },
  { id: "4", email: "dev.lead@company.com", name: "Dev Lead", role: "USER", isActive: true, lastLogin: "3 days ago" },
];

export default function UserManagement() {
  const router = useRouter();
  // Active User Role Simulation (State makes it interactive to test RBAC)
  const [currentUserRole, setCurrentUserRole] = useState<"ADMIN" | "USER">("ADMIN");
  
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Invite form inputs
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER">("USER");

  const fetchUsers = async () => {
    const token = getCookie("session_token");
    if (!token) return;

    try {
      // 1. Fetch current user profile to enforce RBAC access
      const meResponse = await fetch("/api/v1/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        if (meData.role === "ADMIN" || meData.role === "SUPER_ADMIN") {
          setCurrentUserRole("ADMIN");
        } else {
          setCurrentUserRole("USER");
          return;
        }
      }

      // 2. Fetch all users
      const response = await fetch("/api/v1/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.users) {
          const mapped = data.users.map((u: any) => ({
            id: u.user_id,
            email: u.email,
            name: u.name,
            role: u.role as any,
            isActive: u.is_active,
            lastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never",
          }));
          setUsers(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to load users from API, using fallback:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          password: "tempPassword123!", // default temp password
          role: role,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to invite user.");
      }

      await fetchUsers();
      setEmail("");
      setName("");
      setRole("USER");
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Invitation failed: ${err.message}`);
    }
  };

  const toggleUserStatus = async (userItem: UserItem) => {
    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/users/${userItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: !userItem.isActive,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to update user status.");
      }

      await fetchUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (userItem: UserItem, newRole: any) => {
    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/users/${userItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to update user role.");
      }

      await fetchUsers();
    } catch (err: any) {
      alert(`Role update failed: ${err.message}`);
    }
  };

  const handleRemoveUser = async (userItem: UserItem) => {
    if (!confirm(`Remove access for ${userItem.email}?`)) return;

    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/users/${userItem.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete user.");
      }

      setUsers(users.filter((u) => u.id !== userItem.id));
    } catch (err: any) {
      alert(`Deactivation failed: ${err.message}`);
    }
  };

  // RBAC Access Gate: If simulated role is USER, block access
  if (currentUserRole === "USER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-lg mx-auto space-y-6 font-sans">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/25 text-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.2)] animate-pulse">
          <Lock className="w-7 h-7" />
          <ShieldAlert className="w-4.5 h-4.5 absolute -bottom-1 -right-1 text-rose-500 bg-[#070A10] rounded-full" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-100">Administrative Privilege Required</h1>
          <p className="text-slate-400 text-xs leading-relaxed">
            The route <code className="text-rose-400 px-1 bg-slate-900 border border-card-border rounded">/users</code> is protected via RBAC (Role-Based Access Control) directives. Your active profile is restricted from managing user databases.
          </p>
        </div>

        {/* Action buttons to trigger mock elevation or return */}
        <div className="flex gap-4 pt-2">
          <button
            onClick={() => setCurrentUserRole("ADMIN")}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-lg text-xs font-semibold text-white transition-all cursor-pointer"
          >
            Mock Elevate to ADMIN
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-100 relative">
      {/* Simulation Helper Panel */}
      <div className="p-3 rounded-lg bg-glass border border-card-border/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-accent-cyan" />
          <span>RBAC Simulator: Switch current role permissions to test restrictions.</span>
        </div>
        <button
          onClick={() => setCurrentUserRole("USER")}
          className="px-2.5 py-1 rounded bg-slate-900 border border-card-border hover:border-rose-500/30 text-rose-400 text-[10px] uppercase font-bold transition-all cursor-pointer"
        >
          Restrict to USER Role
        </button>
      </div>

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            User Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Invite colleagues, coordinate workspace memberships, and assign system-wide security clearance roles.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Grid List Table */}
      <div className="bg-glass border border-card-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-300">
            <thead>
              <tr className="bg-slate-950/30 border-b border-card-border text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50">
              {users.map((user) => (
                <tr key={user.email} className={clsx("hover:bg-slate-900/10 transition-colors", !user.isActive && "opacity-60")}>
                  {/* Name / Email */}
                  <td className="px-6 py-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">{user.name}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{user.email}</span>
                    </div>
                  </td>

                  {/* Role Selector dropdown */}
                  <td className="px-6 py-4">
                    {user.email === "ismail.yahya@company.com" ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
                        <Shield className="w-3.5 h-3.5" /> SUPER_ADMIN
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value as any)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-card-border text-[10px] text-slate-300 focus:outline-none focus:border-accent-cyan/40 cursor-pointer"
                      >
                        <option value="USER">USER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    )}
                  </td>

                  {/* Status Toggle */}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={clsx(
                        "text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border transition-all cursor-pointer",
                        user.isActive
                          ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-900 text-slate-500 border-card-border"
                      )}
                    >
                      {user.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>

                  {/* Last Login */}
                  <td className="px-6 py-4 text-slate-400">{user.lastLogin}</td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {user.email !== "ismail.yahya@company.com" && (
                      <button
                        onClick={() => handleRemoveUser(user)}
                        className="p-1.5 rounded-lg border border-card-border hover:border-rose-500/30 text-slate-400 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                        title="Revoke User Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div
            className="w-full max-w-md bg-[#0B0F19] border border-card-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ boxShadow: "0 10px 50px rgba(0, 0, 0, 0.6)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-slate-950/20">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-accent-cyan" />
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Invite Collaborator</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleInvite} className="p-6 space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="john.doe@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/50 focus:outline-none text-sm text-slate-300 placeholder-slate-600 transition-colors"
                  />
                </div>
              </div>

              {/* System Role */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Access Level Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-sm text-slate-300 focus:outline-none focus:border-accent-cyan/40"
                >
                  <option value="USER">USER (Basic search and personal sandbox)</option>
                  <option value="MANAGER">MANAGER (Coordinate workspaces and teams)</option>
                  <option value="ADMIN">ADMIN (System management and role scoping)</option>
                </select>
                <p className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-accent-cyan shrink-0 mt-0.5" />
                  <span>
                    New users will receive an activation email linking to password setup.
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-card-border/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-violet hover:brightness-110 shadow-[0_0_12px_rgba(79,70,229,0.3)] text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
