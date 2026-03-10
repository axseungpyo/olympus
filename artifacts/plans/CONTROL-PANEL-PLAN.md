# Asgard Control Panel — Master Plan

> Yggdrasil 대시보드를 모니터링 도구에서 **에이전트 오케스트레이션 관제 시스템**으로 확장한다.
> 사용자는 Odin을 통해 시스템을 제어하며, Odin이 Brokkr/Heimdall/Loki를 관리·통제한다.

**작성일**: 2026-03-11
**기반 버전**: v0.3.5
**목표 버전**: v0.5.0

---

## 1. 비전 & 핵심 원칙

### 1.1 제어 모델

```
┌─────────────────────────────────────────────────────┐
│                   Dashboard (UI)                     │
│                                                      │
│  사용자 ←──────→ Odin (Brain Agent)                  │
│                    │                                  │
│           ┌───────┼───────┐                          │
│           ▼       ▼       ▼                          │
│        Brokkr  Heimdall  Loki                        │
│        (Code)  (Vision)  (Image)                     │
│                                                      │
│  ─ Odin이 모든 에이전트를 관리·통제                     │
│  ─ 사용자는 대시보드를 통해 Odin에게 지시               │
│  ─ Odin이 자율적으로 판단하거나 사용자에게 확인 요청     │
└─────────────────────────────────────────────────────┘
```

### 1.2 핵심 원칙

1. **Odin-Centric** — 사용자가 직접 Brokkr/Heimdall/Loki를 제어하지 않는다. Odin을 통해서만 지시한다.
2. **대시보드 = Odin의 인터페이스** — 대시보드는 Odin과 사용자 사이의 양방향 소통 채널이다.
3. **자율 + 승인** — Odin은 자율적으로 판단하되, 중요한 결정은 대시보드를 통해 사용자에게 승인을 요청한다.
4. **파일이 진실** — 제어 명령도 결국 Rune/Saga 파일로 기록된다. 대시보드는 그 파일들의 시각화·조작 도구이다.
5. **점진적 확장** — 각 Phase가 독립적으로 가치를 가지며, 이전 Phase 없이도 동작한다.

---

## 2. 현재 상태 분석 (v0.3.5)

### 2.1 가능한 것

| 영역 | 기능 | 방식 |
|------|------|------|
| 모니터링 | 에이전트 상태 조회 | WebSocket 실시간 |
| 모니터링 | 로그 스트리밍 | WebSocket 실시간 |
| 모니터링 | 태스크 목록/상태 | INDEX.md 파싱 |
| 모니터링 | 의존성 그래프 | DAG 시각화 |
| 모니터링 | 메트릭 차트 | execution.log 파싱 |
| 실행 | status/validate Skill | REST API |
| 설정 | API 키/테마/알림 | localStorage |

### 2.2 불가능한 것 (= 구현 대상)

| 영역 | 기능 | 필요 사항 |
|------|------|----------|
| **제어** | 에이전트 시작/중지 | 서버 API + 프로세스 관리 |
| **제어** | 태스크 할당/위임 | delegate 스크립트 연동 |
| **제어** | 모드 변경 | 에이전트 설정 파일 수정 |
| **소통** | 사용자 ↔ Odin 메시지 | 양방향 WebSocket 채널 |
| **소통** | Odin → 사용자 승인 요청 | 알림 + 응답 시스템 |
| **관리** | MCP 서버 실제 연결 | settings.json 수정 |
| **관리** | Rune(TP) 생성/편집 | 파일 CRUD API |
| **관리** | Saga(RP) 검토/승인 | 리뷰 워크플로우 UI |

---

## 3. Phase 별 구현 계획

### Phase 1: Command Channel (v0.4.0)

> Odin과 사용자 사이의 **양방향 소통 채널**을 구축한다.

#### 목표
사용자가 대시보드에서 Odin에게 자연어로 지시하고, Odin의 응답/질문을 받는다.

#### 서버 API

```
POST /api/odin/command          사용자 → Odin 명령 전송
GET  /api/odin/messages         Odin 메시지 히스토리 조회
WS   /ws/odin                   양방향 실시간 소통 채널
```

#### 메시지 프로토콜

