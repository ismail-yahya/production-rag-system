"use client";

// ---------------------------------------------------------------------------
// ToastContainer — Displays floating portals of system feedback notifications
// ---------------------------------------------------------------------------

import { useToastStore, type ToastItem } from "@/store/toast-store";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ShieldAlert, 
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((item) => (
        <ToastCard 
          key={item.id} 
          item={item} 
          onClose={() => removeToast(item.id)} 
        />
      ))}
    </div>
  );
}

function ToastCard({ 
  item, 
  onClose 
}: { 
  item: ToastItem; 
  onClose: () => void 
}) {
  const { message, type } = item;

  // Icon mapping
  const Icon = {
    success: CheckCircle2,
    error: ShieldAlert,
    warning: AlertTriangle,
    info: Info,
  }[type];

  // Colors mapping
  const styles = {
    success: {
      border: "border-emerald-500/20 bg-emerald-950/20 text-emerald-400",
      icon: "text-emerald-400",
    },
    error: {
      border: "border-rose-500/20 bg-rose-950/20 text-rose-400",
      icon: "text-rose-400",
    },
    warning: {
      border: "border-amber-500/20 bg-amber-950/20 text-amber-400",
      icon: "text-amber-400",
    },
    info: {
      border: "border-accent-cyan/20 bg-cyan-950/20 text-accent-cyan",
      icon: "text-accent-cyan",
    },
  }[type];

  return (
    <div
      className={cn(
        "p-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 pointer-events-auto transition-all duration-300 animate-slide-in font-mono text-xs",
        styles.border
      )}
    >
      <Icon className={cn("w-4.5 h-4.5 shrink-0 mt-0.5", styles.icon)} />
      <div className="flex-1 leading-normal pr-2">
        {message}
      </div>
      <button
        onClick={onClose}
        className="p-0.5 rounded-md hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
