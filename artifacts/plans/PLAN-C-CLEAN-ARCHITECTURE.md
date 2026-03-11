# Plan C: Clean Architecture — Yggdrasil 구조 리팩토링

> 현재 플랫한 서버/컴포넌트 구조를 **도메인 기반 클린 아키텍처**로 전환한다.
> 비즈니스 로직과 프레임워크 코드를 분리하여 유지보수성과 확장성을 확보한다.
>
> **Track**: Plan C (아키텍처) — [Plan A](./PLAN-A-CONTROL-PANEL.md) / [Plan B](./PLAN-B-AI-BRAIN.md)와 병렬

**작성일**: 2026-03-11
**기반 버전**: v0.5.0
**목표 버전**: v0.6.0

---

## 1. 현재 구조 진단

### 1.1 핵심 수치

| 지표 | 값 | 판정 |
|------|-----|------|
| 서버 파일 수 | 13개 (플랫) | 도메인 분리 없음 |
| 서버 총 코드 | 3,165줄 | 적정 |
| routes.ts | 711줄, 25개 핸드러 | **비대화** |
| 서버 → 대시보드 import | 8개 파일 | **역방향 의존** |
| 대시보드 → 서버 import | 0개 | 정상 |
| 컴포넌트 수 | 19개 (플랫) | 그룹핑 필요 |

### 1.2 구조 문제 (심각도 순)

#### P1. 역방향 의존 (서버 → UI 타입)
```
server/agents.ts ──import──→ dashboard/lib/types.ts
server/routes.ts ──import──→ dashboard/lib/types.ts
server/control.ts ──import──→ dashboard/lib/types.ts
server/task-manager.ts ──import──→ dashboard/lib/types.ts
server/parser.ts ──import──→ dashboard/lib/types.ts
server/dependency.ts ──import──→ dashboard/lib/types.ts
server/watcher.ts ──import──→ dashboard/lib/types.ts
```
서버 비즈니스 로직이 UI 레이어의 타입 정의에 의존. 클린 아키텍처의 의존성 규칙 위반.

#### P2. 모놀리식 라우터
`routes.ts` 1개 파일에 5개 도메인의 25개 API 핸들러가 혼재:
- Health/Status (3)
- Agent Control (4)
- Task Management (5)
- MCP Management (5)
- Odin Channel (3)
- Document/Skill (5)

#### P3. 하드코딩된 스킬 시스템
`odin-channel.ts`에 8개 스킬이 regex 배열로 하드코딩. 확장 시 파일 직접 수정 필요.

#### P4. 혼합된 서버 진입점
`index.ts`에 HTTP 서버, WebSocket 3개, 하트비트, 이벤트 브로드캐스트, 인증이 모두 혼재.

#### P5. 컴포넌트 플랫 구조
19개 컴포넌트가 한 디렉토리에 나열. 도메인별 그룹핑 없음.

---

## 2. 목표 아키텍처

### 2.1 클린 아키텍처 원칙 적용

```
┌─────────────────────────────────────────────────────┐
│              Frameworks & Drivers                    │
│  ┌─────────────────────────────────────────────┐    │
│  │         Interface Adapters                   │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │        Use Cases                     │    │    │
│  │  │  ┌─────────────────────────────┐    │    │    │
│  │  │  │       Entities (Types)       │    │    │    │
│  │  │  └─────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘

의존성 방향: 바깥 → 안쪽 (절대 반대 방향 없음)
```

- **Entities**: 도메인 타입 정의 (AgentName, Task, etc.)
- **Use Cases**: 비즈니스 로직 (startAgent, createTask, processCommand)
- **Interface Adapters**: HTTP 라우트, WebSocket 핸들러, 파일 파서
- **Frameworks**: Express, Next.js, ws, chokidar

### 2.2 목표 디렉토리 구조

```
src/yggdrasil/
├── shared/                          # 공유 타입 (서버 + 클라이언트)
│   └── types.ts                     # 도메인 타입 정의 (진실의 원천)
│
├── server/
│   ├── index.ts                     # 진입점 (조합만, 로직 없음)
│   │
│   ├── domain/                      # 비즈니스 로직 (프레임워크 무관)
│   │   ├── agents/
│   │   │   ├── agent-state.ts       # 에이전트 상태 조회 로직
│   │   │   └── agent-control.ts     # 시작/중지/모드 변경 로직
│   │   ├── tasks/
│   │   │   ├── task-manager.ts      # TP CRUD + INDEX.md 동기화
│   │   │   └── task-parser.ts       # INDEX.md 파싱
│   │   ├── odin/
│   │   │   ├── command-processor.ts # 명령 파싱 + 스킬 매칭
│   │   │   ├── skill-registry.ts    # 스킬 등록/조회 (확장 가능)
│   │   │   └── message-store.ts     # 메시지 히스토리 관리
│   │   └── mcp/
│   │       └── mcp-manager.ts       # MCP 서버 CRUD
│   │
│   ├── routes/                      # HTTP 라우트 (Express 어댑터)
│   │   ├── index.ts                 # 라우터 조합
│   │   ├── health.routes.ts
│   │   ├── agent.routes.ts
│   │   ├── task.routes.ts
│   │   ├── odin.routes.ts
│   │   ├── mcp.routes.ts
│   │   └── document.routes.ts
│   │
│   ├── websocket/                   # WebSocket 핸들러
│   │   ├── ws-manager.ts            # WSS 생성, 하트비트, 인증 공통 로직
│   │   ├── logs-handler.ts
│   │   ├── status-handler.ts
│   │   └── odin-handler.ts
│   │
│   └── infra/                       # 인프라 어댑터
│       ├── auth.ts
│       ├── logger.ts
│       ├── file-watcher.ts          # chokidar 래퍼
│       ├── process-runner.ts        # delegate 스크립트 실행기
│       ├── metrics-collector.ts
│       └── dependency-graph.ts
│
├── dashboard/
│   ├── app/
│   ├── components/
│   │   ├── layout/                  # Header, ThemeToggle
│   │   ├── agents/                  # AgentCard, ControlView
│   │   ├── tasks/                   # TaskBoard, TaskEditor, Chronicle
│   │   ├── odin/                    # CommandBar, QuickActions
│   │   ├── skills/                  # SkillsPanel, McpPanel
│   │   ├── monitoring/              # FlowView, DependencyView, StatsPanel, MetricsPanel
│   │   └── settings/               # ApiKeysModal, DocViewer
│   └── lib/
│       ├── auth.ts
│       ├── constants.ts
│       ├── theme.ts
│       └── websocket.ts
│
└── package.json
```