```typescript
// 사용자 → Odin
interface UserCommand {
  type: "command";
  content: string;           // 자연어 명령
  context?: {
    selectedTP?: string;     // 현재 선택한 TP (있으면)
    selectedAgent?: string;  // 현재 선택한 에이전트 (있으면)
  };
}

// Odin → 사용자
interface OdinMessage {
  type: "response" | "approval_request" | "notification" | "progress";
  content: string;
  actions?: Action[];        // 사용자가 선택할 수 있는 액션
  metadata?: {
    tp?: string;             // 관련 TP
    agent?: string;          // 관련 에이전트
    severity?: "info" | "warning" | "critical";
  };
}

interface Action {
  id: string;
  label: string;             // "Approve", "Reject", "Modify"
  type: "approve" | "reject" | "custom";
  payload?: Record<string, unknown>;
}
```

#### 대시보드 UI

```
┌─────────────────────────────────────────┐
│ Overview │ Terminals │ Flow │ ...       │
├─────────────────────────────────────────┤
│                                         │
│  [기존 대시보드 콘텐츠]                  │
│                                         │
├─────────────────────────────────────────┤
│ 💬 Odin Command Bar                     │
│ ┌─────────────────────────────────┬───┐ │
│ │ "TP-016을 Brokkr에게 위임해"     │ → │ │
│ └─────────────────────────────────┴───┘ │
│                                         │
│ Odin: TP-016을 Brokkr[Anvil]에 위임     │
│       하겠습니다. 예상 소요: 15분        │
│       [Approve] [Modify Mode] [Cancel]  │
│                                         │
│ You: Approve                            │
│ Odin: Brokkr 시작됨. PID: 28471         │
└─────────────────────────────────────────┘
```

#### 컴포넌트

- `CommandBar.tsx` — 하단 고정 입력 바 (Ctrl+K로 포커스)
- `OdinChat.tsx` — 메시지 히스토리 + 승인 버튼
- `ApprovalCard.tsx` — 인라인 승인 요청 카드

#### 서버 구현

- `server/odin-channel.ts` — 명령 파싱 + Skill 매핑 + 응답 생성
- 명령 → Skill 자동 매핑: "위임해" → /delegate, "상태" → /status
- 응답은 `artifacts/logs/odin-chat.jsonl`에 영속화

#### 파일 목록

```
src/yggdrasil/server/odin-channel.ts        (신규)
src/yggdrasil/dashboard/components/CommandBar.tsx   (신규)
src/yggdrasil/dashboard/components/OdinChat.tsx     (신규)
src/yggdrasil/dashboard/components/ApprovalCard.tsx (신규)
src/yggdrasil/dashboard/app/page.tsx         (수정 — CommandBar 추가)
src/yggdrasil/server/routes.ts               (수정 — /api/odin/* 추가)
src/yggdrasil/server/index.ts                (수정 — /ws/odin 추가)
```

---

### Phase 2: Agent Control (v0.4.1)

> Odin이 대시보드를 통해 에이전트를 **시작/중지/모드 변경**할 수 있게 한다.

#### 서버 API

```
POST /api/agent/:name/start     에이전트 프로세스 시작
POST /api/agent/:name/stop      에이전트 프로세스 중지
POST /api/agent/:name/mode      에이전트 모드 변경
GET  /api/agent/:name/health    개별 에이전트 상태 + 리소스
```

#### 제어 흐름

```
사용자: "Brokkr를 Mjolnir 모드로 시작해"
  ↓
CommandBar → POST /api/odin/command
  ↓
odin-channel.ts: 명령 파싱 → 승인 요청 생성
  ↓
OdinChat: [Approve] [Cancel] 표시
  ↓
사용자: Approve
  ↓
POST /api/agent/brokkr/start { mode: "mjolnir", tp: "TP-016" }
  ↓
server/control.ts:
  1. Lock 확인 (이미 실행 중인지)
  2. delegate-codex.sh 실행 (background)
  3. PID 저장
  4. WebSocket으로 상태 브로드캐스트
  ↓
AgentCard: status "idle" → "running" 실시간 반영
```

#### 서버 구현

- `server/control.ts` — 에이전트 프로세스 관리
  - `startAgent(name, tp, mode)` — delegate 스크립트 호출
  - `stopAgent(name)` — PID kill + 정리
  - `changeMode(name, mode)` — 환경변수/인자 변경
  - 동시 실행 방지 (기존 Lock 메커니즘 활용)
  - 안전장치: 실행 중 중지 시 확인 프롬프트

#### 대시보드 UI 변경

- `AgentCard.tsx` 확장 — Start/Stop 버튼, 모드 셀렉터
- 에이전트 카드 클릭 → 상세 패널 (현재 TP, 로그, 리소스, 제어 버튼)

#### 파일 목록

