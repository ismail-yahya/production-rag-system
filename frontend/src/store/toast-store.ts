import { create } from "zustand";

// ---------------------------------------------------------------------------
// Toast Notification Store — lightweight state for custom alerts
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  success: (msg, dur) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message: msg, type: "success", duration: dur }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, dur ?? 4000);
  },
  error: (msg, dur) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message: msg, type: "error", duration: dur }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, dur ?? 5000);
  },
  warning: (msg, dur) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message: msg, type: "warning", duration: dur }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, dur ?? 4500);
  },
  info: (msg, dur) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message: msg, type: "info", duration: dur }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, dur ?? 4000);
  },
}));

// Quick export helper
export const toast = {
  success: (msg: string, dur?: number) => useToastStore.getState().success(msg, dur),
  error: (msg: string, dur?: number) => useToastStore.getState().error(msg, dur),
  warning: (msg: string, dur?: number) => useToastStore.getState().warning(msg, dur),
  info: (msg: string, dur?: number) => useToastStore.getState().info(msg, dur),
};
