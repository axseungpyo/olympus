import fs from "fs/promises";
import path from "path";
import type { IAgentRepository } from "../../core/ports/IAgentRepository";
import type { IProcessGateway } from "../../core/ports/IProcessGateway";
import type { ISkillRegistry } from "../../core/ports/ISkillRegistry";
import type { ITaskRepository } from "../../core/ports/ITaskRepository";
import { SKILL_PATTERNS, type SkillDefinition, type SkillMatch } from "../../core/entities/Skill";
import { startAgent, stopAgent } from "../../domain/agents/agent-control";
import { buildDependencyGraph, detectCycle, getExecutionOrder, parseDependencies, type TPMeta } from "../../infra/dependency";

export class FileSkillRegistry implements ISkillRegistry {
  constructor(
    private readonly asgardRoot: string,
    private readonly taskRepository: ITaskRepository,
    private readonly agentRepository: IAgentRepository,
    private readonly processGateway: IProcessGateway,
  ) {}

  match(message: string): SkillMatch | null {
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

  async execute(skill: string, args: string): Promise<string> {
    if (skill === "status") {
      const { active, completed } = await this.taskRepository.list();
      const agents = await this.agentRepository.getStates(active);
      const blocked = active.filter((task) => task.status === "blocked");
      const running = agents.filter((agent) => agent.status === "running");

      let result = `**프로젝트 현황**\n\n`;
      result += `태스크: ${active.length + completed.length}개 (활성 ${active.length}, 완료 ${completed.length}, 차단 ${blocked.length})\n`;
      result += `에이전트: ${running.length > 0 ? running.map((agent) => `${agent.displayName} [${agent.status}]`).join(", ") : "전원 대기 중"}\n`;
      if (active.length > 0) {
        result += `\n**활성 태스크:**\n`;
        for (const task of active.filter((item) => item.status === "in-progress" || item.status === "draft")) {
          result += `• ${task.id}: ${task.title} (${task.status})\n`;
        }
      }
      return result;
    }

    if (skill === "validate") {
      return this.executeValidate(args);
    }

    if (skill === "stop-agent") {
      if (!args) return "에이전트 이름이 필요합니다. 예: `Brokkr 중지`";
      const agentName = args.toLowerCase() as "brokkr" | "heimdall" | "loki";
      const result = await stopAgent(this.agentRepository, this.processGateway, agentName);
      return result.success
        ? `**${agentName} 중지됨**\n\n${result.message}`
        : `중지 실패: ${result.message}`;
    }

    if (skill === "delegate") {
      if (!args) return "TP ID가 필요합니다. 예: `TP-016 위임`";
      const result = await startAgent(this.taskRepository, this.agentRepository, this.processGateway, "brokkr", { tp: args });
      if (!result.success) {
        return `Brokkr 시작 실패: ${result.message}`;
      }
      return `**Brokkr 시작됨**\n\n• Task: ${args}\n• Mode: ${result.mode}\n${result.pid ? `• PID: ${result.pid}` : ""}`.trim();
    }

    if (skill === "delegate-gemini") {
      if (!args) return "TP ID가 필요합니다. 예: `TP-016 Heimdall 위임`";
      const result = await startAgent(this.taskRepository, this.agentRepository, this.processGateway, "heimdall", { tp: args });
      if (!result.success) {
        return `Heimdall 시작 실패: ${result.message}`;
      }
      return `**Heimdall 시작됨**\n\n• Task: ${args}\n• Mode: ${result.mode}\n${result.pid ? `• PID: ${result.pid}` : ""}`.trim();
    }

    return `\`/${skill}${args ? ` ${args}` : ""}\` — 이 Skill은 Phase 3 (Task Management)에서 대시보드 실행이 지원됩니다.\n현재는 CLI에서 \`/${skill} ${args}\`를 실행해주세요.`;
  }

  listSkills(): SkillDefinition[] {
    return SKILL_PATTERNS;
  }

  private async executeValidate(args: string): Promise<string> {
    const handoffDir = path.join(this.asgardRoot, "artifacts", "handoff");
    const target = args || "전체";
    const normalizedArg = args.trim().toUpperCase();

    try {
      const [entries, indexContent] = await Promise.all([
        fs.readdir(handoffDir),
        fs.readFile(path.join(this.asgardRoot, "artifacts", "INDEX.md"), "utf-8").catch(() => ""),
      ]);
      const tpFiles = entries.filter((entry) => /^TP-\d{3}\.md$/.test(entry));

      if (normalizedArg) {
        const file = `${normalizedArg}.md`;
        if (!tpFiles.includes(file)) return `${normalizedArg}를 찾을 수 없습니다.`;
        const content = await fs.readFile(path.join(handoffDir, file), "utf-8");
        const hasTitle = /^#\s+TP-\d{3}:/m.test(content);
        const hasObjective = /^##\s+Objective\b/m.test(content);
        const hasAC = /^##\s+Acceptance Criteria\b/m.test(content);
        const hasCycle = await this.hasDependencyCycle(indexContent, tpFiles, normalizedArg);
        const valid = hasTitle && hasObjective && hasAC && !hasCycle;
        return `**${normalizedArg} 검증 결과: ${valid ? "PASS" : "FAIL"}**\n\n`
          + `• Title: ${hasTitle ? "✓" : "✗"}\n`
          + `• Objective: ${hasObjective ? "✓" : "✗"}\n`
          + `• Acceptance Criteria: ${hasAC ? "✓" : "✗"}\n`
          + `• Dependency Cycle: ${hasCycle ? "✗" : "✓"}`;
      }

      return `**${target} TP 검증:** ${tpFiles.length}개 파일 검사 완료`;
    } catch {
      return "handoff 디렉토리를 읽을 수 없습니다.";
    }
  }

  private async hasDependencyCycle(indexContent: string, tpFiles: string[], targetId: string): Promise<boolean> {
    const statuses = new Map<string, TPMeta["status"]>();
    const { active, completed } = await this.taskRepository.list();
    for (const task of active) statuses.set(task.id, task.status);
    for (const task of completed) statuses.set(task.id, "done");

    const tpMeta = await Promise.all(
      tpFiles.map(async (file) => {
        const content = await fs.readFile(path.join(this.asgardRoot, "artifacts", "handoff", file), "utf-8");
        const id = file.replace(/\.md$/, "");
        return {
          id,
          dependsOn: parseDependencies(content),
          status: statuses.get(id) ?? "draft",
        } satisfies TPMeta;
      }),
    );

    const graph = buildDependencyGraph(tpMeta);
    const cycle = detectCycle(graph);
    const executionOrder = cycle ? [] : getExecutionOrder(graph);
    void indexContent;
    void executionOrder;
    return cycle?.includes(targetId) ?? false;
  }
}