```
src/yggdrasil/server/control.ts              (신규)
src/yggdrasil/dashboard/components/AgentCard.tsx     (수정)
src/yggdrasil/dashboard/components/AgentDetail.tsx   (신규)
src/yggdrasil/server/routes.ts               (수정)
```

---

### Phase 3: Task Management (v0.4.2)

> 대시보드에서 Rune(TP) **생성·편집·할당·추적**을 수행한다.

#### 서버 API

```
GET    /api/tasks                 전체 태스크 목록 (필터/정렬)
GET    /api/tasks/:id             태스크 상세 (TP/RP 내용 포함)
POST   /api/tasks                 새 TP 생성
PUT    /api/tasks/:id             TP 수정
POST   /api/tasks/:id/assign      에이전트에 할당 (delegate)
POST   /api/tasks/:id/review      RP 검토 트리거
DELETE /api/tasks/:id             TP 삭제 (draft만)
```

#### 대시보드 UI

```
┌─────────────────────────────────────────────────┐
│  Task Board (칸반 뷰)                            │
│                                                  │
│  Draft      In-Progress    Review     Done       │
│  ┌──────┐   ┌──────┐      ┌──────┐   ┌──────┐  │
│  │TP-016│   │TP-017│      │RP-017│   │TP-015│  │
│  │      │   │Brokkr│      │      │   │      │  │
│  │ drag │   │██░░░ │      │[Appr]│   │  ✓   │  │
│  └──────┘   └──────┘      └──────┘   └──────┘  │
│                                                  │
│  [+ New Rune]                                    │
└─────────────────────────────────────────────────┘
```

#### 핵심 기능

1. **Rune 생성 UI** — 폼 기반 TP 작성 (Objective, Scope, AC, Agent Target, Complexity)
2. **칸반 보드** — 드래그&드롭으로 상태 전환 (Draft → Assign → Review → Done)
3. **RP 검토 패널** — Saga 내용 + AC 체크리스트 + Approve/Reject 버튼
4. **의존성 편집** — TP 간 depends-on 시각적 연결

#### 컴포넌트

```
src/yggdrasil/dashboard/components/TaskBoard.tsx       (신규 — 칸반)
src/yggdrasil/dashboard/components/TaskEditor.tsx       (신규 — TP 폼)
src/yggdrasil/dashboard/components/ReviewPanel.tsx      (신규 — RP 검토)
src/yggdrasil/server/task-manager.ts                    (신규 — CRUD)
```

#### 서버 구현

- `server/task-manager.ts`
  - `createTask()` — TP-NNN.md 생성 + INDEX.md 업데이트
  - `updateTask()` — TP 내용 수정
  - `assignTask()` — delegate 스크립트 호출 (control.ts 연동)
  - `reviewTask()` — RP ↔ TP AC 대조, approve/reject

---

### Phase 4: MCP & Configuration (v0.4.3)

> MCP 서버 연결을 Odin이 관리하고, 사용자도 보조적으로 설정할 수 있게 한다.

#### 서버 API

```
GET    /api/mcp/servers           등록된 MCP 서버 목록
POST   /api/mcp/servers           MCP 서버 추가
DELETE /api/mcp/servers/:name     MCP 서버 제거
GET    /api/mcp/servers/:name/health  연결 상태 확인
PUT    /api/mcp/agents            에이전트별 MCP 접근 권한 설정
```

#### 제어 모델

```
Odin (자동):
  - 필요한 MCP 서버를 자동 판단하여 등록
  - 에이전트별 접근 권한 자동 설정
  - "GitHub MCP가 필요합니다. 토큰을 입력해주세요" → 사용자에게 요청

사용자 (수동):
  - Settings 또는 Skills > MCP에서 직접 토큰 입력
  - 에이전트별 접근 토글 조정
  - 서버 추가/제거
```

#### 구현

- `server/mcp-manager.ts`
  - `listServers()` — `.claude/settings.json` 파싱
  - `addServer()` — settings.json에 서버 등록 + 토큰 설정
  - `removeServer()` — settings.json에서 제거
  - `checkHealth()` — 서버 프로세스 확인
  - `setAgentAccess()` — 에이전트별 접근 권한 저장

---

### Phase 5: Realtime Control Dashboard (v0.5.0)

> 모든 제어 기능을 통합한 **관제 대시보드** 완성.

#### 새로운 뷰 모드: "control"

