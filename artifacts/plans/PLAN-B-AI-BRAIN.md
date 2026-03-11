# Plan B: AI Brain — Claude 중심 에이전트 오케스트레이션

> Claude(Odin)를 **실제 AI 두뇌**로 연결하여, 대시보드에서 자연어 한 마디로
> Codex CLI와 Gemini CLI를 자율적으로 오케스트레이션하는 시스템을 구축한다.
>
> **Track**: Plan B (AI 두뇌) — [Plan A (대시보드 기능)](./PLAN-A-CONTROL-PANEL.md)와 병렬 진행

**작성일**: 2026-03-11 (Updated: 2026-03-12 — Clean Architecture 기반 재설계)
**기반 버전**: v0.5.4 (Plan C 완료)
**목표 버전**: v1.0.0

---

## 0. Clean Architecture 재설계 (2026-03-12 추가)

### 0.1 현재 구조의 문제점

Plan C에서 domain/infra/routes/websocket 분리를 완료했으나, 핵심적인 Clean Architecture 원칙이 미적용:

1. **domain/ 내부에서 직접 fs 사용** → Repository 인터페이스 없음
2. **routes가 domain을 직접 import** → Use Case 레이어 없음
3. **odin-channel이 모든 책임을 보유** → Skill 매칭 + 승인 + 실행 + 영속화 혼재
4. **DI 미적용** → 테스트 시 모킹 불가, 구현 교체 불가

### 0.2 목표 구조 (Dependency Rule 준수)

```
src/yggdrasil/server/
├── core/                       ← 순수 도메인 (외부 의존 제로)
│   ├── entities/               ← 도메인 모델
│   ├── ports/                  ← 인터페이스 정의 (Dependency Inversion)
│   ├── use-cases/              ← 애플리케이션 비즈니스 규칙
│   └── events/                 ← 도메인 이벤트
│
├── adapters/                   ← 인터페이스 어댑터
│   ├── repositories/           ← ports/ 구현 (FileSystem)
│   ├── gateways/               ← 외부 시스템 연결 (LLM, Process)
│   └── controllers/            ← HTTP/WS 컨트롤러 (routes/ 대체)
│
├── infra/                      ← 기존 유지 (auth, logger, watcher)
├── websocket/                  ← 기존 유지
├── di/container.ts             ← Simple Factory DI
└── index.ts                    ← 엔트리포인트
```

### 0.3 수정된 Phase 계획 (Clean Architecture 우선)

| Phase | TP | 제목 | 초점 |
|-------|-----|------|------|
| B0-1 | TP-020 | Core Domain + Repository Pattern | Entities, Ports, FileSystem Adapters |
| B0-2 | TP-021 | Use Case Layer + Controller Refactoring | Use Cases, DI Container, 얇은 Controllers |
| B1 | TP-022 | AI Brain — LLM Gateway + Smart Odin | ILLMGateway, Claude API 연동, AI 명령 처리 |
| B2 | TP-023 | Event Bus + Domain Events | IEventBus, Watcher→EventBus, 실시간 동기화 |

> B0 (Clean Architecture Foundation)가 선행되어야 B1~B5의 AI Brain을 깔끔하게 추가할 수 있다.

---

## 1. 비전

### 1.1 최종 목표

