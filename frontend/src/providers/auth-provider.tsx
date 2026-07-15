"use client";

// ---------------------------------------------------------------------------
// Auth provider — React context for authentication state
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { UserResponse, UserRole } from "@/types";
import {
  getAccessToken,
  setTokens,
  clearTokens,
  decodeJWT,
} from "@/lib/auth";
import { usersService } from "@/services/users.service";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: UserResponse | null;
  role: UserRole | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derive role and tenantId from user
  const role = user?.role ?? null;
  const tenantId = user?.tenant_id ?? null;
  const isAuthenticated = !!user;

  /** Fetch the current user profile from the backend */
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await usersService.getMe();
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  /** Handle login — store tokens and fetch user profile */
  const login = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      await refreshUser();
    },
    [refreshUser]
  );

  /** Handle logout — call backend, clear tokens, redirect */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout API errors — we clear tokens regardless
    }
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  // On mount, check if we have a valid token and hydrate user
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const token = getAccessToken();
      if (token) {
        const decoded = decodeJWT(token);
        if (decoded) {
          await refreshUser();
        } else {
          clearTokens();
        }
      }
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        tenantId,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access auth state — must be used within AuthProvider */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