```
┌──────────────────────────────────────────────────────────────┐
│ overview │ control │ terminals │ flow │ stats │ skills       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Agent Control ──────────────────────────────────────┐   │
│  │                                                       │   │
│  │  Odin [Counsel]  Brokkr [Anvil]   Heimdall [Bifrost] │   │
│  │  ● Brain         ▶ TP-017        ● Idle              │   │
│  │  Always On       ██████░░ 62%     [Start]             │   │
│  │                  [Stop] [Mode ▼]                      │   │
│  │                                                       │   │
│  │  Loki [Sketch]                                        │   │
│  │  ● Idle                                               │   │
│  │  [Start]                                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Task Pipeline ──────────────────────────────────────┐   │
│  │  Draft(2) → Assigned(1) → Running(1) → Review(0)    │   │
│  │  TP-018    TP-019 →Brokkr  TP-017      (empty)      │   │
│  │  TP-020                     ██████░░                  │   │
│  │                              62%                      │   │
│  │  [+ New Rune]                                         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Odin Activity ──────────────────────────────────────┐   │
│  │  14:32 Brokkr started TP-017 [Anvil mode]            │   │
│  │  14:31 TP-017 assigned to Brokkr (user approved)     │   │
│  │  14:30 TP-017 created: "Dashboard 제어 API 구현"      │   │
│  │  14:28 RP-016 reviewed → approved ✓                  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 💬 "TP-018도 Brokkr에게 할당하되 Mjolnir 모드로"     [Send] │
└──────────────────────────────────────────────────────────────┘
```

#### 통합 요소

1. **Agent Control Grid** — 4에이전트 상태 + 시작/중지/모드 컨트롤
2. **Task Pipeline** — 칸반 축약 (Draft → Assigned → Running → Review → Done)
3. **Odin Activity Feed** — 실시간 제어 이력 (무엇을 했는지)
4. **Command Bar** — 하단 고정, 항상 접근 가능
5. **Progress Indicators** — 실행 중 에이전트의 진행률 (로그 기반 추정)

---

## 4. 기술 설계

### 4.1 서버 모듈 구조 (최종)

```
src/yggdrasil/server/
├── index.ts             (기존 — WebSocket /ws/odin 추가)
├── routes.ts            (기존 — 제어 API 추가)
├── agents.ts            (기존 — 상태 감지)
├── auth.ts              (기존)
├── watcher.ts           (기존)
├── parser.ts            (기존)
├── metrics.ts           (기존)
├── dependency.ts        (기존)
├── logger.ts            (기존)
├── odin-channel.ts      (신규 — Phase 1: 소통 채널)
├── control.ts           (신규 — Phase 2: 에이전트 제어)
├── task-manager.ts      (신규 — Phase 3: 태스크 CRUD)
└── mcp-manager.ts       (신규 — Phase 4: MCP 관리)
```

### 4.2 대시보드 컴포넌트 구조 (최종)

```
src/yggdrasil/dashboard/components/
├── (기존 15개 컴포넌트)
├── CommandBar.tsx        (Phase 1 — 명령 입력 바)
├── OdinChat.tsx          (Phase 1 — 메시지 히스토리)
├── ApprovalCard.tsx      (Phase 1 — 승인 요청 카드)
├── AgentDetail.tsx       (Phase 2 — 에이전트 상세 패널)
├── TaskBoard.tsx         (Phase 3 — 칸반 보드)
├── TaskEditor.tsx        (Phase 3 — TP 생성/편집 폼)
├── ReviewPanel.tsx       (Phase 3 — RP 검토 패널)
└── ControlView.tsx       (Phase 5 — 통합 관제 뷰)
```

### 4.3 WebSocket 채널 (최종)

```
/ws/logs     (기존) — 로그 스트리밍
/ws/status   (기존) — 에이전트/태스크 상태
/ws/odin     (신규) — 사용자 ↔ Odin 양방향 소통
```

### 4.4 데이터 흐름

```
사용자 입력 (CommandBar)
  │
  ▼
/ws/odin or POST /api/odin/command
  │
  ▼
odin-channel.ts
  ├── 명령 분석 (자연어 → Skill/Action 매핑)
  ├── 승인 필요? → OdinMessage(approval_request) → 사용자
  │                                                  │
  │                                          [Approve/Reject]
  │                                                  │
  ├── 실행 ──────────────────────────────────────────┘
  │   ├── control.ts → delegate script → 에이전트 실행
  │   ├── task-manager.ts → TP/RP CRUD
  │   └── mcp-manager.ts → settings.json 수정
  │
  ▼
결과 → OdinMessage(response) → /ws/odin → OdinChat
     → WebSocket /ws/status → AgentCard 업데이트
     → WebSocket /ws/logs → LiveLog 업데이트
```

---

