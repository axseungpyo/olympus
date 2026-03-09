"use client";

interface HeaderProps {
  isConnected: boolean;
  projectName?: string;
}

export default function Header({ isConnected, projectName = "Asgard" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-zinc-800/60 bg-bg-primary/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-medium text-zinc-100 font-mono">
          Yggdrasil
        </span>
        <span className="text-zinc-700 text-xs">/</span>
        <span className="text-[13px] text-zinc-500 font-mono">{projectName}</span>
      </div>

      <div className="flex items-center gap-2 text-[13px] font-mono">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-[#a3e635]" : "bg-[#ff6b6b]"
          }`}
        />
        <span className={isConnected ? "text-zinc-500" : "text-[#ff6b6b]"}>
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>
    </header>
  );
}
