"use client";

import type { OdinMessage } from "../../lib/types";

interface OdinThinkingProps {
  messages: OdinMessage[];
}

export function OdinThinking({ messages }: OdinThinkingProps) {
  const recentMessages = messages
    .filter((message) => message.role === "odin" && (message.type === "progress" || message.type === "response"))
    .slice(-3)
    .reverse();

  return (
    <section className="rounded-lg border border-border/60 bg-bg-secondary/80 p-4 backdrop-blur-sm">
      <div>
        <h2 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
          Odin&apos;s Thinking
        </h2>
        <p className="mt-2 text-sm text-slate-300">Recent progress and responses from Odin.</p>
      </div>

      <div className="mt-4 space-y-2">
        {recentMessages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-bg-primary/30 px-4 py-5 text-sm text-slate-400 font-mono">
            Awaiting Odin messages.
          </div>
        ) : (
          recentMessages.map((message) => (
            <div
              key={message.id}
              className="rounded-lg border border-border/50 bg-bg-primary/40 px-3 py-3 font-mono text-[12px] leading-6 text-slate-200"
            >
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                <span>{message.type}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">{message.content}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