```
┌─────────────────────────────── Asgard Dashboard ───────────────────────────────┐
│                                                                                │
│  사용자: "이 프로젝트에 소셜 로그인 추가해줘"                                    │
│                                                                                │
│  Odin(Claude): 코드베이스를 분석했습니다.                                       │
│    1. auth 모듈에 Google/GitHub OAuth 추가 필요                                 │
│    2. DB 스키마에 provider 필드 추가                                            │
│    3. 프론트엔드 로그인 UI 변경                                                 │
│                                                                                │
│    TP-025 작성 완료. Brokkr[Mjolnir]에 위임하겠습니다. [Approve]                 │
│                                                                                │
│  ──────────────────────────────────────────────────────────                     │
│  │ Brokkr [Running] TP-025 ██████████░░░░ 68%              │                   │
│  │ 12개 파일 수정 중... src/auth/social.ts 작성 완료        │                   │
│  ──────────────────────────────────────────────────────────                     │
│                                                                                │
│  Odin: Brokkr가 완료했습니다. RP-025 검토 중...                                 │
│    AC 1/4: ✓ Google OAuth 동작                                                 │
│    AC 2/4: ✓ GitHub OAuth 동작                                                 │
│    AC 3/4: ✗ 에러 핸들링 미흡 → Brokkr에게 수정 지시 중                         │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Plan A와의 차이

| 항목 | Plan A (Control Panel) | Plan B (AI Brain) |
|------|----------------------|-------------------|
| **Odin의 정체** | regex 패턴 매칭 라우터 | 실제 Claude AI가 사고·판단 |
| **명령 처리** | 키워드 → Skill 매핑 | 자연어 이해 → 자율적 계획 수립 |
| **에이전트 호출** | 사용자가 직접 지시 | Claude가 판단하여 자동 호출 |
| **에러 대응** | 사용자에게 보고만 | Claude가 원인 분석 + 재지시 |
| **워크플로우** | 수동 단계별 실행 | 자율적 멀티스텝 파이프라인 |
| **완성 시점** | v0.5.0 | v1.0.0 |

### 1.3 핵심 원칙

1. **Claude = Odin** — 대시보드 뒤에서 실제 Claude Code 세션이 동작한다
2. **OAuth 불필요** — Codex CLI, Gemini CLI는 각자 자체 인증 사용 (API key / gcloud auth)
3. **자율 + 감독** — Claude가 자율적으로 계획·실행하되, 중요 결정은 사용자에게 확인
4. **cowork 경험** — 마치 동료 개발자에게 말하듯 자연어로 소통
5. **점진적 자율성** — Level 1(수동) → Level 2(반자율) → Level 3(완전 자율)

---

## 2. 아키텍처

### 2.1 현재 구조의 한계

```
현재:
  Dashboard → REST API → odin-channel.ts (regex router) → shell script → CLI
                          ↑
                          단순 키워드 매칭 — AI 사고 없음
```

### 2.2 목표 구조

```
목표:
  Dashboard → WebSocket → Brain Orchestrator → Claude Code Session
                                                  │
                                          ┌───────┼───────┐
                                          ▼       ▼       ▼
                                       codex   gemini   imagen
                                       (CLI)   (CLI)    (API)
                                          │       │       │
                                          └───────┼───────┘
                                                  ▼
                                          파일 시스템 (Rune/Saga)
                                                  ▼
                                          Dashboard 실시간 반영
```

### 2.3 핵심 컴포넌트

```
src/yggdrasil/server/
├── brain/
│   ├── orchestrator.ts      # 메인 오케스트레이터
│   ├── claude-session.ts    # Claude Code 세션 관리
│   ├── agent-runner.ts      # CLI 에이전트 실행기
│   ├── planner.ts           # 태스크 분해 + 계획 수립
│   └── reviewer.ts          # 자동 RP 검토
```

---

## 3. Phase 별 구현 계획

### Phase B1: Claude Session Bridge (v0.6.0)

> 대시보드 명령을 **실제 Claude Code 세션**에 전달하고 응답을 받는다.

#### 핵심 질문: Claude를 어떻게 연결하는가?

**Option 1: Claude API (Anthropic SDK) 직접 호출**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  system: ODIN_SYSTEM_PROMPT,  // CLAUDE.md + 프로젝트 컨텍스트
  messages: conversationHistory,
  tools: [
    { name: "read_file", ... },
    { name: "write_file", ... },
    { name: "execute_command", ... },
    { name: "delegate_agent", ... },
  ],
});
```

- 장점: 완전한 제어, Tool Use로 파일/CLI 조작 가능
- 단점: API 비용, 컨텍스트 윈도우 관리 필요
- **필요**: Anthropic API Key

**Option 2: Claude Code CLI를 subprocess로 실행**
```typescript
import { spawn } from "child_process";

const claude = spawn("claude", [
  "--print",
  "--model", "sonnet",
  "-p", userCommand,
]);
```

- 장점: Claude Code의 모든 기능 사용 가능 (Skills, MCP, Agent 등)
- 단점: 세션 관리 복잡, 출력 파싱 필요
- **필요**: Claude Code CLI 설치됨

**Option 3: Claude Agent SDK**
```typescript
import { Agent } from "claude-agent-sdk";

const odin = new Agent({
  model: "claude-sonnet-4-6",
  tools: [...],
  system: ODIN_SYSTEM_PROMPT,
});

const result = await odin.run(userCommand);
```

