"use client";

import { useState } from "react";

// ─── Color System v2 ───────────────────────────────────────────
// 원칙: Agent(브랜드) / Status(상태) / Accent(피드백) 3개 카테고리가
//       색상환(Hue) 상에서 절대 겹치지 않는다.
//
// Hue 배분:
//   Agent  — Odin 20° (테라코타) / Brokkr 160° (틸) / Heimdall 217° (블루)
//   Status — Idle 210° (슬레이트) / Running 262° (바이올렛) / Done 82° (샤르트뢰즈)
//            Review 290° (퓨셔) / Blocked 0° (레드) / Draft 220° (다크슬레이트)
//   Accent — Link 190° (시안) / Warning 43° (옐로) / Info 255° (라벤더)

const colorSystem = {
  backgrounds: [
    { name: "bg-abyss", hex: "#060910", role: "Terminal 내부, 코드 블록", css: "bg-[#060910]" },
    { name: "bg-primary", hex: "#0f172a", role: "페이지 배경 (기본)", css: "bg-bg-primary" },
    { name: "bg-secondary", hex: "#1e293b", role: "카드, 패널, 섹션", css: "bg-bg-secondary" },
    { name: "bg-tertiary", hex: "#334155", role: "테두리, 구분선, hover", css: "border-bg-tertiary" },
    { name: "bg-elevated", hex: "#475569", role: "활성 탭, 강조 배경", css: "bg-[#475569]" },
  ],

  texts: [
    { name: "text-primary", hex: "#f1f5f9", role: "제목, 강조 텍스트" },
    { name: "text-secondary", hex: "#cbd5e1", role: "본문 텍스트" },
    { name: "text-tertiary", hex: "#94a3b8", role: "보조 정보, 레이블" },
    { name: "text-muted", hex: "#64748b", role: "비활성, 타임스탬프" },
    { name: "text-ghost", hex: "#475569", role: "플레이스홀더, 배경 문자" },
  ],

  // ─── Agent Identity (브랜드 고정, Hue: 20° / 160° / 217°) ───
  agents: [
    {
      name: "Odin",
      role: "Brain · Claude Opus 4.6",
      brand: "Anthropic",
      hue: "20°",
      primary: "#d97757",
      light: "#e8956f",
      muted: "#4a2a1e",
      gradient: ["#d97757", "#b85c3a"],
    },
    {
      name: "Brokkr",
      role: "Hands-Code · GPT-5.4",
      brand: "OpenAI",
      hue: "160°",
      primary: "#10a37f",
      light: "#34c6a0",
      muted: "#0d3d30",
      gradient: ["#10a37f", "#0d8a6a"],
    },
    {
      name: "Heimdall",
      role: "Hands-Vision · Gemini 3.1 Pro",
      brand: "Google",
      hue: "217°",
      primary: "#4285f4",
      light: "#6ea8f7",
      muted: "#1a3564",
      gradient: ["#4285f4", "#2b6de0"],
    },
  ],

  // ─── Status (Agent와 완전 분리, Hue: 210° / 262° / 82° / 290° / 0° / 220°) ───
  statuses: [
    { name: "Idle",    hex: "#94a3b8", bg: "#94a3b815", hue: "210°", meaning: "대기 중 — 비활성 상태" },
    { name: "Running", hex: "#a78bfa", bg: "#a78bfa20", hue: "262°", meaning: "실행 중 — 작업 진행 중" },
    { name: "Done",    hex: "#a3e635", bg: "#a3e63518", hue: "82°",  meaning: "완료 — 작업 종료" },
    { name: "Review",  hex: "#f0abfc", bg: "#f0abfc18", hue: "290°", meaning: "검토 대기 — 승인 필요" },
    { name: "Blocked", hex: "#ff6b6b", bg: "#ff6b6b18", hue: "0°",   meaning: "차단 — 오류/중단" },
    { name: "Draft",   hex: "#64748b", bg: "#64748b15", hue: "220°", meaning: "초안 — 미시작" },
  ],

  // ─── Accent/Feedback (기능별, Hue: 190° / 43° / 255°) ───
  accents: [
    { name: "Link",    hex: "#67e8f9", hue: "190°", role: "링크, 클릭 가능 요소" },
    { name: "Success", hex: "#a3e635", hue: "82°",  role: "성공, 연결됨 (= Done)" },
    { name: "Warning", hex: "#fbbf24", hue: "43°",  role: "경고, 주의 필요" },
    { name: "Error",   hex: "#ff6b6b", hue: "0°",   role: "에러, 장애 (= Blocked)" },
    { name: "Info",    hex: "#c4b5fd", hue: "255°", role: "정보성 알림" },
  ],
};

