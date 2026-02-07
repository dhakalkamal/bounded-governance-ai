"use client";

import { useEffect, useState, useRef } from "react";
import { Send, FileText, Bot, User } from "lucide-react";
import { listDocuments, sendChat } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { document_id: string; filename: string }[];
}

export default function ChatPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listDocuments()
      .then((res) => setDocuments(res.documents || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!input.trim() || selectedDocs.size === 0) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      // Build conversation history from existing messages (exclude sources)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendChat(input, Array.from(selectedDocs), history);
      const assistantMsg: Message = {
        role: "assistant",
        content: res.response,
        sources: res.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${e.message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-3rem)] flex gap-4">
      {/* Document selector sidebar */}
      <div className="w-64 shrink-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Document Context</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Select documents to ground the chat
          </p>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1">
          {documents.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] p-2">
              No documents uploaded.
            </p>
          ) : (
            documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                />
                <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <span className="truncate text-xs">{doc.filename}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">Governed Chat</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Answers are grounded in selected documents only. No external knowledge used.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <Bot className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">
                Select documents and ask a question about your governance docs.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <Bot className="w-6 h-6 text-[var(--accent)] shrink-0 mt-1" />
              )}
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                    {msg.sources.map((s, j) => (
                      <span
                        key={j}
                        className="text-xs bg-white/10 px-2 py-0.5 rounded"
                      >
                        {s.filename}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <User className="w-6 h-6 text-[var(--text-muted)] shrink-0 mt-1" />
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <Bot className="w-6 h-6 text-[var(--accent)] shrink-0 mt-1" />
              <div className="bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
                <span className="animate-pulse text-sm text-[var(--text-muted)]">
                  Thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border)]">
          {selectedDocs.size === 0 && (
            <p className="text-xs text-amber-400 mb-2">
              Select at least one document to start chatting.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about your governance documents..."
              disabled={selectedDocs.size === 0 || sending}
              className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || selectedDocs.size === 0 || sending}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white p-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
