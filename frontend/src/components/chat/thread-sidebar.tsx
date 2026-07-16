"use client";

// ---------------------------------------------------------------------------
// ThreadSidebar — Panel for workspace-scoped chat thread history & new threads
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "@/services/chat.service";
import { workspacesService } from "@/services/workspaces.service";
import { 
  MessageSquareCode, 
  Plus, 
  Trash2, 
  Search, 
  Filter,
  X,
  Loader2,
  ChevronDown
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ThreadSidebarProps {
  activeThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
}

export function ThreadSidebar({ activeThreadId, onSelectThread }: ThreadSidebarProps) {
  const queryClient = useQueryClient();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadWorkspaceId, setNewThreadWorkspaceId] = useState<string>("");
  
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  // 1. Fetch threads
  const threadsQuery = useQuery({
    queryKey: ["threads", selectedWorkspaceId],
    queryFn: async () => {
      const workspaceParam = selectedWorkspaceId === "all" ? undefined : selectedWorkspaceId;
      const response = await chatService.listThreads(workspaceParam);
      return response.data;
    },
  });

  // 2. Fetch workspaces for filter dropdown
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const response = await workspacesService.list();
      return response.data;
    },
  });

  // 3. Create Thread Mutation
  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const response = await chatService.createThread({
        title: newThreadTitle.trim() || "New Chat Thread",
        workspace_id: newThreadWorkspaceId || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      onSelectThread(data.id);
      setIsCreateModalOpen(false);
      setNewThreadTitle("");
      setNewThreadWorkspaceId("");
    },
  });

  // 4. Delete Thread Mutation
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await chatService.deleteThread(threadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (activeThreadId === threadToDelete) {
        onSelectThread(null);
      }
      setThreadToDelete(null);
    },
  });

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    createThreadMutation.mutate();
  };

  const handleDeleteConfirm = () => {
    if (threadToDelete) {
      deleteThreadMutation.mutate(threadToDelete);
    }
  };

  // Filter threads by search query
  const filteredThreads = (threadsQuery.data || []).filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 h-full border-r border-slate-200/50 bg-[#E6EEF8] flex flex-col shrink-0">
      
      {/* Search and Action Header */}
      <div className="p-4 border-b border-slate-200/50 space-y-3 bg-[#E6EEF8]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareCode className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-sm text-[#3E4E63] uppercase font-mono tracking-wider">
              Conversations
            </h2>
          </div>
          
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="h-8 py-0 px-2.5 flex items-center gap-1 bg-gradient-to-r from-blue-400 to-blue-600 shadow-[2px_2px_4px_#c2d0e6,-2px_-2px_4px_#ffffff] text-white hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.15)] text-xs font-mono font-bold uppercase tracking-wider cursor-pointer border-none rounded-full transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 h-9 bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 text-xs shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] focus-visible:ring-primary/20 focus-visible:border-primary/40 rounded-full"
          />
        </div>

        {/* Workspace scope selector */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="relative flex-1">
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="w-full bg-[#E6EEF8] border-none rounded-full py-1 px-3.5 text-[#5A6E85] hover:text-[#3E4E63] shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] transition-all text-xs font-mono outline-none cursor-pointer appearance-none pr-8"
            >
              <option value="all" className="bg-[#E6EEF8] text-[#3E4E63]">All Workspaces</option>
              {workspacesQuery.data?.map((ws) => (
                <option key={ws.id} value={ws.id} className="bg-[#E6EEF8] text-[#3E4E63]">
                  {ws.name} ({ws.workspace_type})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3.5 top-2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[#E6EEF8]">
        {threadsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[10px] font-mono uppercase">Loading threads...</span>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="text-center p-8 text-[#7A8C9E] space-y-1 font-mono">
            <p className="text-[10px] uppercase">No threads found</p>
            <p className="text-[9px] text-slate-400">Start a new thread to begin chatting.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-xl text-xs transition-all duration-200 cursor-pointer relative border-none mb-1.5",
                  isActive
                    ? "bg-[#E6EEF8] text-primary font-bold shadow-[inset_3px_3px_6px_#c2d0e6,inset_-3px_-3px_6px_#ffffff]"
                    : "text-[#7A8C9E] hover:text-[#3E4E63] hover:shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] bg-[#E6EEF8]"
                )}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className="flex flex-col min-w-0 flex-1 pr-2">
                  <span className="font-semibold truncate block">
                    {thread.title}
                  </span>
                  <span className="text-[9px] text-[#7A8C9E] font-mono mt-1">
                    {formatDate(thread.updated_at)}
                  </span>
                </div>
                
                {/* Delete button (only show on hover, unless active) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setThreadToDelete(thread.id);
                  }}
                  className={cn(
                    "p-1.5 rounded-full hover:bg-rose-100 hover:text-rose-600 text-slate-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0 shadow-[1px_1px_3px_#c2d0e6,-1px_-1px_3px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff]",
                    threadToDelete === thread.id && "opacity-100 text-rose-600 bg-rose-100 shadow-[inset_1px_1px_2px_#c2d0e6,inset_-1px_-1px_2px_#ffffff]"
                  )}
                  title="Delete thread"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE THREAD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-6 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <h3 className="text-sm font-bold text-[#3E4E63] uppercase font-mono tracking-wider flex items-center gap-2">
                <MessageSquareCode className="w-4 h-4 text-primary" />
                Create New Conversation
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-full hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] hover:bg-[#E6EEF8] text-[#7A8C9E] hover:text-[#3E4E63] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="thread-title" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Conversation Title
                </Label>
                <Input
                  id="thread-title"
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="e.g. Finance Reports Analysis Q2"
                  className="bg-[#E6EEF8] border-none text-[#3E4E63] placeholder-slate-400 focus-visible:ring-primary/20 focus-visible:border-primary/40 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] rounded-full pl-4"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="thread-workspace" className="text-[#5A6E85] font-mono uppercase text-[10px]">
                  Scope Workspace (Optional)
                </Label>
                <div className="relative">
                  <select
                    id="thread-workspace"
                    value={newThreadWorkspaceId}
                    onChange={(e) => setNewThreadWorkspaceId(e.target.value)}
                    className="w-full bg-[#E6EEF8] border-none rounded-full py-2 px-4 text-[#3E4E63] text-xs font-mono outline-none cursor-pointer appearance-none pr-8 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff]"
                  >
                    <option value="" className="bg-[#E6EEF8] text-[#3E4E63]">Global (No Workspace Scope)</option>
                    {workspacesQuery.data?.map((ws) => (
                      <option key={ws.id} value={ws.id} className="bg-[#E6EEF8] text-[#3E4E63]">
                        {ws.name} ({ws.workspace_type})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-4 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer text-xs font-mono uppercase tracking-wider rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createThreadMutation.isPending}
                  className="h-9 px-4 bg-gradient-to-tr from-blue-400 to-blue-600 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-2px_-2px_4px_rgba(255,255,255,0.15)] border-none text-white cursor-pointer text-xs font-mono uppercase tracking-wider rounded-full"
                >
                  {createThreadMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  ) : null}
                  Start Chat
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE THREAD CONFIRMATION MODAL */}
      {threadToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#E6EEF8] border-none rounded-2xl shadow-[8px_8px_16px_#c2d0e6,-8px_-8px_16px_#ffffff] p-6 space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-rose-600 uppercase font-mono tracking-wider">
              Confirm Thread Deletion
            </h3>
            <p className="text-xs text-[#5A6E85] leading-relaxed">
              Are you sure you want to permanently delete this conversation history? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2 text-xs">
              <Button
                type="button"
                variant="outline"
                onClick={() => setThreadToDelete(null)}
                className="h-9 px-4 border-none bg-[#E6EEF8] shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] text-[#7A8C9E] hover:text-[#3E4E63] cursor-pointer font-mono uppercase tracking-wider rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteThreadMutation.isPending}
                className="h-9 px-4 bg-rose-100 shadow-[3px_3px_6px_#c2d0e6,-3px_-3px_6px_#ffffff] text-rose-600 hover:shadow-[inset_2px_2px_4px_#c2d0e6,inset_-2px_-2px_4px_#ffffff] cursor-pointer font-mono uppercase tracking-wider border-none rounded-full"
              >
                {deleteThreadMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                ) : null}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
