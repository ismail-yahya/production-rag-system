// ---------------------------------------------------------------------------
// Chat service — threads and messages (non-streaming operations)
// ---------------------------------------------------------------------------

import api from "@/lib/api";
import type {
  ChatThreadResponse,
  ChatThreadCreate,
  ChatMessageResponse,
} from "@/types";

export const chatService = {
  listThreads(workspaceId?: string) {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    return api.get<ChatThreadResponse[]>("/v1/chat/threads", { params });
  },

  createThread(data: ChatThreadCreate) {
    return api.post<ChatThreadResponse>("/v1/chat/threads", data);
  },

  deleteThread(threadId: string) {
    return api.delete(`/v1/chat/threads/${threadId}`);
  },

  getMessages(threadId: string) {
    return api.get<ChatMessageResponse[]>(
      `/v1/chat/threads/${threadId}/messages`
    );
  },

  /**
   * SSE streaming is handled separately in the use-chat-stream hook
   * because Axios doesn't natively support ReadableStream consumption.
   * This service covers only REST operations.
   */
};
