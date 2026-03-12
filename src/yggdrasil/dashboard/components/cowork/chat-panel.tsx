"use client";

import { useEffect, useRef, useState } from "react";
import type { OdinAction, OdinMessage } from "../../lib/types";
import { authFetch } from "../../lib/auth";

interface ChatPanelProps {
  messages: OdinMessage[];
  className?: string;
}

export function ChatPanel({ messages, className = "" }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    setInput("");

    try {
      await authFetch("/api/odin/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } finally {
      setSending(false);
    }
  };

  const handleApproval = async (action: OdinAction) => {
    if (sending) {
      return;
    }

    setSending(true);
    try {
      await authFetch("/api/odin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: action.id,
          approved: action.type === "approve",
        }),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`bg-bg-secondary border border-border/60 rounded-lg p-4 flex flex-col ${className}`}>
      <div>
        <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
          Chat
        </h2>
        <p className="mt-2 text-sm text-slate-300">Command Odin and approve gated actions inline.</p>
      </div>

      <div ref={scrollRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-bg-primary/30 px-4 py-6 text-sm text-slate-400">
            No messages yet.
          </div>
        ) : (
          messages.slice(-30).map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApproval={handleApproval}
              sending={sending}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-4">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="메시지 입력..."
          disabled={sending}
          className="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-[13px] text-slate-100 outline-none transition focus:border-slate-500 font-mono disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-100 px-4 py-2 text-[12px] font-medium text-slate-950 transition hover:bg-white disabled:opacity-30 disabled:hover:bg-slate-100"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  onApproval,
  sending,
}: {
  message: OdinMessage;
  onApproval: (action: OdinAction) => Promise<void>;
  sending: boolean;
}) {
  const isUser = message.role === "user";
  const isApproval = message.type === "approval_request";
  const isProgress = message.type === "progress";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? "bg-slate-700/50 text-slate-200"
            : isApproval
              ? "border border-amber-500/30 bg-amber-500/10 text-slate-200"
              : isProgress
                ? "border border-blue-500/20 bg-blue-500/10 text-slate-300"
                : "border border-border/60 bg-bg-primary/70 text-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
          <span>{isUser ? "You" : "Odin"}</span>
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed">{message.content}</p>

        {isApproval && message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions
              .filter((action) => action.type === "approve" || action.type === "reject")
              .map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => void onApproval(action)}
                  disabled={sending}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-mono transition ${
                    action.type === "approve"
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  } disabled:opacity-40`}
                >
                  {action.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