- 장점: 에이전트 패턴에 최적화, 멀티턴 자동 관리
- 단점: SDK 의존성
- **필요**: Anthropic API Key

#### 권장: Option 1 (API 직접 호출) + Option 2 (CLI fallback)

- 기본: Anthropic API로 Claude 호출 (빠르고 제어 용이)
- CLI 실행이 필요한 경우 (delegate 등): subprocess로 처리
- API Key는 Settings에서 이미 관리 중 (`anthropic-api-key`)

#### 구현

```typescript
// server/brain/claude-session.ts

interface ClaudeSession {
  id: string;
  conversationHistory: Message[];
  systemPrompt: string;
  projectContext: string;
}

class OdinBrain {
  private client: Anthropic;
  private session: ClaudeSession;

  async think(userMessage: string): Promise<OdinResponse> {
    // 1. 프로젝트 컨텍스트 로드 (INDEX.md, context.md)
    // 2. Claude API 호출 (Tool Use 포함)
    // 3. Tool 실행 결과 반영
    // 4. 최종 응답 반환
  }

  async delegateToAgent(agent: "codex" | "gemini", tp: string): Promise<void> {
    // CLI subprocess 실행
  }
}
```

#### 서버 API 변경

```
POST /api/odin/command  →  odin-channel.ts (regex)
                        →  brain/orchestrator.ts (Claude AI)  ← 새로운 경로
```

- 설정에 따라 regex 모드 / AI 모드 전환 가능
- AI 모드는 Anthropic API Key가 있을 때만 활성화

#### 파일 목록

```
src/yggdrasil/server/brain/orchestrator.ts    (신규)
src/yggdrasil/server/brain/claude-session.ts  (신규)
src/yggdrasil/server/odin-channel.ts          (수정 — AI 모드 분기)
src/yggdrasil/server/routes.ts                (수정)
```

---

### Phase B2: Tool Use — 파일 & CLI 조작 (v0.7.0)

> Claude가 **직접 파일을 읽고 쓰고, CLI를 실행**할 수 있게 한다.

#### Claude Tool 정의

```typescript
const ODIN_TOOLS = [
  // 파일 시스템
  {
    name: "read_file",
    description: "프로젝트 파일을 읽는다",
    input_schema: { path: "string" },
  },
  {
    name: "write_file",
    description: "파일을 생성하거나 수정한다",
    input_schema: { path: "string", content: "string" },
  },
  {
    name: "list_directory",
    description: "디렉토리 내용을 나열한다",
    input_schema: { path: "string" },
  },

  // 에이전트 제어
  {
    name: "create_rune",
    description: "Rune(TP-NNN.md)을 생성하고 INDEX.md에 등록한다",
    input_schema: { title: "string", objective: "string", agent: "codex|gemini", ... },
  },
  {
    name: "delegate_to_brokkr",
    description: "Brokkr(Codex CLI)에게 TP를 위임한다. delegate-codex.sh를 실행",
    input_schema: { tp_id: "string", mode: "string" },
  },
  {
    name: "delegate_to_heimdall",
    description: "Heimdall(Gemini CLI)에게 TP를 위임한다. delegate-gemini.sh를 실행",
    input_schema: { tp_id: "string" },
  },
  {
    name: "review_saga",
    description: "Saga(RP)를 읽고 Acceptance Criteria를 검증한다",
    input_schema: { rp_id: "string" },
  },

  // 정보 조회
  {
    name: "get_project_status",
    description: "INDEX.md를 파싱하여 프로젝트 현황을 반환한다",
    input_schema: {},
  },
  {
    name: "search_codebase",
    description: "코드베이스에서 패턴을 검색한다",
    input_schema: { pattern: "string", path?: "string" },
  },

  // 사용자 소통
  {
    name: "ask_user",
    description: "사용자에게 질문하거나 승인을 요청한다",
    input_schema: { question: "string", actions?: "Action[]" },
  },
];
```

#### Tool 실행 안전장치

```typescript
// server/brain/tool-executor.ts

const DANGEROUS_TOOLS = new Set(["delegate_to_brokkr", "delegate_to_heimdall", "write_file"]);

async function executeTool(tool: string, input: unknown): Promise<ToolResult> {
  // 1. 위험한 도구는 사용자 승인 필요
  if (DANGEROUS_TOOLS.has(tool)) {
    const approved = await requestUserApproval(tool, input);
    if (!approved) return { error: "User rejected" };
  }

  // 2. 경로 검증 (프로젝트 디렉토리 밖 접근 차단)
  if (tool === "read_file" || tool === "write_file") {
    validatePath(input.path, ASGARD_ROOT);
  }

  // 3. 실행
  return await toolHandlers[tool](input);
}
```