### 2.3 의존성 규칙

```
shared/types.ts ←── 모든 레이어에서 import 가능 (유일한 공유 지점)

server/domain/*  ←── shared/types만 import. Express/ws 등 프레임워크 import 금지.
server/routes/*  ←── domain/* + shared/types import 가능. Express import 가능.
server/websocket/* ←── domain/* + shared/types import 가능. ws import 가능.
server/infra/*   ←── shared/types만 import. 외부 라이브러리 import 가능.

dashboard/*      ←── shared/types + dashboard/lib만 import. server/* import 금지.
```

---

## 3. 리팩토링 단계

### Phase C1: 타입 경계 수정 (v0.5.1)

> 서버 → 대시보드 역방향 의존을 제거한다.

**작업 내용:**
1. `shared/types.ts` 생성 — `dashboard/lib/types.ts`에서 도메인 타입 추출
2. 서버 8개 파일의 import를 `shared/types`로 변경
3. `dashboard/lib/types.ts`는 `shared/types`를 re-export + UI 전용 타입만 유지

**영향 범위:** import 경로만 변경. 기능 변경 없음. 가장 안전한 첫 단계.

### Phase C2: 라우트 분해 (v0.5.2)

> `routes.ts` (711줄)를 도메인별 라우터 모듈로 분리한다.

**작업 내용:**
1. `server/routes/` 디렉토리 생성
2. 25개 핸들러를 6개 파일로 분리
3. `routes/index.ts`에서 조합

**분리 기준:**
| 파일 | 핸들러 수 | 줄 수 (추정) |
|------|---------|-------------|
| health.routes.ts | 3 | ~80 |
| agent.routes.ts | 4 | ~80 |
| task.routes.ts | 5 | ~120 |
| odin.routes.ts | 3 | ~60 |
| mcp.routes.ts | 5 | ~90 |
| document.routes.ts | 5 | ~200 |

### Phase C3: 도메인 모듈화 (v0.5.3)

> server/ 플랫 파일을 domain/ + infra/ 구조로 재배치한다.

**작업 내용:**
1. `server/domain/agents/` — agents.ts + control.ts 이동
2. `server/domain/tasks/` — task-manager.ts + parser.ts 이동
3. `server/domain/odin/` — odin-channel.ts 분할 (command-processor, skill-registry, message-store)
4. `server/domain/mcp/` — mcp-manager.ts 이동
5. `server/infra/` — logger.ts, auth.ts, watcher.ts, metrics.ts, dependency.ts 이동

### Phase C4: WebSocket 정리 + 컴포넌트 그룹핑 (v0.5.4)

> index.ts의 WebSocket 로직 추출 + 대시보드 컴포넌트 도메인별 그룹핑.

**작업 내용:**
1. `server/websocket/ws-manager.ts` — 공통 WSS 생성/하트비트/인증
2. 핸들러 분리: logs, status, odin
3. `dashboard/components/` 하위에 도메인별 디렉토리 생성
4. 19개 컴포넌트를 7개 그룹으로 재배치
5. import 경로 업데이트

---

## 4. TP 매핑

| Phase | 버전 | TP | 제목 | 난이도 |
|-------|------|-----|------|--------|
| C1 | v0.5.1 | TP-016 | 타입 경계 수정 — shared/types.ts 분리 | moderate |
| C2 | v0.5.2 | TP-017 | 라우트 분해 — routes.ts → 6개 도메인 라우터 | complex |
| C3 | v0.5.3 | TP-018 | 서버 도메인 모듈화 — domain/ + infra/ 구조 | complex |
| C4 | v0.5.4 | TP-019 | WebSocket 정리 + 컴포넌트 그룹핑 | complex |

---

## 5. 안전 원칙

1. **기능 변경 없음** — 리팩토링은 구조만 변경. API/UI 동작은 동일해야 함.
2. **Phase별 빌드 검증** — 각 Phase 완료 후 `tsc --noEmit` + 서버 재시작 테스트.
3. **점진적 마이그레이션** — 한 번에 모든 파일을 옮기지 않고, Phase별로 진행.
4. **import 경로 자동화** — 가능하면 re-export로 기존 경로 호환 유지.

---

## 6. 성공 기준

### v0.6.0 (전체 완료)
- [ ] 서버 → 대시보드 직접 import 0개 (shared/types만 사용)
- [ ] routes.ts 단일 파일 없음 → 6개 도메인 라우터
- [ ] server/ 플랫 파일 없음 → domain/ + routes/ + websocket/ + infra/ 구조
- [ ] 컴포넌트 플랫 디렉토리 없음 → 7개 도메인 그룹
- [ ] 모든 기존 API + UI 동작 동일 (기능 회귀 없음)
- [ ] `tsc --noEmit` 에러 0개
