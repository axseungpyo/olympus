import fs from "fs/promises";
import path from "path";
import type { OdinAction, OdinMessage } from "../../../shared/types";
import { createLogger } from "../../infra/logger";

const log = createLogger({ component: "OdinChannel" });

// ── Skill Mapping ──

interface SkillMatch {
  skill: string;
  args: string;
  description: string;
  requiresApproval: boolean;
}

const SKILL_PATTERNS: {
  patterns: RegExp[];
  skill: string;
  extractArgs?: (match: string) => string;
  description: string;
  requiresApproval: boolean;
}[] = [
  {
    patterns: [/상태/, /status/, /현황/, /어디까지/],
    skill: "status",
    description: "프로젝트 현황을 확인합니다.",
    requiresApproval: false,
  },
  {
    patterns: [/검증/, /validate/, /포맷\s*체크/],
    skill: "validate",
    extractArgs: (msg) => {
      const match = msg.match(/TP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "Rune(TP) 포맷을 검증합니다.",
    requiresApproval: false,
  },
  {
    patterns: [/위임/, /delegate/, /실행해/, /시작해/, /Brokkr/i, /코딩/],
    skill: "delegate",
    extractArgs: (msg) => {
      const match = msg.match(/TP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "Brokkr에게 태스크를 위임합니다.",
    requiresApproval: true,
  },
  {
    patterns: [/Heimdall/i, /gemini/i, /이미지\s*분석/, /비전/, /리서치/],
    skill: "delegate-gemini",
    extractArgs: (msg) => {
      const match = msg.match(/TP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "Heimdall에게 비전 태스크를 위임합니다.",
    requiresApproval: true,
  },
  {
    patterns: [/검토/, /review/, /RP/],
    skill: "review",
    extractArgs: (msg) => {
      const match = msg.match(/RP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "Saga(RP)를 검토합니다.",
    requiresApproval: true,
  },
  {
    patterns: [/기획/, /plan/, /태스크\s*만들/, /TP\s*작성/],
    skill: "plan",
    extractArgs: (msg) => msg.replace(/^.*?(기획|plan)\s*/i, "").trim(),
    description: "새 Rune(TP)을 생성합니다.",
    requiresApproval: false,
  },
  {
    patterns: [/롤백/, /rollback/, /되돌리/],
    skill: "rollback",
    extractArgs: (msg) => {
      const match = msg.match(/TP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "TP의 변경사항을 롤백합니다.",
    requiresApproval: true,
  },
  {
    patterns: [/재시도/, /retry/, /다시\s*실행/],
    skill: "retry",
    extractArgs: (msg) => {
      const match = msg.match(/TP-\d{3}/i);
      return match ? match[0].toUpperCase() : "";
    },
    description: "실패한 TP를 재실행합니다.",
    requiresApproval: true,
  },
  {
    patterns: [/중지/, /stop/, /멈춰/, /kill/, /종료/],
    skill: "stop-agent",
    extractArgs: (msg) => {
      const agentMatch = msg.match(/brokkr|heimdall|loki/i);
      return agentMatch ? agentMatch[0].toLowerCase() : "";
    },
    description: "에이전트를 중지합니다.",
    requiresApproval: true,
  },
];

function matchSkill(message: string): SkillMatch | null {
  for (const entry of SKILL_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(message)) {
        return {
          skill: entry.skill,
          args: entry.extractArgs ? entry.extractArgs(message) : "",
          description: entry.description,
          requiresApproval: entry.requiresApproval,
        };
      }
    }
  }
  return null;
}

// ── Message Store ──

let messageHistory: OdinMessage[] = [];
let pendingApprovals = new Map<string, { skill: string; args: string }>();

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getMessages(limit = 50): OdinMessage[] {
  return messageHistory.slice(-limit);
}

export function addMessage(msg: Omit<OdinMessage, "id" | "timestamp">): OdinMessage {
  const full: OdinMessage = {
    ...msg,
    id: generateId(),
    timestamp: Date.now(),
  };
  messageHistory.push(full);
  // Keep last 200 messages in memory
  if (messageHistory.length > 200) {
    messageHistory = messageHistory.slice(-200);
  }
  return full;
}

// ── Process Command ──

export interface CommandResult {
  messages: OdinMessage[];
}

export async function processCommand(
  content: string,
  asgardRoot: string,
): Promise<CommandResult> {
  const messages: OdinMessage[] = [];

  // Record user message
  const userMsg = addMessage({
    role: "user",
    type: "command",
    content,
  });
  messages.push(userMsg);

  // Try to match a skill
  const skillMatch = matchSkill(content);

  if (!skillMatch) {
    // No skill matched — Odin acknowledges and gives guidance
    const response = addMessage({
      role: "odin",
      type: "response",
      content: `명령을 이해했습니다. 다음 작업을 수행할 수 있습니다:\n\n` +
        `• **상태 확인** — "상태" 또는 "status"\n` +
        `• **TP 검증** — "TP-016 검증"\n` +
        `• **위임** — "TP-016 Brokkr에게 위임"\n` +
        `• **검토** — "RP-016 검토"\n` +
        `• **기획** — "로그인 기능 기획"\n` +
        `• **롤백** — "TP-016 롤백"\n` +
        `• **재시도** — "TP-016 재시도"`,
    });
    messages.push(response);
    return { messages };
  }

  if (skillMatch.requiresApproval) {
    // Send approval request
    const approvalId = generateId();
    pendingApprovals.set(approvalId, {
      skill: skillMatch.skill,
      args: skillMatch.args,
    });

    const response = addMessage({
      role: "odin",
      type: "approval_request",
      content: `**${skillMatch.description}**\n\n` +
        `Skill: \`/${skillMatch.skill}${skillMatch.args ? ` ${skillMatch.args}` : ""}\`\n` +
        (skillMatch.args ? `Target: ${skillMatch.args}` : "인자 없음"),
      actions: [
        { id: approvalId, label: "Approve", type: "approve" },
        { id: `${approvalId}-reject`, label: "Cancel", type: "reject" },
      ],
      metadata: {
        skill: skillMatch.skill,
        tp: skillMatch.args || undefined,
      },
    });
    messages.push(response);
  } else {
    // Execute directly (safe skills like status, validate)
    const progressMsg = addMessage({
      role: "odin",
      type: "progress",
      content: `\`/${skillMatch.skill}${skillMatch.args ? ` ${skillMatch.args}` : ""}\` 실행 중...`,
      metadata: { skill: skillMatch.skill },
    });
    messages.push(progressMsg);

    try {
      const result = await executeSkill(skillMatch.skill, skillMatch.args, asgardRoot);
      const resultMsg = addMessage({
        role: "odin",
        type: "response",
        content: result,
        metadata: { skill: skillMatch.skill },
      });
      messages.push(resultMsg);
    } catch (err) {
      const errMsg = addMessage({
        role: "odin",
        type: "response",
        content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
        metadata: { skill: skillMatch.skill, severity: "critical" },
      });
      messages.push(errMsg);
    }
  }

  return { messages };
}

// ── Process Approval ──

export async function processApproval(
  approvalId: string,
  approved: boolean,
  asgardRoot: string,
): Promise<CommandResult> {
  const messages: OdinMessage[] = [];
  const pending = pendingApprovals.get(approvalId);

  if (!pending) {
    const msg = addMessage({
      role: "odin",
      type: "response",
      content: "승인 요청을 찾을 수 없습니다. 이미 처리되었거나 만료되었습니다.",
    });
    messages.push(msg);
    return { messages };
  }

  pendingApprovals.delete(approvalId);

  if (!approved) {
    const msg = addMessage({
      role: "user",
      type: "command",
      content: "Cancel",
    });
    messages.push(msg);

    const response = addMessage({
      role: "odin",
      type: "response",
      content: `\`/${pending.skill}\` 실행이 취소되었습니다.`,
    });
    messages.push(response);
    return { messages };
  }

  // User approved
  const userMsg = addMessage({
    role: "user",
    type: "command",
    content: "Approve",
  });
  messages.push(userMsg);

  const progressMsg = addMessage({
    role: "odin",
    type: "progress",
    content: `\`/${pending.skill}${pending.args ? ` ${pending.args}` : ""}\` 실행 중...`,
    metadata: { skill: pending.skill },
  });
  messages.push(progressMsg);

  try {
    const result = await executeSkill(pending.skill, pending.args, asgardRoot);
    const resultMsg = addMessage({
      role: "odin",
      type: "response",
      content: result,
      metadata: { skill: pending.skill },
    });
    messages.push(resultMsg);
  } catch (err) {
    const errMsg = addMessage({
      role: "odin",
      type: "response",
      content: `실행 실패: ${err instanceof Error ? err.message : "Unknown error"}`,
      metadata: { skill: pending.skill, severity: "critical" },
    });
    messages.push(errMsg);
  }

  return { messages };
}

// ── Skill Execution ──

async function executeSkill(skill: string, args: string, asgardRoot: string): Promise<string> {
  const artifactsDir = path.join(asgardRoot, "artifacts");

  if (skill === "status") {
    const indexContent = await fs.readFile(path.join(artifactsDir, "INDEX.md"), "utf-8").catch(() => "");
    const { parseIndex } = await import("../tasks/task-parser");
    const { getAgentStates } = await import("../agents/agent-state");
    const tasks = parseIndex(indexContent);
    const agents = await getAgentStates(asgardRoot, tasks);

    const active = tasks.filter(t => t.status === "in-progress" || t.status === "draft");
    const done = tasks.filter(t => t.status === "done");
    const blocked = tasks.filter(t => t.status === "blocked");
    const running = agents.filter(a => a.status === "running");

    let result = `**프로젝트 현황**\n\n`;
    result += `태스크: ${tasks.length}개 (활성 ${active.length}, 완료 ${done.length}, 차단 ${blocked.length})\n`;
    result += `에이전트: ${running.length > 0 ? running.map(a => `${a.displayName} [${a.status}]`).join(", ") : "전원 대기 중"}\n`;

    if (active.length > 0) {
      result += `\n**활성 태스크:**\n`;
      for (const t of active) {
        result += `• ${t.id}: ${t.title} (${t.status})\n`;
      }
    }
    return result;
  }

  if (skill === "validate") {
    const handoffDir = path.join(artifactsDir, "handoff");
    const target = args || "전체";

    try {
      const entries = await fs.readdir(handoffDir);
      const tpFiles = entries.filter(e => /^TP-\d{3}\.md$/.test(e));

      if (args) {
        const file = `${args}.md`;
        if (!tpFiles.includes(file)) return `${args}를 찾을 수 없습니다.`;
        const content = await fs.readFile(path.join(handoffDir, file), "utf-8");
        const hasTitle = /^#\s+TP-\d{3}:/m.test(content);
        const hasObjective = /^##\s+Objective\b/m.test(content);
        const hasAC = /^##\s+Acceptance Criteria\b/m.test(content);
        const valid = hasTitle && hasObjective && hasAC;
        return `**${args} 검증 결과: ${valid ? "PASS" : "FAIL"}**\n\n` +
          `• Title: ${hasTitle ? "✓" : "✗"}\n` +
          `• Objective: ${hasObjective ? "✓" : "✗"}\n` +
          `• Acceptance Criteria: ${hasAC ? "✓" : "✗"}`;
      }

      return `**${target} TP 검증:** ${tpFiles.length}개 파일 검사 완료`;
    } catch {
      return "handoff 디렉토리를 읽을 수 없습니다.";
    }
  }

  // ── Agent Control Skills (Phase 2) ──

  if (skill === "stop-agent") {
    if (!args) return "에이전트 이름이 필요합니다. 예: `Brokkr 중지`";
    const { stopAgent } = await import("../agents/agent-control");
    const agentName = args.toLowerCase() as "brokkr" | "heimdall" | "loki";
    const result = await stopAgent(asgardRoot, agentName);
    return result.success
      ? `**${agentName} 중지됨**\n\n${result.message}`
      : `중지 실패: ${result.message}`;
  }

  if (skill === "delegate") {
    if (!args) return "TP ID가 필요합니다. 예: `TP-016 위임`";
    const { startAgent } = await import("../agents/agent-control");
    const result = await startAgent(asgardRoot, "brokkr", { tp: args });
    if (result.success) {
      return `**Brokkr 시작됨**\n\n` +
        `• Task: ${args}\n` +
        `• Mode: ${result.mode}\n` +
        (result.pid ? `• PID: ${result.pid}` : "");
    }
    return `Brokkr 시작 실패: ${result.message}`;
  }

  if (skill === "delegate-gemini") {
    if (!args) return "TP ID가 필요합니다. 예: `TP-016 Heimdall 위임`";
    const { startAgent } = await import("../agents/agent-control");
    const result = await startAgent(asgardRoot, "heimdall", { tp: args });
    if (result.success) {
      return `**Heimdall 시작됨**\n\n` +
        `• Task: ${args}\n` +
        `• Mode: ${result.mode}\n` +
        (result.pid ? `• PID: ${result.pid}` : "");
    }
    return `Heimdall 시작 실패: ${result.message}`;
  }

  // For skills not yet implemented (review, rollback, retry)
  return `\`/${skill}${args ? ` ${args}` : ""}\` — 이 Skill은 Phase 3 (Task Management)에서 대시보드 실행이 지원됩니다.\n현재는 CLI에서 \`/${skill} ${args}\`를 실행해주세요.`;
}

// ── Persistence ──

export async function loadHistory(asgardRoot: string): Promise<void> {
  const chatPath = path.join(asgardRoot, "artifacts", "logs", "odin-chat.jsonl");
  try {
    const content = await fs.readFile(chatPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    messageHistory = lines.map(line => JSON.parse(line) as OdinMessage);
    log.info({ count: messageHistory.length }, "Loaded chat history");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err }, "Failed to load chat history");
    }
  }
}

export async function saveHistory(asgardRoot: string): Promise<void> {
  const chatPath = path.join(asgardRoot, "artifacts", "logs", "odin-chat.jsonl");
  try {
    const content = messageHistory.map(m => JSON.stringify(m)).join("\n") + "\n";
    await fs.writeFile(chatPath, content, "utf-8");
  } catch (err) {
    log.error({ err }, "Failed to save chat history");
  }
}
