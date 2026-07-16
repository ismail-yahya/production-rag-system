"use client";

// ---------------------------------------------------------------------------
// DocumentsPage — Dynamic list and detailed drawer for document ingestion
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsService } from "@/services/documents.service";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn, formatFileSize, formatDate, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  UploadCloud,
  Loader2,
  AlertCircle,
  Check,
  Search,
  Filter,
  X,
  Trash2,
  Terminal,
  Database,
  Cpu,
  Clock,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DocumentsPage() {
  const queryClient = useQueryClient();

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected document for Drawer
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Deletion confirm state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // 1. Primary Documents Query with SMART POLLING
  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await documentsService.list();
      return response.data;
    },
    refetchInterval: (query) => {
      const docs = query.state.data?.documents || [];
      const hasActive = docs.some(
        (doc) => doc.status === "pending" || doc.status === "processing"
      );
      // Poll every 3 seconds if there are active ingestion jobs
      return hasActive ? 3000 : false;
    },
  });

  // 2. Selected Document Ingestion Job Details Query (polls if active)
  const jobDetailsQuery = useQuery({
    queryKey: ["documents", "job", selectedDocId],
    queryFn: async () => {
      if (!selectedDocId) return null;
      const response = await documentsService.getIngestionJob(selectedDocId);
      return response.data;
    },
    enabled: !!selectedDocId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const isActive = status === "pending" || status === "processing";
      return isActive ? 3000 : false;
    },
  });

  const selectedDoc = documentsQuery.data?.documents.find(
    (d) => d.id === selectedDocId
  );

  // 3. Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus({ status: "uploading" });
      const response = await documentsService.upload(file);
      return response.data;
    },
    onSuccess: () => {
      setUploadStatus({ status: "success", message: "Document uploaded successfully." });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
    },
    onError: (err) => {
      setUploadStatus({
        status: "error",
        message: err instanceof Error ? err.message : "Ingestion upload failed.",
      });
      setTimeout(() => setUploadStatus({ status: "idle" }), 5000);
    },
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await documentsService.delete(id);
    },
    onSuccess: () => {
      setSelectedDocId(null);
      setIsConfirmingDelete(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedDocId) {
      deleteMutation.mutate(selectedDocId);
    }
  };

  // Filter logic
  const docsList = documentsQuery.data?.documents || [];
  const filteredDocs = docsList.filter((doc) => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Compute status metrics
  const totalCount = docsList.length;
  const statusCounts = {
    pending: 0,
    processing: 0,
    indexed: 0,
    failed: 0,
  };
  docsList.forEach((d) => {
    if (d.status in statusCounts) {
      statusCounts[d.status as keyof typeof statusCounts]++;
    }
  });

  return (
    <div className="space-y-6">
           {/* 1. Ingestion Stats Headers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-[#7A8C9E]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-semibold">Total Corpus</span>
            <span className="text-lg font-bold text-[#3E4E63]">{totalCount} files</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-emerald-600">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-semibold">Indexed Vectors</span>
            <span className="text-lg font-bold text-emerald-600">{statusCounts.indexed} files</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-semibold">Active Ingestions</span>
            <span className="text-lg font-bold text-blue-600">
              {statusCounts.processing + statusCounts.pending} files
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] border-none flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E6EEF8] shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-rose-600">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#7A8C9E] uppercase tracking-wider block font-semibold">Failed Jobs</span>
            <span className="text-lg font-bold text-rose-600">{statusCounts.failed} files</span>
          </div>
        </div>
      </div>

      {/* 2. Drag & Drop File Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "p-8 rounded-2xl border-2 border-dashed transition-all relative overflow-hidden flex flex-col items-center justify-center min-h-[180px] text-center select-none shadow-md",
          isDragging
            ? "border-primary bg-blue-50 text-primary shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff]"
            : "border-[#c2d0e6] bg-[#E6EEF8] hover:border-primary/40 text-[#7A8C9E]"
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.txt,.md,image/*"
          onChange={handleFileSelect}
        />
        <label htmlFor="file-upload" className="cursor-pointer block space-y-3">
          <UploadCloud className="w-10 h-10 mx-auto text-[#7A8C9E]" />
          <div className="text-sm font-medium">
            <span className="text-primary hover:underline font-bold">Click to browse</span> or drag & drop files here
          </div>
          <p className="text-xs text-[#5A6E85] max-w-sm leading-relaxed">
            Provision vectors by dropping PDF, TXT, MD, or OCR-compatible images. Files are isolated to your organization's tenant context.
          </p>
        </label>

        {/* Upload Status Overlay Alert */}
        {uploadStatus.status !== "idle" && (
          <div className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl border-none text-xs flex items-center gap-2 shadow-2xl",
            uploadStatus.status === "uploading" && "bg-blue-50 border-blue-200 text-blue-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]",
            uploadStatus.status === "success" && "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]",
            uploadStatus.status === "error" && "bg-rose-50 border-rose-200 text-rose-600 shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff]"
          )}>
            {uploadStatus.status === "uploading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : uploadStatus.status === "success" ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="font-semibold">
              {uploadStatus.status === "uploading" ? "Uploading file..." : uploadStatus.message}
            </span>
          </div>
        )}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 z-10" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search filenames..."
            className="pl-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 rounded-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-40 bg-[#E6EEF8] border-none rounded-full py-1.5 px-3 text-[#5A6E85] hover:text-[#3E4E63] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all text-xs font-mono outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="indexed">Indexed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* 4. Documents Table */}
      <div className="rounded-2xl border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] overflow-hidden">
        {documentsQuery.isPending ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/50 bg-[#D0DBEA]/30 text-[#7A8C9E] uppercase tracking-wider font-mono text-[9px]">
                  <th className="p-4 font-semibold">File Name</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Size</th>
                  <th className="p-4 font-semibold">Chunks</th>
                  <th className="p-4 font-semibold">Registered Date</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[1, 2, 3, 4, 5].map((n) => (
                  <tr key={n} className="bg-transparent">
                    <td className="p-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-8" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-4.5 w-16 rounded-full" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-7 w-16 inline-block" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <FileText className="w-12 h-12 text-[#7A8C9E] mx-auto animate-pulse" />
            <h4 className="text-sm font-semibold text-[#5A6E85]">No documents found</h4>
            <p className="text-xs text-slate-400">Drag files into the dropzone to start index processing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/50 bg-[#D0DBEA]/30 text-[#7A8C9E] uppercase tracking-wider font-mono text-[9px]">
                  <th className="p-4 font-semibold">File Name</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Size</th>
                  <th className="p-4 font-semibold">Chunks</th>
                  <th className="p-4 font-semibold">Registered Date</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className="hover:bg-[#E6EEF8] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all cursor-pointer group"
                  >
                    <td className="p-4 font-medium text-[#3E4E63] group-hover:text-primary transition-colors truncate max-w-xs">
                      {doc.file_name}
                    </td>
                    <td className="p-4 text-[#5A6E85] font-mono uppercase text-[10px]">
                      {doc.file_type.split("/").pop()}
                    </td>
                    <td className="p-4 text-[#5A6E85]">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="p-4 text-[#5A6E85] font-mono">
                      {doc.chunk_count || 0}
                    </td>
                    <td className="p-4 text-[#7A8C9E] font-mono">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider",
                        STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.className
                      )}>
                        {STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.label}
                      </span>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedDocId(doc.id)}
                        className="h-7 px-2.5 text-[10px] border-none bg-[#E6EEF8] shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] text-slate-500 hover:text-[#3E4E63] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Inspect</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Document Detail Drawer */}
      {selectedDocId && selectedDoc && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedDocId(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md h-full bg-[#E6EEF8] border-l border-slate-200/50 shadow-2xl flex flex-col z-10 transition-transform duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/50">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs font-bold text-[#3E4E63] uppercase tracking-widest">
                  Metadata Inspector
                </span>
              </div>
              <button
                onClick={() => setSelectedDocId(null)}
                className="p-1.5 rounded-full hover:shadow-[inset_1.5px_1.5px_3px_#c2d0e6,inset_-1.5px_-1.5px_3px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              
              {/* Document Overview */}
              <div className="space-y-3">
                <h4 className="text-[#7A8C9E] uppercase tracking-wider font-bold text-[9px] font-mono border-b border-slate-200/50 pb-1">
                  File properties
                </h4>
                <div className="grid grid-cols-3 gap-y-2.5 text-[#5A6E85]">
                  <span className="text-[#7A8C9E]">File Name</span>
                  <span className="col-span-2 text-[#3E4E63] font-medium break-all">{selectedDoc.file_name}</span>

                  <span className="text-[#7A8C9E]">Document ID</span>
                  <span className="col-span-2 font-mono text-[#3E4E63] select-all break-all">{selectedDoc.id}</span>

                  <span className="text-[#7A8C9E]">File Size</span>
                  <span className="col-span-2 text-[#3E4E63]">{formatFileSize(selectedDoc.file_size_bytes)}</span>

                  <span className="text-[#7A8C9E]">File Type</span>
                  <span className="col-span-2 font-mono text-[#3E4E63]">{selectedDoc.file_type}</span>

                  <span className="text-[#7A8C9E]">Registered</span>
                  <span className="col-span-2 text-[#3E4E63]">{formatDateTime(selectedDoc.created_at)}</span>

                  {selectedDoc.indexed_at && (
                    <>
                      <span className="text-slate-500">Indexed At</span>
                      <span className="col-span-2 text-slate-300">{formatDateTime(selectedDoc.indexed_at)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Ingestion Job Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-card-border/40 pb-1">
                  <h4 className="text-slate-500 uppercase tracking-wider font-bold text-[9px] font-mono">
                    Celery Task Ingestion Status
                  </h4>
                  {jobDetailsQuery.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
                  )}
                </div>
                
                {jobDetailsQuery.isError ? (
                  <div className="text-slate-500 italic">Failed to retrieve ingestion job telemetry.</div>
                ) : jobDetailsQuery.data ? (
                  <div className="grid grid-cols-3 gap-y-2.5 text-slate-400">
                    <span className="text-slate-500">Job Status</span>
                    <span className="col-span-2">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider font-mono",
                        STATUS_CONFIG[jobDetailsQuery.data.status.toLowerCase() as keyof typeof STATUS_CONFIG]?.className || "bg-slate-800 text-slate-300"
                      )}>
                        {jobDetailsQuery.data.status}
                      </span>
                    </span>

                    <span className="text-slate-500">Celery ID</span>
                    <span className="col-span-2 font-mono text-slate-300 break-all">
                      {jobDetailsQuery.data.celery_task_id || "None allocated"}
                    </span>

                    <span className="text-slate-500">Retry Count</span>
                    <span className="col-span-2 font-mono text-slate-300">
                      {jobDetailsQuery.data.retry_count}
                    </span>

                    <span className="text-slate-500">Started At</span>
                    <span className="col-span-2 text-slate-300">
                      {formatDateTime(jobDetailsQuery.data.started_at)}
                    </span>

                    {jobDetailsQuery.data.completed_at && (
                      <>
                        <span className="text-slate-500">Finished At</span>
                        <span className="col-span-2 text-slate-300">
                          {formatDateTime(jobDetailsQuery.data.completed_at)}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No job record found for this document ID.</p>
                )}

                {/* Error Banner inside drawer */}
                {jobDetailsQuery.data?.error_message && (
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/20 text-rose-400 mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Ingestion Error Telemetry</span>
                    </div>
                    <p className="font-mono text-[10px] whitespace-pre-wrap leading-normal">
                      {jobDetailsQuery.data.error_message}
                    </p>
                  </div>
                )}
              </div>

              {/* Raw Metadata Block */}
              {selectedDoc.metadata && (
                <div className="space-y-2">
                  <h4 className="text-slate-500 uppercase tracking-wider font-bold text-[9px] font-mono border-b border-card-border/40 pb-1">
                    Extracted metadata
                  </h4>
                  <pre className="p-3.5 rounded bg-slate-950 border border-card-border/80 text-[10px] text-accent-cyan font-mono overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedDoc.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Danger Zone */}
              <div className="pt-4 border-t border-card-border/50 space-y-3">
                <h4 className="text-rose-400 uppercase tracking-wider font-bold text-[9px] font-mono">
                  Danger zone
                </h4>
                
                {isConfirmingDelete ? (
                  <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-3">
                    <p className="text-xs text-rose-300 leading-normal">
                      ⚠️ Are you absolutely sure? This will delete the document metadata, clean its Qdrant vectors, and cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteConfirm}
                        disabled={deleteMutation.isPending}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-semibold h-8 py-0 px-3 cursor-pointer text-xs border-none"
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                      </Button>
                      <Button
                        onClick={() => setIsConfirmingDelete(false)}
                        variant="outline"
                        className="h-8 py-0 px-3 border-card-border hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsConfirmingDelete(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all font-semibold rounded-lg bg-transparent cursor-pointer text-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Document</span>
                  </Button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
