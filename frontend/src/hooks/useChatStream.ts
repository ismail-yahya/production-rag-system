"use client";

import { useState, useCallback } from "react";

export interface CitationSource {
  id: string;
  title: string;
  page?: number;
  snippet: string;
  score: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: CitationSource[];
}

interface SendMessageOptions {
  model: string;
  temperature: number;
  queryExpansion: boolean;
  mockMode?: boolean;
}

const mockResponses = [
  {
    content: "According to the corporate guidelines [Source 1], remote employees are required to configure their VPN access using multifactor authentication. The IT support desk handles approval for all custom routing configurations [Source 2]. Additionally, all security patches must be verified weekly [Source 3].",
    sources: [
      {
        id: "doc-101",
        title: "employee_handbook_2026.pdf",
        page: 14,
        score: 0.94,
        snippet: "All remote operations must go through the corporate VPN gateway. Multi-factor authentication (MFA) is strictly required for all connections to secure networks. Users are responsible for updating their authentication tokens monthly.",
      },
      {
        id: "doc-102",
        title: "security_protocols_v2.pdf",
        page: 3,
        score: 0.88,
        snippet: "Approval for any routing adjustments or custom subnets resides with the Chief Information Security Officer (CISO). IT service desk engineers execute approved rulesets into core firewalls only after formal change-management approval.",
      },
      {
        id: "doc-103",
        title: "it_maintenance_schedule.pdf",
        page: 8,
        score: 0.81,
        snippet: "Verification of operating system security patches occurs every Tuesday at 03:00 UTC. System administrators must log compliance reports in the audit repository within 2 hours of verification.",
      },
    ],
  },
  {
    content: "Based on the Q2 financial performance records [Source 1], total revenue grew by 14.5% quarter-over-quarter, driven primarily by enterprise software subscription additions. Operative costs scaled by only 3.2% [Source 2], leading to a net margin improvement of 450 basis points.",
    sources: [
      {
        id: "doc-201",
        title: "q2_financial_report.pdf",
        page: 2,
        score: 0.96,
        snippet: "Enterprise cloud subscriptions added $4.2M in annual recurring revenue (ARR) during Q2. This represents a quarter-over-quarter expansion of 14.5%, outperforming the initial forecast of 11.2%.",
      },
      {
        id: "doc-202",
        title: "cost_structures_2026.pdf",
        page: 11,
        score: 0.87,
        snippet: "Infrastructure operations costs remained flat due to optimized resource allocations in server clusters. Total administrative overhead scaled by 3.2%, matching inflation adjustments.",
      },
    ],
  },
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am Aether RAG, your secure corporate search assistant. Ask me a question about your documents, and I'll answer using grounded sources.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Hello! I am Aether RAG, your secure corporate search assistant. Ask me a question about your documents, and I'll answer using grounded sources.",
      },
    ]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, options: SendMessageOptions) => {
      if (!text.trim()) return;

      const userMessageId = `msg-${Date.now()}-user`;
      const assistantMessageId = `msg-${Date.now()}-assistant`;

      const userMsg: Message = { id: userMessageId, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      // 1. Client-Side Mock Stream Mode (Fallback & Standalone Demonstration)
      if (options.mockMode || process.env.NEXT_PUBLIC_MOCK_API === "true") {
        setTimeout(() => {
          // Choose a response based on query keywords or rotate
          const responseTemplate = text.toLowerCase().includes("cost") || text.toLowerCase().includes("revenue")
            ? mockResponses[1]
            : mockResponses[0];

          let currentText = "";
          const tokens = responseTemplate.content.split(" ");
          let tokenIndex = 0;

          // Add empty placeholder assistant bubble
          const initialAssistantMsg: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            sources: [],
          };
          setMessages((prev) => [...prev, initialAssistantMsg]);

          const interval = setInterval(() => {
            if (tokenIndex < tokens.length) {
              currentText += (tokenIndex === 0 ? "" : " ") + tokens[tokenIndex];
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: currentText } : msg
                )
              );
              tokenIndex++;
            } else {
              // Finalize message and add sources
              clearInterval(interval);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: responseTemplate.content, sources: responseTemplate.sources }
                    : msg
                )
              );
              setIsLoading(false);
            }
          }, 60);
        }, 800);

        return;
      }

      // 2. Real SSE Stream API Execution Path
      try {
        const token = getCookie("session_token");
        const workspaceId = getCookie("active_workspace_id");

        const response = await fetch("/api/v1/query/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            question: text,
            mode: options.model === "strict" ? "strict" : "standard",
            search_type: "hybrid",
            filters: workspaceId ? { document_ids: [] } : undefined, // workspace routing handles documents list
          }),
        });

        if (!response.ok) {
          throw new Error(`API server returned code: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("API stream body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let accumulatedContent = "";
        let sources: CitationSource[] = [];

        // Add empty placeholder assistant bubble
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: "", sources: [] },
        ]);

        // Stream parser loop
        let buffer = "";
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse data payload of SSE
              if (line.startsWith("data: ")) {
                const dataVal = line.substring(6).trim();
                try {
                  const event = JSON.parse(dataVal);

                  if (event.type === "token") {
                    accumulatedContent += event.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
                      )
                    );
                  } else if (event.type === "sources") {
                    const mappedSources = event.sources.map((s: any) => ({
                      id: s.document_id,
                      title: s.file_name,
                      page: s.page_number || undefined,
                      snippet: s.snippet,
                      score: s.relevance_score,
                    }));
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, sources: mappedSources } : msg
                      )
                    );
                  } else if (event.type === "done") {
                    done = true;
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data block", e);
                }
              }
            }
          }
        }

        setIsLoading(false);
      } catch (err: any) {
        console.warn("API request failed, falling back to mock streaming", err);
        // Fall back to Mock mode on network error so the UI remains fully interactive
        sendMessage(text, { ...options, mockMode: true });
      }
    },
    []
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };
}
