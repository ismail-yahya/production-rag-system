"use client";

// ---------------------------------------------------------------------------
// Dashboard layout — sidebar + header shell for all authenticated pages
// ---------------------------------------------------------------------------

import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastContainer } from "@/components/ui/toast-container";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  // Show loading spinner while auth state is hydrating
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-medium tracking-wider">
            Initializing secure session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#070A10] to-[#0A0F1E] relative">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