#### 파일 목록

```
src/yggdrasil/server/brain/tool-executor.ts   (신규)
src/yggdrasil/server/brain/tools/             (신규 디렉토리)
  ├── file-tools.ts                            (read/write/list)
  ├── agent-tools.ts                           (delegate/review)
  ├── query-tools.ts                           (status/search)
  └── user-tools.ts                            (ask_user)
```

---

### Phase B3: 자율 오케스트레이션 (v0.8.0)

> Claude가 **멀티스텝 워크플로우를 자율적으로 실행**한다.

#### 자율 실행 모드

```
Level 1 (Manual):     매 단계마다 사용자 승인
Level 2 (Semi-Auto):  계획 승인 후 실행은 자동, 에러 시 중단
Level 3 (Full-Auto):  계획 수립부터 실행·검토까지 자율 (위험 작업만 승인)
```

#### 워크플로우 엔진

```typescript
// server/brain/planner.ts

interface ExecutionPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedDuration: number;
  autonomyLevel: 1 | 2 | 3;
}

interface PlanStep {
  order: number;
  action: string;           // "create_rune" | "delegate" | "review" | "modify"
  agent?: "codex" | "gemini";
  description: string;
  dependsOn?: number[];
  requiresApproval: boolean;
}

class Planner {
  async createPlan(goal: string, context: ProjectContext): Promise<ExecutionPlan> {
    // Claude가 목표를 분석하고 실행 계획을 수립
    // 1. 코드베이스 분석 (어떤 파일이 관련되는지)
    // 2. 태스크 분해 (몇 개의 TP가 필요한지)
    // 3. 에이전트 할당 (어떤 에이전트가 적합한지)
    // 4. 의존관계 설정 (어떤 순서로 실행할지)
    // 5. 예상 소요시간 추정
  }

  async executePlan(plan: ExecutionPlan): Promise<void> {
    for (const step of plan.steps) {
      if (step.requiresApproval) {
        await askUser(`Step ${step.order}: ${step.description}`);
      }
      await executeStep(step);
      await reportProgress(step);
    }
  }
}
```

#### 에러 복구 루프

```
실행 → 실패 감지 → 원인 분석 → 수정 계획 → 재실행 (최대 3회)
  │                                              │
  └──── 3회 초과 → 사용자에게 보고 + 수동 개입 요청 ──┘
```

#### 대시보드 UI

```
┌─ Execution Plan ─────────────────────────────────┐
│                                                    │
│  Goal: "소셜 로그인 추가"                           │
│  Autonomy: Level 2 (Semi-Auto)                     │
│  Progress: 2/4 steps                               │
│                                                    │
│  ✓ Step 1: 코드베이스 분석 (auth/ 구조 파악)       │
│  ✓ Step 2: TP-025 생성 (OAuth 모듈 구현)           │
│  ▶ Step 3: Brokkr[Mjolnir] 실행 중... 68%         │
│  ○ Step 4: RP-025 자동 검토                        │
│                                                    │
│  [Pause] [Cancel] [Override to Level 3]            │
└────────────────────────────────────────────────────┘
```

---

### Phase B4: 실시간 에이전트 협업 (v0.9.0)

> 여러 에이전트가 **동시에 실행**되며 Claude가 실시간으로 조율한다.

#### 병렬 실행

```
Claude(Odin)
  ├── Brokkr: TP-025 (백엔드 OAuth) ██████░░ 60%
  ├── Heimdall: TP-026 (UI 스크린샷 분석) ████████ 100% ✓
  └── Brokkr 대기: TP-027 (프론트엔드, TP-026 의존)
```

#### 에이전트 간 컨텍스트 공유

```typescript
// Claude가 Heimdall의 결과를 Brokkr의 TP에 자동 반영
const heimdallResult = await waitForAgent("heimdall", "TP-026");
await updateRune("TP-027", {
  implementationNotes: `Heimdall 분석 결과:\n${heimdallResult.digest}`,
});
await delegateAgent("brokkr", "TP-027");
```

