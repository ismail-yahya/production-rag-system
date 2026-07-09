"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  fileName,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState("");

  // Reset input state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmText === "DELETE";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div
        className="w-full max-w-md bg-[#0B0F19] border border-rose-500/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: "0 10px 50px rgba(0, 0, 0, 0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border bg-rose-950/10">
          <div className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Warning: Permanent Deletion</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-900 border border-card-border text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-xs text-slate-400 space-y-3 leading-relaxed">
            <p>
              You are about to delete <span className="text-slate-200 font-semibold">{fileName}</span>.
            </p>
            <p className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/15 text-[11px] text-rose-400/90">
              This action is destructive and irreversible. It will permanently remove all database metadata, purge binaries in object storage (MinIO), and wipe all matching vector indices in Qdrant.
            </p>
            <p>
              To confirm this action, please type the word <span className="text-rose-500 font-bold tracking-wider select-none">DELETE</span> below.
            </p>
          </div>

          {/* Typing confirmation */}
          <div className="space-y-1.5">
            <input
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-rose-500/40 focus:outline-none text-sm text-slate-200 placeholder-slate-600 transition-colors text-center font-bold tracking-wide"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-card-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-card-border hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmed}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
            >
              Permanently Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
