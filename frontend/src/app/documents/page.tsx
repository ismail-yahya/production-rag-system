"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Trash2, Search, Sliders, ChevronDown, CheckCircle2, RefreshCw, XCircle, AlertCircle, FileCode } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import UploadConfigModal from "@/components/documents/UploadConfigModal";
import DeleteConfirmModal from "@/components/documents/DeleteConfirmModal";
import { clsx } from "clsx";

interface DocumentItem {
  id: string;
  name: string;
  size: string;
  status: "pending" | "processing" | "indexed" | "failed";
  workspaceId: string;
  creator: string;
  date: string;
  error?: string;
  chunker?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

// Initial pre-loaded mock documents (used as a fallback)
const initialDocs: DocumentItem[] = [
  {
    id: "doc-1",
    name: "q2_financial_report.pdf",
    size: "4.2 MB",
    status: "indexed",
    workspaceId: "1",
    creator: "john.doe@company.com",
    date: "2026-07-08 14:20",
    chunker: "recursive",
    chunkSize: 500,
    chunkOverlap: 50,
  },
  {
    id: "doc-2",
    name: "employee_handbook_2026.pdf",
    size: "12.8 MB",
    status: "indexed",
    workspaceId: "2",
    creator: "jane.smith@company.com",
    date: "2026-07-07 09:12",
    chunker: "recursive",
    chunkSize: 500,
    chunkOverlap: 50,
  },
  {
    id: "doc-3",
    name: "cost_structures_2026.pdf",
    size: "8.1 MB",
    status: "indexed",
    workspaceId: "3",
    creator: "ismail.yahya@company.com",
    date: "2026-07-06 18:41",
    chunker: "recursive",
    chunkSize: 500,
    chunkOverlap: 50,
  },
  {
    id: "doc-4",
    name: "legacy_system_documentation.pdf",
    size: "1.5 MB",
    status: "failed",
    workspaceId: "1",
    creator: "dev.lead@company.com",
    date: "2026-07-05 11:32",
    error: "OCR failed: Image resolution too low for parsing",
    chunker: "structure",
    chunkSize: 1000,
    chunkOverlap: 100,
  },
];

export default function Documents() {
  const { workspaces } = useUIStore();
  const [docs, setDocs] = useState<DocumentItem[]>(initialDocs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");

  // Drag and drop state hooks
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  
  // Modals state hooks
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load and poll documents from backend API
  useEffect(() => {
    const fetchDocs = async () => {
      const token = getCookie("session_token");
      if (!token) return;

      try {
        const response = await fetch("/api/v1/documents", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.documents) {
            const mapped = data.documents.map((d: any) => ({
              id: d.id,
              name: d.file_name,
              size: d.file_size_bytes ? `${(d.file_size_bytes / (1024 * 1024)).toFixed(1)} MB` : "Unknown",
              status: d.status.toLowerCase() as any,
              workspaceId: d.metadata?.workspace_id || "1",
              creator: "ismail.yahya@company.com",
              date: new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16),
            }));
            setDocs(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to fetch documents from API, using mocks:", err);
      }
    };

    fetchDocs();
    const interval = setInterval(fetchDocs, 4000);
    return () => clearInterval(interval);
  }, []);

  // File drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file: File) => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!validTypes.includes(file.type)) {
      alert("Invalid file type. Only PDF and Image (PNG, JPG) files are supported.");
      return;
    }

    if (file.size > maxSize) {
      alert("File size exceeds the 25MB limit.");
      return;
    }

    setActiveFile(file);
    setIsConfigOpen(true);
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Configure and start backend API document ingestion
  const handleConfirmConfig = async (config: {
    chunker: string;
    chunkSize: number;
    chunkOverlap: number;
    workspaceId: string;
  }) => {
    if (!activeFile) return;

    setIsConfigOpen(false);
    const token = getCookie("session_token");
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append("file", activeFile);

      // Build target ingestion URL
      const url = `/api/v1/ingest?workspace_id=${config.workspaceId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Ingestion request failed.");
      }

      alert("Document accepted for processing. Status: pending.");
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setActiveFile(null);
    }
  };

  // Delete handler triggers
  const handleOpenDelete = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDoc) return;
    const token = getCookie("session_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/documents/${selectedDoc.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete document.");
      }

      setDocs((prev) => prev.filter((d) => d.id !== selectedDoc.id));
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setIsDeleteOpen(false);
      setSelectedDoc(null);
    }
  };

  // Filtered documents mapping
  const filteredDocs = docs.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesWorkspace = workspaceFilter === "all" || doc.workspaceId === workspaceFilter;
    return matchesSearch && matchesStatus && matchesWorkspace;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-100">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
          Documents Repository
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload and organize documents. Track real-time parser queue and vector store sync.
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerUploadClick}
        className={clsx(
          "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 relative overflow-hidden bg-glass",
          isDragActive
            ? "border-accent-cyan bg-accent-cyan/5 scale-[1.01] shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            : "border-card-border hover:border-accent-cyan/30 hover:bg-slate-900/10"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="absolute w-60 h-60 rounded-full bg-accent-cyan/5 blur-3xl -top-20 -left-20 pointer-events-none" />
        
        <div className="p-4 rounded-full bg-slate-950/40 border border-card-border text-accent-cyan group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-200">
            Drag & drop files here, or <span className="text-accent-cyan hover:underline">browse files</span>
          </p>
          <p className="text-xs text-slate-500">
            Supports PDF and Images (PNG, JPG) up to 25MB.
          </p>
        </div>
      </div>

      {/* Filter and grid actions bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-glass border border-card-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-card-border focus:border-accent-cyan/55 focus:outline-none text-xs text-slate-200 placeholder-slate-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="indexed">Indexed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          {/* Workspace Filter */}
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-card-border text-xs text-slate-300 focus:outline-none focus:border-accent-cyan/40 cursor-pointer"
          >
            <option value="all">All Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid List table */}
      <div className="bg-glass border border-card-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-300">
            <thead>
              <tr className="bg-slate-950/30 border-b border-card-border text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-6 py-4">File Name</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Workspace</th>
                <th className="px-6 py-4">Date Uploaded</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => {
                  const ws = workspaces.find((w) => w.id === doc.workspaceId);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-900/10 transition-colors">
                      {/* Name */}
                      <td className="px-6 py-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs md:max-w-md block" title={doc.name}>
                            {doc.name}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-6 py-4 text-slate-400">{doc.size}</td>

                      {/* Workspace */}
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded border border-card-border bg-slate-950/40 text-[10px] text-slate-400 font-medium">
                          {ws ? ws.name : "Unassigned"}
                        </span>
                      </td>

                      {/* Upload Date */}
                      <td className="px-6 py-4 text-slate-400">{doc.date}</td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {doc.status === "indexed" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Indexed
                            </span>
                          )}
                          {doc.status === "processing" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-amber-950/30 text-amber-400 border border-amber-500/20 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin text-amber-500" /> Processing
                            </span>
                          )}
                          {doc.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-card-border animate-pulse">
                              Pending
                            </span>
                          )}
                          {doc.status === "failed" && (
                            <div className="relative group/tooltip flex items-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-rose-950/30 text-rose-400 border border-rose-500/20 cursor-help">
                                <XCircle className="w-3 h-3 text-rose-500" /> Failed
                              </span>
                              {doc.error && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-950 border border-rose-500/30 text-[10px] text-rose-400 p-2.5 rounded-lg w-52 shadow-2xl z-30 leading-relaxed">
                                  <div className="flex gap-1 items-start">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{doc.error}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDelete(doc)}
                          className="p-1.5 rounded-lg border border-card-border hover:border-rose-500/30 text-slate-400 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 font-medium">
                    No documents found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload configuration popup */}
      {activeFile && (
        <UploadConfigModal
          isOpen={isConfigOpen}
          onClose={() => {
            setIsConfigOpen(false);
            setActiveFile(null);
          }}
          fileName={activeFile.name}
          onConfirm={handleConfirmConfig}
        />
      )}

      {/* Delete confirmation modal */}
      {selectedDoc && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setSelectedDoc(null);
          }}
          fileName={selectedDoc.name}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
