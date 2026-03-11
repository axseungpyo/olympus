export interface SkillDefinition {
  patterns: RegExp[];
  skill: string;
  extractArgs?: (message: string) => string;
  description: string;
  requiresApproval: boolean;
}

export interface SkillMatch {
  skill: string;
  args: string;
  description: string;
  requiresApproval: boolean;
}

export const SKILL_PATTERNS: SkillDefinition[] = [
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
