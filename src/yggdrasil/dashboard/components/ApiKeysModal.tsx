"use client";

import { useState, useEffect } from "react";

const API_KEY_FIELDS = [
  { id: "loki-api-key", label: "Loki (Image Gen)", placeholder: "sk-..." },
  { id: "custom-api-key", label: "Custom API", placeholder: "API key..." },
];

const STORAGE_PREFIX = "yggdrasil-api-key-";

interface ApiKeysModalProps {
  onClose: () => void;
}

export default function ApiKeysModal({ onClose }: ApiKeysModalProps) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const field of API_KEY_FIELDS) {
      loaded[field.id] = localStorage.getItem(`${STORAGE_PREFIX}${field.id}`) || "";
    }
    setKeys(loaded);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSave = () => {
    for (const field of API_KEY_FIELDS) {
      const val = keys[field.id] || "";
      if (val) localStorage.setItem(`${STORAGE_PREFIX}${field.id}`, val);
      else localStorage.removeItem(`${STORAGE_PREFIX}${field.id}`);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-500">Settings</div>
              <h2 className="mt-1 text-lg font-mono text-zinc-100">API Keys</h2>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition text-xl leading-none">&times;</button>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-zinc-500">
            Enter API keys for external services. Keys are stored in your browser only.
          </p>

          <div className="mt-5 space-y-4">
            {API_KEY_FIELDS.map((field) => (
              <div key={field.id}>
                <label className="block text-[12px] font-mono text-zinc-400 mb-1.5">{field.label}</label>
                <input
                  type="password"
                  value={keys[field.id] || ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-600 font-mono"
                />
              </div>
            ))}
          </div>

          {saved && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300 font-mono">
              Keys saved to browser storage.
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200 hover:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
