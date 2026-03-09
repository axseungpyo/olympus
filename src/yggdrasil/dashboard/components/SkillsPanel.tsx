"use client";

import { useState } from "react";

type Category = "all" | "planning" | "dispatch" | "intel" | "system";

interface Skill {
  name: string;
  cmd: string;
  category: Exclude<Category, "all">;
  description: string;
  agentColor: string;
  agentLabel: string;
  tools: string[];
  usage: string;
  note?: string;
}

const SKILLS: Skill[] = [
  {
    name: "plan",
    cmd: "/plan",
    category: "planning",
    description: "Rune(TP-NNN.md)을 생성한다. 모든 작업의 시작점.",
    agentColor: "#d97757",
    agentLabel: "Odin",
    tools: ["Read", "Write", "Glob"],
    usage: '/plan "로그인 기능 구현"',
    note: "Brokkr 또는 Heimdall 중 Agent Target 자동 결정",
  },
  {
    name: "review",
    cmd: "/review",
    category: "planning",
    description: "Saga(RP-NNN.md)를 Rune의 AC 기준으로 검토하고 approved / revision / blocked 판정.",
    agentColor: "#d97757",
    agentLabel: "Odin",
    tools: ["Read", "Write", "Glob"],
    usage: "/review RP-003",
    note: "AC를 하나씩 증거 기반으로 확인",
  },
  {
    name: "validate",
    cmd: "/validate",
    category: "planning",
    description: "Rune(TP)의 포맷과 품질을 자동 검증한다.",
    agentColor: "#d97757",
    agentLabel: "Odin",
    tools: ["Read", "Glob"],
    usage: "/validate TP-005",
  },
  {
    name: "retry",
    cmd: "/retry",
    category: "planning",
    description: "실패한(blocked) Rune을 재실행한다.",
    agentColor: "#d97757",
    agentLabel: "Odin",
    tools: ["Read", "Write", "Bash", "Glob"],
    usage: "/retry TP-004",
  },
  {
    name: "delegate",
    cmd: "/delegate",
    category: "dispatch",
    description: "Brokkr(Codex CLI)에게 Rune을 전달하여 코드 작업을 위임한다.",
    agentColor: "#10a37f",
    agentLabel: "Brokkr",
    tools: ["Read", "Write", "Bash", "Glob"],
    usage: "/delegate TP-003",
    note: "Agent Target이 codex인 TP에만 사용",
  },
  {
    name: "delegate-gemini",
    cmd: "/delegate-gemini",
    category: "dispatch",
    description: "Heimdall(Gemini CLI)에게 Rune을 전달하여 비전/생성 작업을 위임한다.",
    agentColor: "#4285f4",
    agentLabel: "Heimdall",
    tools: ["Read", "Write", "Bash", "Glob"],
    usage: "/delegate-gemini TP-004",
    note: "이미지 분석·생성, OCR, 웹 리서치 전용",
  },
  {
    name: "chain",
    cmd: "/chain",
    category: "dispatch",
    description: "Heimdall 분석 → Brokkr 구현으로 이어지는 멀티에이전트 체인을 실행한다.",
    agentColor: "#a78bfa",
    agentLabel: "Heimdall → Brokkr",
    tools: ["Read", "Write", "Bash", "Glob"],
    usage: '/chain "스크린샷 보고 UI 구현"',
    note: "Agent Target: chain:gemini->codex",
  },
  {
    name: "scout",
    cmd: "/scout",
    category: "intel",
    description: "Claude 서브에이전트를 병렬로 실행하여 코드베이스 탐색, Saga 검증, 기획 리서치를 수행한다.",
    agentColor: "#d97757",
    agentLabel: "Odin (Sub)",
    tools: ["Read", "Glob", "Grep", "Agent"],
    usage: '/scout "인증 관련 코드 파악"',
    note: "3가지 모드: Explore / verify RP-NNN / plan \"주제\"",
  },
  {
    name: "team",
    cmd: "/team",
    category: "intel",
    description: "여러 Claude 인스턴스를 팀으로 구성하여 병렬 협업 구현한다. (실험적)",
    agentColor: "#f0abfc",
    agentLabel: "Claude Teams",
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
    usage: '/team "3개 컴포넌트 병렬 구현"',
    note: "scout과 달리 팀원끼리 직접 소통·코드 수정 가능",
  },
  {
    name: "digest",
    cmd: "/digest",
    category: "system",
    description: "프로젝트 맥락을 압축하여 shared/context.md를 최신 상태로 유지한다.",
    agentColor: "#a1a1aa",
    agentLabel: "Odin",
    tools: ["Read", "Write", "Glob"],
    usage: "/digest",
    note: "TP 3개 이상 완료 후 또는 세션이 길어질 때 권장",
  },
  {
    name: "status",
    cmd: "/status",
    category: "system",
    description: "artifacts/INDEX.md를 기반으로 프로젝트 현황을 요약 보고한다.",
    agentColor: "#a1a1aa",
    agentLabel: "Odin",
    tools: ["Read"],
    usage: "/status",
  },
  {
    name: "init",
    cmd: "/init",
    category: "system",
    description: "새 프로젝트의 아티팩트 디렉토리 구조를 초기화한다.",
    agentColor: "#a1a1aa",
    agentLabel: "Odin",
    tools: ["Write", "Bash"],
    usage: "/init",
    note: "artifacts/, shared/, .claude/ 구조 생성",
  },
];