## 5. 구현 순서 & TP 매핑

| Phase | 버전 | TP | 제목 | 에이전트 | 난이도 |
|-------|------|-----|------|---------|--------|
| 1 | v0.4.0 | TP-016 | Command Channel — Odin 양방향 소통 채널 | codex | complex |
| 1 | v0.4.0 | TP-017 | CommandBar + OdinChat UI 컴포넌트 | codex | complex |
| 2 | v0.4.1 | TP-018 | Agent Control API — 시작/중지/모드 변경 | codex | complex |
| 2 | v0.4.1 | TP-019 | AgentCard 제어 UI — 버튼/모드셀렉터 통합 | codex | moderate |
| 3 | v0.4.2 | TP-020 | Task Manager — TP CRUD + INDEX.md 동기화 | codex | complex |
| 3 | v0.4.2 | TP-021 | TaskBoard + TaskEditor UI | codex | complex |
| 3 | v0.4.2 | TP-022 | ReviewPanel — RP 검토 + AC 체크 UI | codex | moderate |
| 4 | v0.4.3 | TP-023 | MCP Manager — settings.json 연동 | codex | moderate |
| 5 | v0.5.0 | TP-024 | ControlView — 통합 관제 대시보드 | codex | complex |

---

## 6. 의존 관계

```
TP-016 (Command Channel Server)
  └─→ TP-017 (CommandBar UI)         ← Phase 1 완료
       └─→ TP-018 (Agent Control API)
            └─→ TP-019 (Agent Control UI)  ← Phase 2 완료
                 └─→ TP-020 (Task Manager)
                      ├─→ TP-021 (TaskBoard UI)
                      └─→ TP-022 (ReviewPanel)  ← Phase 3 완료
                           └─→ TP-023 (MCP Manager)  ← Phase 4 완료
                                └─→ TP-024 (ControlView)  ← Phase 5 완료
```

---

## 7. 안전장치 & 제약사항

### 7.1 에이전트 제어 안전

- **동시 실행 방지** — 같은 에이전트가 2개 TP를 동시 실행하지 않도록 Lock 유지
- **중지 확인** — 실행 중 에이전트 중지 시 반드시 사용자 확인 (작업 손실 방지)
- **모드 범위 제한** — Ragnarok/Extra High 모드는 승인 필수
- **롤백 가능** — 모든 에이전트 실행은 git commit 단위로 추적

### 7.2 태스크 관리 안전

- **Draft만 삭제 가능** — in-progress/done 상태의 TP는 삭제 불가
- **INDEX.md 동기화** — 모든 CRUD는 INDEX.md를 원자적으로 업데이트
- **충돌 감지** — 동시 수정 시 최신 타임스탬프 기준 경고

### 7.3 MCP 안전

- **토큰 암호화** — settings.json의 토큰은 평문이므로 `.gitignore` 필수
- **Odin 권한 분리** — Odin은 MCP 설정을 제안하지만, 토큰 입력은 사용자만 가능
- **접근 권한 로깅** — 어떤 에이전트가 어떤 MCP를 사용했는지 기록

---

## 8. 성공 기준

### v0.4.0 (Phase 1 완료)
- [ ] 대시보드에서 Odin에게 자연어 명령 전송 가능
- [ ] Odin이 승인 요청을 보내고 사용자가 Approve/Reject 가능
- [ ] 명령 히스토리가 영속 저장됨

### v0.4.2 (Phase 3 완료)
- [ ] 대시보드에서 TP 생성 → 에이전트 할당 → 실행 → RP 검토 → 승인 전 사이클 가능
- [ ] CLI 없이 대시보드만으로 기본 오케스트레이션 동작

### v0.5.0 (Phase 5 완료)
- [ ] Control 탭에서 모든 에이전트와 태스크를 한 화면에서 관제
- [ ] MCP 서버 연결/해제가 대시보드에서 가능
- [ ] "Asgard Control Panel"로 완전한 관제 시스템 동작

---

## 9. 참고: 현재 아키텍처와의 호환

이 플랜은 기존 아키텍처를 **파괴하지 않고 확장**한다:

- 기존 CLI 워크플로우 (/plan, /delegate 등)는 그대로 동작
- 대시보드 제어는 **동일한 Skill/Script를 서버에서 호출**하는 방식
- 파일 기반 계약 (Rune/Saga)은 변경 없음
- WebSocket 채널 추가만으로 실시간 제어 구현

즉, 대시보드는 **CLI의 시각적 프론트엔드**이자 **Odin의 GUI 인터페이스**가 된다.