// ─── Hue Map Visualization ─────────────────────────────────────
const hueMap = [
  { deg: 0,   label: "Blocked/Error", hex: "#ff6b6b", category: "status" },
  { deg: 20,  label: "Odin", hex: "#d97757", category: "agent" },
  { deg: 43,  label: "Warning", hex: "#fbbf24", category: "accent" },
  { deg: 82,  label: "Done/Success", hex: "#a3e635", category: "status" },
  { deg: 160, label: "Brokkr", hex: "#10a37f", category: "agent" },
  { deg: 190, label: "Link", hex: "#67e8f9", category: "accent" },
  { deg: 210, label: "Idle", hex: "#94a3b8", category: "status" },
  { deg: 217, label: "Heimdall", hex: "#4285f4", category: "agent" },
  { deg: 255, label: "Info", hex: "#c4b5fd", category: "accent" },
  { deg: 262, label: "Running", hex: "#a78bfa", category: "status" },
  { deg: 290, label: "Review", hex: "#f0abfc", category: "status" },
];

function ColorSwatch({ hex, size = "md" }: { hex: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" };
  return (
    <div
      className={`${sizes[size]} rounded-lg border border-white/10 shrink-0`}
      style={{ backgroundColor: hex }}
    />
  );
}

function GradientSwatch({ colors }: { colors: string[] }) {
  return (
    <div
      className="w-24 h-8 rounded-lg border border-white/10"
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    />
  );
}

const categoryColors: Record<string, string> = {
  agent: "border-slate-400",
  status: "border-violet-400",
  accent: "border-amber-400",
};

const categoryLabels: Record<string, string> = {
  agent: "Agent",
  status: "Status",
  accent: "Accent",
};

export default function StyleGuidePage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8">
      <div className="max-w-[1200px] mx-auto space-y-12">
        {/* Header */}
        <div className="border-b border-slate-700/50 pb-6">
          <h1 className="text-3xl font-bold text-slate-100">Yggdrasil Color System v2</h1>
          <p className="text-slate-400 mt-2 text-sm">
            3개 카테고리 (Agent / Status / Accent) 간 Hue 충돌 0% — 클릭하면 HEX 복사
          </p>
          <a href="/" className="text-[#67e8f9] hover:underline text-sm mt-2 inline-block">
            ← Dashboard로 돌아가기
          </a>
        </div>

        {/* ─── 0. Hue Distribution Map ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Hue Distribution (색상환 배치)</h2>
          <p className="text-xs text-slate-500 mb-4">모든 색상이 색상환에서 최소 20° 이상 간격을 유지합니다.</p>

          {/* Linear hue bar */}
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/30 p-6">
            <div className="relative h-16 mb-2">
              {/* Hue gradient bar */}
              <div
                className="absolute inset-x-0 top-6 h-3 rounded-full opacity-30"
                style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
              />
              {/* Color markers */}
              {hueMap.map((item) => (
                <div
                  key={item.label}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${(item.deg / 360) * 100}%`, transform: "translateX(-50%)" }}
                >
                  <span className={`text-[9px] font-medium whitespace-nowrap px-1 py-0.5 rounded border ${categoryColors[item.category]} bg-[#0f172a]`}
                    style={{ color: item.hex }}
                  >
                    {item.label}
                  </span>
                  <div className="w-0.5 h-3 mt-0.5" style={{ backgroundColor: item.hex }} />
                  <div className="w-3 h-3 rounded-full border-2 border-[#0f172a]" style={{ backgroundColor: item.hex }} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-6 justify-center text-[10px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded border border-slate-400" /> Agent</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded border border-violet-400" /> Status</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded border border-amber-400" /> Accent</span>
            </div>
          </div>
        </section>

        {/* ─── 1. Backgrounds ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Backgrounds</h2>
          <p className="text-xs text-slate-500 mb-4">5단계 깊이 레이어. 무채색이므로 다른 카테고리와 충돌 없음.</p>
          <div className="grid gap-2">
            {colorSystem.backgrounds.map((c) => (
              <div
                key={c.name}
                onClick={() => copyHex(c.hex)}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/30 cursor-pointer transition-colors"
              >
                <div className="w-12 h-8 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: c.hex }} />
                <span className="font-mono text-xs w-28 text-slate-300">{c.name}</span>
                <span className="font-mono text-xs w-20 text-slate-500">{c.hex}</span>
                <span className="text-xs text-slate-400 flex-1">{c.role}</span>
                {copied === c.hex && <span className="text-xs text-[#a3e635]">Copied!</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── 2. Text Hierarchy ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Text Hierarchy</h2>
          <p className="text-xs text-slate-500 mb-4">5단계 밝기. 무채색 기반으로 어떤 배경에도 충돌 없음.</p>
          <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/30 space-y-1">
            {colorSystem.texts.map((t) => (
              <div
                key={t.name}
                onClick={() => copyHex(t.hex)}
                className="flex items-center gap-4 py-2 cursor-pointer group rounded px-2 hover:bg-slate-800/30"
              >
                <span className="font-mono text-xs w-28 text-slate-500 group-hover:text-slate-400">{t.name}</span>
                <span className="font-mono text-xs w-20 text-slate-600">{t.hex}</span>
                <span className="text-base font-medium flex-1" style={{ color: t.hex }}>{t.role}</span>
                {copied === t.hex && <span className="text-xs text-[#a3e635]">Copied!</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── 3. Agent Identity ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Agent Identity</h2>
          <p className="text-xs text-slate-500 mb-4">
            모델 브랜드 색상 기반. Hue 20° / 160° / 217° — Status·Accent와 최소 30° 이상 간격.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {colorSystem.agents.map((a) => (
              <div key={a.name} className="bg-[#1e293b] rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="h-2" style={{ background: `linear-gradient(90deg, ${a.gradient[0]}, ${a.gradient[1]})` }} />
                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold" style={{ color: a.primary }}>{a.name}</h3>
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{a.brand}</span>
                      <span className="text-[10px] font-mono text-slate-700">Hue {a.hue}</span>
                    </div>
                    <p className="text-xs text-slate-500">{a.role}</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Primary", hex: a.primary },
                      { label: "Light", hex: a.light },
                      { label: "Muted (bg)", hex: a.muted },
                    ].map((v) => (
                      <div key={v.label} onClick={() => copyHex(v.hex)} className="flex items-center gap-3 cursor-pointer group">
                        <ColorSwatch hex={v.hex} size="sm" />
                        <span className="text-xs text-slate-400 w-16">{v.label}</span>
                        <span className="text-xs font-mono text-slate-600">{v.hex}</span>
                        {copied === v.hex && <span className="text-xs text-[#a3e635]">Copied!</span>}
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <GradientSwatch colors={a.gradient} />
                      <span className="text-xs text-slate-400">Gradient</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 4. Status ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Status</h2>
          <p className="text-xs text-slate-500 mb-4">
            작업 상태. Hue 0° / 82° / 210° / 220° / 262° / 290° — Agent 색상과 완전 분리.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {colorSystem.statuses.map((s) => (
              <div
                key={s.name}
                onClick={() => copyHex(s.hex)}
                className="bg-[#1e293b] rounded-xl border border-slate-700/30 p-4 text-center cursor-pointer hover:border-slate-600 transition-colors"
              >
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.hex }} />
                  </div>
                </div>
                <div className="text-sm font-semibold" style={{ color: s.hex }}>{s.name}</div>
                <div className="font-mono text-[10px] text-slate-600 mt-0.5">{s.hex}</div>
                <div className="text-[10px] text-slate-700 font-mono mt-0.5">Hue {s.hue}</div>
                <div className="text-[11px] text-slate-500 mt-1.5">{s.meaning}</div>
                {copied === s.hex && <div className="text-xs text-[#a3e635] mt-1">Copied!</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── 5. Accent ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Accent &amp; Feedback</h2>
          <p className="text-xs text-slate-500 mb-4">
            UI 피드백. Success=Done, Error=Blocked과 의도적으로 동일 (의미적 일관성).
          </p>
          <div className="flex flex-wrap gap-3">
            {colorSystem.accents.map((a) => (
              <div
                key={a.name}
                onClick={() => copyHex(a.hex)}
                className="flex items-center gap-3 bg-[#1e293b] rounded-xl border border-slate-700/30 px-4 py-3 cursor-pointer hover:border-slate-600 transition-colors"
              >
                <ColorSwatch hex={a.hex} size="sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: a.hex }}>{a.name}</span>
                    <span className="text-[10px] font-mono text-slate-700">Hue {a.hue}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{a.role}</div>
                  <div className="font-mono text-[10px] text-slate-600">{a.hex}</div>
                </div>
                {copied === a.hex && <span className="text-xs text-[#a3e635] ml-2">Copied!</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── 6. Collision Matrix ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Collision Check</h2>
          <p className="text-xs text-slate-500 mb-4">카테고리 간 최소 Hue 간격 확인. 20° 미만이면 충돌 위험.</p>

          <div className="bg-[#1e293b] rounded-xl border border-slate-700/30 p-5 overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left py-2 pr-4 font-medium">A</th>
                  <th className="text-left py-2 pr-4 font-medium">B</th>
                  <th className="text-left py-2 pr-4 font-medium">Hue Gap</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { a: "Odin (20°)", b: "Warning (43°)", gap: 23, ca: "#d97757", cb: "#fbbf24" },
                  { a: "Odin (20°)", b: "Blocked (0°)", gap: 20, ca: "#d97757", cb: "#ff6b6b" },
                  { a: "Brokkr (160°)", b: "Link (190°)", gap: 30, ca: "#10a37f", cb: "#67e8f9" },
                  { a: "Brokkr (160°)", b: "Done (82°)", gap: 78, ca: "#10a37f", cb: "#a3e635" },
                  { a: "Heimdall (217°)", b: "Idle (210°)", gap: 7, ca: "#4285f4", cb: "#94a3b8" },
                  { a: "Heimdall (217°)", b: "Running (262°)", gap: 45, ca: "#4285f4", cb: "#a78bfa" },
                  { a: "Running (262°)", b: "Review (290°)", gap: 28, ca: "#a78bfa", cb: "#f0abfc" },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-slate-700/30">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.ca }} />
                        {row.a}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.cb }} />
                        {row.b}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">{row.gap}°</td>
                    <td className="py-2">
                      {row.gap >= 20 ? (
                        <span className="text-[#a3e635]">Safe</span>
                      ) : (
                        <span className="text-[#fbbf24]">Near — 채도/밝기로 구분</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-600 mt-3">
              * Heimdall(217°)과 Idle(210°)은 Hue 7° 차이이나, Idle은 무채색(회색)이므로 채도 차이로 명확히 구분됨.
            </p>
          </div>
        </section>

        {/* ─── 7. Combined Preview ─── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Combined Preview</h2>
          <p className="text-xs text-slate-500 mb-4">실제 대시보드 조합 미리보기.</p>

          <div className="bg-[#0f172a] rounded-xl border border-slate-700/30 overflow-hidden">
            {/* Mock header */}
            <div className="bg-[#1e293b] border-b border-slate-700/40 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-emerald-700" />
                <span className="text-sm font-bold text-slate-100">Yggdrasil</span>
                <span className="text-[10px] bg-[#334155] text-slate-400 px-1.5 py-0.5 rounded">Asgard</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#a3e635]" />
                <span className="text-xs text-[#a3e635]">Live</span>
              </div>
            </div>

            {/* Mock agent cards */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {colorSystem.agents.map((a, i) => {
                const statuses = ["running", "idle", "done"];
                const statusColors = ["#a78bfa", "#94a3b8", "#a3e635"];
                const statusLabels = ["Running", "Idle", "Done"];
                return (
                  <div key={a.name} className="bg-[#1e293b] rounded-lg border border-slate-700/30 overflow-hidden">
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${a.gradient[0]}, ${a.gradient[1]})` }} />
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: a.primary }}>{a.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColors[i] + "20", color: statusColors[i] }}>
                          {statusLabels[i]}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{a.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mock chronicle */}
            <div className="px-4">
              <div className="bg-[#1e293b] rounded-lg border border-slate-700/30 p-3 space-y-1.5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Chronicle</div>
                {[
                  { id: "TP-001", status: "Done", sColor: "#a3e635", agent: "Odin", aColor: "#d97757" },
                  { id: "TP-003", status: "Running", sColor: "#a78bfa", agent: "Brokkr", aColor: "#10a37f" },
                  { id: "TP-004", status: "Review", sColor: "#f0abfc", agent: "Heimdall", aColor: "#4285f4" },
                  { id: "TP-005", status: "Blocked", sColor: "#ff6b6b", agent: "Brokkr", aColor: "#10a37f" },
                  { id: "TP-006", status: "Draft", sColor: "#64748b", agent: "Odin", aColor: "#d97757" },
                ].map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded hover:bg-slate-800/30">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.sColor }} />
                    <span className="font-mono text-[#67e8f9] w-14">{t.id}</span>
                    <span className="flex-1 text-slate-300">Task description here</span>
                    <span className="w-16" style={{ color: t.aColor }}>{t.agent}</span>
                    <span className="w-14 text-right" style={{ color: t.sColor }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock terminal */}
            <div className="p-4">
              <div className="bg-[#060910] rounded-lg border border-slate-700/30 p-3">
                <div className="font-mono text-xs space-y-1">
                  <div><span className="text-slate-600">09:41:22</span> <span className="text-[#d97757]">ODIN</span> <span className="text-slate-300">TP-003 분석 시작</span></div>
                  <div><span className="text-slate-600">09:41:25</span> <span className="text-[#10a37f]">BROKKR</span> <span className="text-slate-300">src/auth/jwt.ts 생성 중...</span></div>
                  <div><span className="text-slate-600">09:41:28</span> <span className="text-[#4285f4]">HEIMDALL</span> <span className="text-slate-300">스크린샷 분석 완료</span></div>
                  <div className="bg-[#fbbf2408]"><span className="text-slate-600">09:41:30</span> <span className="text-[#10a37f]">BROKKR</span> <span className="text-[#fbbf24]">WRN OAuth callback URL 미설정</span></div>
                  <div className="bg-[#ff6b6b08]"><span className="text-slate-600">09:41:33</span> <span className="text-[#10a37f]">BROKKR</span> <span className="text-[#ff6b6b]">ERR connection timeout</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-700/30 pt-4 pb-8 text-center">
          <span className="text-xs text-slate-600">Yggdrasil Design System v2.0 — Zero Collision Color Tokens</span>
        </div>
      </div>
    </div>
  );
}
