"use client";

// ---------------------------------------------------------------------------
// useChatStream — SSE streaming hook for reading token and source events
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { chatService } from "@/services/chat.service";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  isTokenExpired,
} from "@/lib/auth";
import type { ChatMessageResponse, ChatSource, SSEEvent } from "@/types";

export function useChatStream(threadId: string | null) {
  const [prevThreadId, setPrevThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset messages during render when threadId changes to avoid cascading effect renders
  if (threadId !== prevThreadId) {
    setPrevThreadId(threadId);
    setMessages([]);
  }
  
  // Keep a ref of messages to avoid stale state in stream reader
  const messagesRef = useRef<ChatMessageResponse[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch initial thread history when threadId changes
  useEffect(() => {
    if (!threadId) {
      return;
    }

    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await chatService.getMessages(threadId);
        setMessages(response.data);
      } catch (err) {
        const errorMsg = axios.isAxiosError(err)
          ? err.response?.data?.detail
          : err instanceof Error
          ? err.message
          : "Failed to load chat history. Please try again.";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [threadId]);

  const sendMessage = useCallback(
    async (question: string, mode: "standard" | "strict" = "standard") => {
      if (!threadId) return;

      setIsStreaming(true);
      setError(null);

      // 1. Create client-side message representation for the user query
      const userMessage: ChatMessageResponse = {
        id: `temp-user-${Date.now()}`,
        thread_id: threadId,
        role: "user",
        content: question,
        sources: null,
        created_at: new Date().toISOString(),
      };

      // 2. Create client-side placeholder for the incoming assistant response
      const assistantMessageId = `temp-assistant-${Date.now()}`;
      const assistantPlaceholder: ChatMessageResponse = {
        id: assistantMessageId,
        thread_id: threadId,
        role: "assistant",
        content: "",
        sources: null,
        created_at: new Date().toISOString(),
      };

      // Optimistically push messages to active list
      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

      try {
        // 3. Handle auth token validity before opening connection
        let token = getAccessToken();
        const refreshToken = getRefreshToken();

        if (token && isTokenExpired(token) && refreshToken) {
          try {
            const refreshResponse = await axios.post("/api/v1/auth/refresh", {
              refresh_token: refreshToken,
            });
            token = refreshResponse.data.access_token;
            if (token) {
              setAccessToken(token);
            }
          } catch (refreshErr) {
            console.error("Token refresh failed in chat stream:", refreshErr);
            // Let the stream proceed; if it returns 401, standard logout handles it.
          }
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // 4. Fire fetch stream request
        const response = await fetch(`/api/v1/chat/threads/${threadId}/stream`, {
          method: "POST",
          headers,
          body: JSON.stringify({ question, mode }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.detail || `Server error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable.");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let accumulatedContent = "";
        let accumulatedSources: ChatSource[] | null = null;

        // 5. Read stream data in loop
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          // The last element is the remaining fragment
          buffer = parts.pop() || "";

          for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart) continue;

            const lines = trimmedPart.split("\n");
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith("data: ")) {
                const jsonStr = trimmedLine.slice(6).trim();
                try {
                  const event: SSEEvent = JSON.parse(jsonStr);

                  if (event.type === "token") {
                    accumulatedContent += event.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  } else if (event.type === "sources") {
                    accumulatedSources = event.sources;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, sources: accumulatedSources }
                          : msg
                      )
                    );
                  } else if (event.type === "error") {
                    throw new Error(event.content);
                  } else if (event.type === "done") {
                    // Stream finished cleanly
                  }
                } catch (parseErr) {
                  // If it's the custom Error we threw, propagate it
                  if (parseErr instanceof Error && parseErr.message && !jsonStr.includes("token")) {
                    throw parseErr;
                  }
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An error occurred while streaming response.";
        setError(errorMsg);
        // If there's an error and assistant message is empty, strip it
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantMessageId && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [threadId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
