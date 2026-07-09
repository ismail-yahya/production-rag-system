import { create } from "zustand";

export interface Workspace {
  id: string;
  name: string;
  type: "central" | "team" | "personal";
}

interface UIState {
  sidebarCollapsed: boolean;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeWorkspace: { id: "1", name: "Central Workspace", type: "central" },
  workspaces: [
    { id: "1", name: "Central Workspace", type: "central" },
    { id: "2", name: "Engineering Team", type: "team" },
    { id: "3", name: "Marketing & Sales", type: "team" },
    { id: "4", name: "Personal Workspace", type: "personal" },
  ],
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