#### 실시간 진행 스트리밍

```
/ws/odin 메시지 타입 확장:
  - agent_started: { agent, tp, mode }
  - agent_progress: { agent, tp, percent, currentFile }
  - agent_completed: { agent, tp, rp }
  - agent_error: { agent, tp, error, recovery_plan }
  - plan_progress: { planId, completedSteps, totalSteps }
```

---

### Phase B5: Cowork Experience (v1.0.0)

> **동료 개발자와 협업하는 경험** — 대시보드가 곧 팀 워크스페이스가 된다.

#### 최종 UI 비전

```
┌────────────────────────── Asgard v1.0 ──────────────────────────┐
│                                                                  │
│  ┌─ Team ───────────┐  ┌─ Active Work ───────────────────────┐  │
│  │                   │  │                                     │  │
│  │  ● Odin  [Brain]  │  │  TP-025: OAuth 백엔드              │  │
│  │    Reviewing RP-25│  │  Brokkr [Mjolnir] ██████████ Done  │  │
│  │                   │  │                                     │  │
│  │  ● Brokkr [Code]  │  │  TP-026: UI 분석                   │  │
│  │    Idle           │  │  Heimdall [Bifrost] ████████ Done   │  │
│  │                   │  │                                     │  │
│  │  ● Heimdall [Eye] │  │  TP-027: 프론트엔드 구현           │  │
│  │    Idle           │  │  Brokkr [Anvil] ██████░░░░ 55%     │  │
│  │                   │  │                                     │  │
│  └───────────────────┘  └─────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Odin's Thinking ────────────────────────────────────────┐   │
│  │  RP-025 검토 완료. AC 4/4 PASS.                          │   │
│  │  TP-027이 완료되면 통합 테스트 TP-028을 생성 예정.        │   │
│  │  예상 완료: 15분 후                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Chat ───────────────────────────────────────────────────┐   │
│  │  You: 소셜 로그인 추가해줘                                │   │
│  │  Odin: 3단계로 나눠서 진행하겠습니다.                     │   │
│  │        1. 백엔드 OAuth (Brokkr) ✓                        │   │
│  │        2. UI 분석 (Heimdall) ✓                           │   │
│  │        3. 프론트엔드 (Brokkr) ▶ 55%                      │   │
│  │                                                           │   │
│  │  You: Apple 로그인도 추가할 수 있어?                      │   │
│  │  Odin: 가능합니다. TP-027에 Apple OAuth도 포함시킬까요?  │   │
│  │        [추가] [별도 TP로 분리]                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┬────────┐  │
│  │  메시지 입력...                                   │  Send  │  │
│  └──────────────────────────────────────────────────┴────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### 핵심 경험 요소

1. **대화형 기획** — "~해줘" → Claude가 알아서 분석·계획·실행
2. **실시간 진행 가시성** — 모든 에이전트의 작업 상태가 한 화면에
3. **중간 개입** — 실행 중에도 방향 수정 가능 ("Apple 로그인도 추가해")
4. **자동 검토** — RP를 Claude가 검토하고 문제 있으면 자동 수정 지시
5. **컨텍스트 유지** — 프로젝트 전체 맥락을 Claude가 기억하고 활용

---

## 4. 기술 스택 추가

| 기술 | 용도 | Phase |
|------|------|-------|
| `@anthropic-ai/sdk` | Claude API 호출 | B1 |
| Claude Tool Use | 파일/CLI 조작 | B2 |
| `child_process.spawn` | Codex/Gemini CLI 실행 | B2 |
| EventEmitter / AsyncIterator | 실시간 진행 스트리밍 | B4 |

---

## 5. 인증 모델 — OAuth 불필요

```
┌──────────────────────────────────────────────────┐
│  인증 없이 동작하는 이유                          │
│                                                   │
│  Claude:  Anthropic API Key (Settings에서 관리)   │
│  Codex:   codex CLI 자체 인증 (로컬 세션)         │
│  Gemini:  gemini CLI 자체 인증 (gcloud auth)      │
│  Imagen:  Google AI API Key (Settings에서 관리)   │
│                                                   │
│  → 각 CLI가 자체 인증을 처리하므로                │
│    Asgard 서버가 OAuth를 중계할 필요 없음          │
│  → API Key만 Settings에서 관리하면 충분            │
└──────────────────────────────────────────────────┘
```

---

## 6. 구현 순서 & TP 매핑

| Phase | 버전 | TP | 제목 | 난이도 |
|-------|------|-----|------|--------|
| B1 | v0.6.0 | TP-025 | Claude Session Bridge — Anthropic API 연동 | complex |
| B1 | v0.6.0 | TP-026 | AI/Regex 모드 전환 + Settings 연동 | moderate |
| B2 | v0.7.0 | TP-027 | Tool Use — 파일 읽기/쓰기 + CLI 실행 | complex |
| B2 | v0.7.0 | TP-028 | Tool 안전장치 — 경로 검증, 승인, 로깅 | moderate |
| B3 | v0.8.0 | TP-029 | Planner — 멀티스텝 실행 계획 엔진 | extreme |
| B3 | v0.8.0 | TP-030 | 자율 레벨 UI — Level 1/2/3 설정 | moderate |
| B4 | v0.9.0 | TP-031 | 병렬 에이전트 실행 + 실시간 진행 스트리밍 | extreme |
| B4 | v0.9.0 | TP-032 | 에이전트 간 컨텍스트 공유 | complex |
| B5 | v1.0.0 | TP-033 | Cowork Dashboard — 최종 통합 UI | extreme |

---

## 7. 의존 관계

```
Plan A Phase 1 ✓ (Command Channel)
  │
  ├── Plan A Phase 2~5 (병렬 진행 가능)
  │
  └── Plan B Phase B1 (Claude Session Bridge)
       └─→ B2 (Tool Use)
            └─→ B3 (자율 오케스트레이션)
                 └─→ B4 (실시간 협업)
                      └─→ B5 (Cowork Experience)

