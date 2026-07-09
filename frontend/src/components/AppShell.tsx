"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  
  const isNoShellPage = 
    pathname === "/login" || 
    pathname === "/register" || 
    pathname === "/select-workspace";

  if (isNoShellPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar navigation panel */}
      <Sidebar />

      {/* Main app panel */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        {/* Top bar header */}
        <Header />

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#070A10] to-[#0A0F1E] relative">
          {children}
        </main>
      </div>
    </div>
  );
}
