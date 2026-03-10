"use client";

import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  isConnected: boolean;
  projectName?: string;
  onSettingsClick?: () => void;
}

export default function Header({ isConnected, projectName = "Asgard", onSettingsClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-bg-primary/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-medium text-slate-100 font-mono">
          Yggdrasil
        </span>
        <span className="text-slate-500 text-xs">/</span>
        <span className="text-[13px] text-slate-400 font-mono">{projectName}</span>
      </div>

      <div className="flex items-center gap-4 text-[13px] font-mono">
        <ThemeToggle />
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="text-slate-500 hover:text-slate-300 transition"
            title="API Keys & Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-[#a3e635]" : "bg-[#ff6b6b]"
            }`}
          />
          <span className={isConnected ? "text-slate-400" : "text-[#ff6b6b]"}>
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