const CATEGORIES: { key: Category; label: string; count?: number }[] = [
  { key: "all", label: "All" },
  { key: "planning", label: "Planning" },
  { key: "dispatch", label: "Dispatch" },
  { key: "intel", label: "Intel" },
  { key: "system", label: "System" },
];

const categoryColors: Record<Exclude<Category, "all">, string> = {
  planning: "#a78bfa",
  dispatch: "#10a37f",
  intel: "#fbbf24",
  system: "#71717a",
};

export default function SkillsPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = activeCategory === "all"
    ? SKILLS
    : SKILLS.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex items-center gap-px border-b border-zinc-800/60 pb-0">
        {CATEGORIES.map((cat) => {
          const count = cat.key === "all"
            ? SKILLS.length
            : SKILLS.filter((s) => s.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="px-3 py-2 text-[12px] font-mono transition-colors rounded-t flex items-center gap-1.5"
              style={{
                color: activeCategory === cat.key
                  ? cat.key === "all" ? "#e4e4e7" : categoryColors[cat.key as Exclude<Category, "all">]
                  : "#52525b",
              }}
            >
              {cat.label}
              <span className="text-[11px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Skills List — skills.sh leaderboard style */}
      <div className="bg-bg-secondary border border-zinc-500/60 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_7rem_1fr_6rem_1fr] gap-4 px-4 py-2 border-b border-zinc-800/60 bg-zinc-800/20">
          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">#</span>
          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">Command</span>
          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">Description</span>
          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">Agent</span>
          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">Tools</span>
        </div>

        <div>
          {filtered.map((skill, i) => {
            const catColor = categoryColors[skill.category];
            const isOpen = expanded === skill.name;

            return (
              <div key={skill.name} className="border-b border-zinc-800/40 last:border-0">
                {/* Main row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : skill.name)}
                  className="w-full grid grid-cols-[2rem_7rem_1fr_6rem_1fr] gap-4 px-4 py-3 hover:bg-zinc-800/30 transition-colors text-left items-center"
                >
                  <span className="text-[12px] text-zinc-700 font-mono">{i + 1}</span>

                  <span className="font-mono text-[13px] font-medium" style={{ color: catColor }}>
                    {skill.cmd}
                  </span>

                  <span className="text-[13px] text-zinc-300 truncate">{skill.description}</span>

                  <span className="text-[12px] font-mono" style={{ color: skill.agentColor }}>
                    {skill.agentLabel}
                  </span>

                  <div className="flex items-center gap-1 flex-wrap">
                    {skill.tools.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 bg-bg-primary/50 border-t border-zinc-800/40">
                    <div className="pt-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider w-16 shrink-0 pt-0.5">Usage</span>
                        <code className="text-[12px] font-mono text-[#67e8f9] bg-zinc-800/60 px-2 py-1 rounded">
                          {skill.usage}
                        </code>
                      </div>

                      {skill.note && (
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider w-16 shrink-0 pt-0.5">Note</span>
                          <span className="text-[12px] text-zinc-500">{skill.note}</span>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider w-16 shrink-0 pt-0.5">Category</span>
                        <span
                          className="text-[12px] font-mono px-2 py-0.5 rounded"
                          style={{ color: catColor, backgroundColor: `${catColor}15` }}
                        >
                          {skill.category}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-zinc-700 font-mono text-right">
        {filtered.length} skills · click row to expand
      </p>
    </div>
  );
}
