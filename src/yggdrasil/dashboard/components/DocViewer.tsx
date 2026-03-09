"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocViewerProps {
  type: "tp" | "rp";
  id: string;
  onClose: () => void;
}

export default function DocViewer({ type, id, onClose }: DocViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/document/${type}/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found");
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [type, id]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[520px] bg-bg-secondary border-l border-zinc-800 z-50 animate-slide-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <span className="font-mono text-sm text-zinc-300">
            {type.toUpperCase()}-{id}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            esc
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-16">
              <span className="text-xs text-zinc-600 font-mono">loading...</span>
            </div>
          )}
          {error && (
            <p className="text-[#ff6b6b] text-sm text-center py-12">{error}</p>
          )}
          {content && (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-200 prose-headings:font-medium prose-p:text-zinc-400 prose-a:text-[#67e8f9] prose-a:no-underline hover:prose-a:underline prose-code:text-[#fbbf24] prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-bg-primary prose-pre:border prose-pre:border-zinc-800 prose-td:text-zinc-400 prose-th:text-zinc-300 prose-hr:border-zinc-800 prose-strong:text-zinc-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
