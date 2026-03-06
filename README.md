# Asgard

Claude(Odin)를 중심으로 GPT Codex(Brokkr)와 Gemini(Heimdall)를 협업시키는
멀티모델 에이전트 오케스트레이션 시스템.

파일 기반 계약(Rune/Saga)으로 에이전트 간 소통하며, **API 키 없이 CLI 구독만으로 동작**합니다.

```
사용자 (Demiurge)
    │
    ▼
  Odin (Claude Code)          ← 기획 · 설계 · 검토 · 라우팅
    │               │
    ▼               ▼
Brokkr          Heimdall
(Codex CLI)     (Gemini CLI)
코드 구현         이미지 분석 · 생성
테스트 · 빌드      문서 OCR · 리서치
```

---

## 요구사항

| 도구 | 목적 | 설치 |
|------|------|------|
| [Claude Code](https://claude.ai/code) | Odin (Brain) | Claude Pro/Team 구독 |
| [Codex CLI](https://openai.com/codex) | Brokkr (코드) | ChatGPT Pro 구독 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Heimdall (비전) | `npm install -g @google/gemini-cli` |
| coreutils | timeout 호환 | `brew install coreutils` (macOS) |

---

## 설치

### 원격 설치 (권장)

```bash
curl -fsSL https://raw.githubusercontent.com/axseungpyo/asgard/main/install.sh | bash
```

> 보안이 걱정된다면 먼저 스크립트를 확인하세요:
> ```bash
> curl -fsSL https://raw.githubusercontent.com/axseungpyo/asgard/main/install.sh | less
> ```

### 로컬 설치

```bash
git clone https://github.com/axseungpyo/asgard.git
cd asgard
bash install.sh
```

설치 후 터미널을 재시작하거나:
```bash
source ~/.zshrc   # zsh
source ~/.bashrc  # bash
```

---

## 빠른 시작

### 새 프로젝트 생성

```bash
asgard new my-project
cd my-project
# Claude Code로 이 디렉토리를 열면 Odin이 활성화됩니다
```

### 첫 사이클 실행

Claude Code 세션에서:

```
/plan "만들고 싶은 기능 설명"
```

→ TP-001.md(Rune)가 생성되면:

```
/delegate TP-001
```

→ Brokkr가 코드 구현 후 RP-001.md(Saga)를 반환하면:

```
/review RP-001
```

---

## 핵심 개념

### 에이전트 구성 (Asgard Pantheon)

| 에이전트 | 실체 | 역할 |
|---------|------|------|
| **Odin** | Claude Code | 기획 · 설계 · 검토 · 오케스트레이션 |
| **Brokkr** | Codex CLI | 코드 구현 · 테스트 · 리팩토링 |
| **Heimdall** | Gemini CLI | 이미지 분석 · 생성 · OCR · 리서치 |
| **Loki** | (향후) | 이미지 생성/편집 전문 (Nano Banana API) |

### 파일 계약

에이전트는 대화하지 않고 파일로 소통합니다.

```
artifacts/handoff/TP-001.md   ← Odin이 Brokkr/Heimdall에게 보내는 Rune (작업 지시)
artifacts/handoff/RP-001.md   ← Brokkr/Heimdall이 Odin에게 보내는 Saga (결과 보고)
artifacts/INDEX.md            ← 전체 작업 상태 추적 (Chronicle)
shared/context.md             ← 프로젝트 공유 맥락 (Lore)
```

### 모드 시스템

```
Odin:      Whisper[Haiku] / Counsel[Sonnet] / Allfather[Opus]
Brokkr:    Spark[Low] / Anvil[Medium] / Mjolnir[High] / Ragnarok[xHigh]
Heimdall:  Glint[Flash-Lite] / Bifrost[3.1 Pro] / Gjallarhorn[Pro Image]
```

---

## 작동 원리

> **Q. Claude가 `.md` 파일을 쓰면 Codex/Gemini가 어떻게 반응하는 건가요?**

`.md` 파일 자체가 Codex/Gemini를 트리거하는 것이 **아닙니다**.
Claude가 **Bash 명령어로 CLI를 직접 호출**하면서, 프롬프트 안에 "이 파일을 읽어라"라고 지시합니다.

```
사용자: "로그인 기능 만들어줘"
    │
    ▼
┌─ Claude Code (Odin) ─────────────────────────────────────┐
│                                                          │
│  1. Write 도구로 TP-004.md 작성 (Rune 각인)               │
│                                                          │
│  2. Bash 도구로 CLI 실행:                                 │
│     codex exec --full-auto \                             │
│       "Read AGENTS.md... Read TP-004.md...               │
│        implement the task... write RP-004.md"            │
│              │                                           │
│              ▼                                           │
│     ┌─ Codex CLI (별도 프로세스) ──────────┐              │
│     │  GPT가 프롬프트를 받고:              │              │
│     │  → AGENTS.md 읽음 (역할 파악)       │              │
│     │  → TP-004.md 읽음 (Rune 해석)      │              │
│     │  → 코드 구현                        │              │
│     │  → RP-004.md 작성 (Saga 기록)      │              │
│     └─────────────────────────────────────┘              │
│              │                                           │
│  3. Claude가 RP-004.md를 읽고 검토 (승인/반려)            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 실제 실행되는 명령어

```bash
# Brokkr (Codex) 호출
codex exec --full-auto \
  "Read AGENTS.md to understand your role as Brokkr and the Saga(RP) format.
   Read shared/context.md for project context.
   Then read artifacts/handoff/TP-NNN.md and implement the task exactly as specified.
   When complete, write artifacts/handoff/RP-NNN.md as a Saga per AGENTS.md format."

# Heimdall (Gemini) 호출
gemini -p \
  "Read AGENTS.md... Read TP-NNN.md... Write RP-NNN.md..." \
  --yolo
```

### 단계별 역할

| 단계 | 누가 | 뭘 하는지 | 도구 |
|------|------|----------|------|
| Rune 작성 | Claude | 작업 지시서를 `.md` 파일로 저장 | Write |
| CLI 호출 | Claude | `codex exec` 또는 `gemini -p` 실행 | Bash |
| 파일 읽기 | Codex/Gemini | 프롬프트 지시대로 `.md` 파일을 읽음 | 자체 도구 |
| 작업 수행 | Codex/Gemini | 코드 작성, 분석, 이미지 생성 등 | 자체 도구 |
| Saga 작성 | Codex/Gemini | 결과를 `.md` 파일로 디스크에 저장 | 자체 도구 |
| 검토 | Claude | Saga 파일을 읽고 승인/반려 판정 | Read |

### 왜 파일 기반인가?

| 이유 | 설명 |
|------|------|
| **프롬프트 한계** | 작업 지시가 길어지면 CLI 인자 크기 초과 — 파일로 분리 |
| **감사 추적** | 누가 뭘 지시하고 뭘 했는지 전부 파일로 남음 |
| **재시도 가능** | 실패 시 같은 Rune으로 다시 위임 |
| **세션 독립** | Claude 세션이 끊겨도 Rune/Saga 파일은 디스크에 보존 |

> **파일은 계약서(Rune)이고, CLI 명령어가 실행 트리거입니다.**

### 안전장치

Gemini 실행 시 Watchdog 보호 시스템이 내장되어 있습니다:

| 보호 | 기본값 | 동작 |
|------|-------|------|
| 전체 타임아웃 | 300초 | `timeout`/`gtimeout`으로 강제 종료 |
| 출력 정체 감지 | 60초 무출력 | 프로세스 강제 종료 |
| 로그 크기 제한 | 2MB | 초과 시 강제 종료 |
| 에러 루프 감지 | 동일 에러 3회 | 반복 패턴 시 강제 종료 |

---

## Skills 목록

| 명령어 | 기능 |
|--------|------|
| `/plan` | Rune(TP) 생성 |
| `/delegate TP-NNN` | Brokkr(Codex)에 코드 작업 위임 |
| `/delegate-gemini TP-NNN` | Heimdall(Gemini)에 비전/생성 작업 위임 |
| `/chain "요청"` | Heimdall 분석 → Brokkr 구현 체인 |
| `/scout "질문"` | Claude 서브에이전트 병렬 탐색/리서치 |
| `/scout verify RP-NNN` | Saga의 AC를 병렬 검증 |
| `/scout plan "주제"` | 기획 전 코드베이스 사전 조사 |
| `/team "작업"` | Claude Agent Teams 병렬 구현 (실험적) |
| `/review RP-NNN` | Saga 검토 및 판정 |
| `/digest` | 프로젝트 맥락 압축 업데이트 |
| `/status` | 현재 작업 현황 보고 |
| `/init` | 새 프로젝트 아티팩트 구조 초기화 |

---

## CLI 명령어

```bash
asgard new <name>   # 새 프로젝트 생성
asgard new .        # 현재 디렉토리에 Asgard 구조 추가
asgard update       # Skills 최신 버전으로 업데이트
asgard doctor       # 설치 상태 진단
```

---

## 프로젝트 구조

```
my-project/
├── CLAUDE.md                  # Odin 헌법 (Claude Code가 자동 로드)
├── AGENTS.md                # 에이전트 규칙서 + Rune/Saga 포맷
├── .claude/
│   ├── settings.json          # PostToolUse 로깅 Hooks
│   └── skills/                # (글로벌 설치 후 불필요)
├── artifacts/
│   ├── INDEX.md               # 작업 상태 추적 (Chronicle)
│   ├── handoff/               # Rune/Saga 교환소
│   ├── plans/DECISIONS.md     # 설계 결정 기록 (Edicts)
│   └── logs/
├── shared/context.md          # 프로젝트 맥락 (Lore)
├── scripts/
│   └── delegate-gemini.sh     # Heimdall 실행 래퍼
└── src/                       # 코드 (Brokkr 관할)
```

---

## 업데이트

Skills 업데이트:
```bash
asgard update
```

전체 재설치:
```bash
curl -fsSL https://raw.githubusercontent.com/axseungpyo/asgard/main/install.sh | bash
```

---

## 라이선스

MIT License — 자세한 내용은 [LICENSE](LICENSE) 참조.