Plan A와 Plan B는 병렬 진행 가능:
  - Plan A가 만드는 API/UI를 Plan B가 활용
  - Plan B의 AI가 Plan A의 수동 기능을 자동화
```

---

## 8. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| API 비용 | Claude API 호출 비용 누적 | 모델 선택 (Haiku for 간단 작업, Opus for 전략), 캐싱 |
| 컨텍스트 윈도우 | 대규모 프로젝트에서 컨텍스트 부족 | context.md 압축, 필요한 파일만 선택적 로드 |
| Tool 실행 안전 | 의도치 않은 파일 수정/삭제 | 경로 화이트리스트, git diff 확인 후 커밋, 롤백 메커니즘 |
| CLI 안정성 | Codex/Gemini CLI 크래시 | Watchdog 타임아웃, 재시도 로직, 에러 복구 |
| 복잡도 폭발 | 자율 실행이 예상과 다르게 동작 | 자율 레벨 단계적 해제, 모든 실행 로깅 |

---

## 9. 성공 기준

### v0.6.0 (Phase B1)
- [ ] 대시보드에서 입력한 메시지가 실제 Claude API에 전달됨
- [ ] Claude의 응답이 CommandBar에 실시간 표시됨
- [ ] Settings의 Anthropic API Key로 인증

### v0.8.0 (Phase B3)
- [ ] "로그인 기능 추가해줘" → Claude가 TP 생성 → Brokkr 위임 → RP 검토까지 자동 실행
- [ ] 자율 레벨 2에서 에러 발생 시 자동 복구 (최대 3회)

### v1.0.0 (Phase B5)
- [ ] cowork 스타일의 실시간 협업 대시보드 동작
- [ ] 여러 에이전트가 병렬로 실행되며 Claude가 조율
- [ ] OAuth 없이 Codex CLI + Gemini CLI + Image API 모두 동작

---

## 10. Plan A와의 합류 시점

```
Timeline:
  ──────────────────────────────────────────────────────────
  v0.4.0   v0.5.0      v0.6.0   v0.8.0      v1.0.0
  │        │           │        │            │
  Plan A:  ████████████████                  │
  Phase1✓  Phase2-5                          │
           (대시보드 기능)                    │
                                             │
  Plan B:              ██████████████████████████
                       B1-B2     B3-B4       B5
                       (AI 연동) (자율화)    (통합)
                                             │
                                             ▼
                                      Asgard v1.0
                                   (Cowork Dashboard)
  ──────────────────────────────────────────────────────────

  - Plan A의 API/UI를 Plan B가 그대로 활용
  - Plan B가 완성되면 Plan A의 수동 기능은 AI 자동화로 대체
  - 최종적으로 하나의 대시보드에 합류
```
