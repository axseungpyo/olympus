"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OdinMessage, OdinAction } from "../lib/types";
import { authFetch } from "../lib/auth";

interface CommandBarProps {
  isConnected: boolean;
}

export default function CommandBar({ isConnected }: CommandBarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<OdinMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    authFetch("/api/odin/messages?limit=30")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .catch(() => {});
  }, []);

  // Keyboard shortcut: Ctrl+K to focus
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendCommand = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    setInput("");
    setSending(true);

    try {
      const res = await authFetch("/api/odin/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.messages) {
        setMessages((prev) => [...prev, ...data.messages]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: Date.now(),
          role: "odin",
          type: "response",
          content: "서버 연결 실패. 다시 시도해주세요.",
          metadata: { severity: "critical" },
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleApproval = useCallback(async (action: OdinAction) => {
    setSending(true);
    try {
      const res = await authFetch("/api/odin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: action.id,
          approved: action.type === "approve",
        }),
      });
      const data = await res.json();
      if (data.messages) {
        setMessages((prev) => [...prev, ...data.messages]);
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendCommand();
    }
  };

  // Collapsed bar
  if (!isOpen) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-bg-primary/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="w-full flex items-center gap-3 py-3 text-left"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#d97757" }}>
              <span className="text-[10px] font-mono font-bold text-white">O</span>
            </div>
            <span className="text-[13px] font-mono text-slate-500">
              Odin에게 명령... <kbd className="ml-2 text-[11px] px-1.5 py-0.5 rounded border border-border bg-bg-secondary text-slate-400">⌘K</kbd>
            </span>
            {messages.length > 0 && (
              <span className="ml-auto text-[10px] font-mono text-slate-500">
                {messages.length} messages
              </span>
            )}
            <div className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? "bg-emerald-400" : "bg-red-400"}`} />
          </button>
        </div>
      </div>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-bg-primary/98 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between py-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "#d97757" }}>
              <span className="text-[10px] font-mono font-bold text-white">O</span>
            </div>
            <span className="text-[12px] font-mono text-slate-300">Odin Command Channel</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`} />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-slate-300 transition text-[18px] w-7 h-7 flex items-center justify-center rounded hover:bg-bg-secondary"
          >
            &times;
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="max-h-[300px] overflow-y-auto py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[12px] text-slate-500 font-mono">
                Odin에게 명령을 입력하세요.
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                &quot;상태&quot;, &quot;TP-016 검증&quot;, &quot;TP-016 위임&quot; 등
              </p>
            </div>
          ) : (
            messages.slice(-30).map((msg) => (
              <MessageBubble key={msg.id} message={msg} onAction={handleApproval} sending={sending} />
            ))
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 py-3 border-t border-border/40">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Odin에게 명령..."
            disabled={sending}
            className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-[13px] text-slate-100 outline-none transition focus:border-slate-500 font-mono disabled:opacity-50"
          />
          <button
            onClick={() => void sendCommand()}
            disabled={!input.trim() || sending}
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-100 px-4 py-2 text-[12px] font-medium text-slate-950 transition hover:bg-white disabled:opacity-30 disabled:hover:bg-slate-100"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ──

function MessageBubble({
  message,
  onAction,
  sending,
}: {
  message: OdinMessage;
  onAction: (action: OdinAction) => void;
  sending: boolean;
}) {
  const isUser = message.role === "user";
  const isApproval = message.type === "approval_request";
  const isProgress = message.type === "progress";
  const severity = message.metadata?.severity;

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#d97757" }}>
          <span className="text-[9px] font-mono font-bold text-white">O</span>
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? "bg-slate-700/50 text-slate-200"
            : severity === "critical"
              ? "bg-red-500/10 border border-red-500/30 text-slate-200"
              : isApproval
                ? "bg-amber-500/10 border border-amber-500/30 text-slate-200"
                : isProgress
                  ? "bg-blue-500/10 border border-blue-500/20 text-slate-300"
                  : "bg-bg-secondary border border-border/60 text-slate-200"
        }`}
      >
        <div className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap">
          {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i} className="text-slate-100 font-semibold">
                {part.slice(2, -2)}
              </strong>
            ) : part.includes("`") ? (
              <span key={i}>
                {part.split(/(`[^`]+`)/g).map((seg, j) =>
                  seg.startsWith("`") && seg.endsWith("`") ? (
                    <code key={j} className="text-cyan-300 bg-bg-primary/60 px-1 rounded text-[11px]">
                      {seg.slice(1, -1)}
                    </code>
                  ) : (
                    <span key={j}>{seg}</span>
                  )
                )}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>

        {/* Approval Actions */}
        {isApproval && message.actions && (
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/40">
            {message.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                disabled={sending}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition disabled:opacity-40 ${
                  action.type === "approve"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                    : "bg-slate-700/50 text-slate-400 border border-border hover:text-slate-300"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="text-[9px] text-slate-600 mt-1">
          {new Date(message.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          {message.metadata?.skill && (
            <span className="ml-2 text-slate-500">/{message.metadata.skill}</span>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-mono font-bold text-white">U</span>
        </div>
      )}
    </div>
  );
}
