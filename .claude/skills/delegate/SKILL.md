---
name: delegate
description: >
  Brokkr(Codex CLI)에게 Rune(TP)을 전달하여 코드 작업을 위임한다.
  "delegate", "위임", "Brokkr", "Codex에게", "구현 시작", "실행해",
  "코딩 시작" 등에 트리거. Agent Target이 "codex"인 TP에 사용.
allowed-tools: Read, Write, Bash, Glob
---

# /delegate — Brokkr(Codex) 실행 위임

## 역할

준비된 Rune(TP)을 Brokkr(Codex CLI)에게 전달하고 실행을 감독한다.

## 실행 절차

### Step 1: TP 검증

`$ARGUMENTS`에서 TP ID 파싱 (예: `TP-007`).

확인 사항:
- `artifacts/handoff/TP-NNN.md` 존재 여부
- `Agent Target`이 `codex`인지 확인
- `artifacts/INDEX.md`에서 status가 `draft` 또는 `ready`인지 확인

검증 실패 시 사용자에게 이유를 알리고 중단.

### Step 2: Complexity Hint -> Mode 결정

TP의 Complexity Hint 읽기:

| Hint | Brokkr Mode | Approval Mode |
|------|-------------|---------------|
| simple | Spark (Low) | auto-edit |
| moderate | Anvil (Medium) | auto-edit |
| complex | Mjolnir (High) | auto-edit |
| extreme | Ragnarok (Extra High) | full-auto |

### Step 3: INDEX.md 상태 업데이트

status: `draft` -> `in-progress`, Updated: {datetime}

### Step 4: Brokkr 소환

아래 Bash 명령으로 Codex CLI를 실행한다:

**기본 (simple/moderate/complex):**
```bash
codex exec --full-auto \
  "Read AGENTS.md to understand your role as Brokkr and the Saga(RP) format.
   Read shared/context.md for project context.
   Then read artifacts/handoff/TP-NNN.md and implement the task exactly as specified.
   When complete, write artifacts/handoff/RP-NNN.md as a Saga per AGENTS.md format."
```

**extreme (Ragnarok 모드):**
```bash
codex exec --full-auto \
  "Read AGENTS.md to understand your role as Brokkr and the Saga(RP) format.
   Read shared/context.md for project context.
   Then read artifacts/handoff/TP-NNN.md and implement the task exactly as specified.
   This is a Ragnarok-level task: work autonomously until complete.
   When complete, write artifacts/handoff/RP-NNN.md as a Saga per AGENTS.md format."
```

실행 중 상태 메시지:
```
Brokkr[{Mode}] 니다벨리르 점화: TP-NNN 실행 중...
```

### Step 5: Saga(RP) 확인

Codex 실행 완료 후:
- `artifacts/handoff/RP-NNN.md` 존재 확인
- 없으면: INDEX.md status -> `blocked`, 사용자에게 알림
- 있으면: INDEX.md status -> `review-needed`, Updated: {datetime}

### Step 6: 완료 보고

```
Brokkr[{Mode}] Saga 도착: RP-NNN

검토 준비 완료. 다음: /review RP-NNN
```

## 오류 처리

**Codex 미설치:**
```
Brokkr를 찾을 수 없습니다.
설치: npm install -g @openai/codex (또는 ChatGPT Pro 구독 확인)
```

**TP Agent Target이 codex가 아닌 경우:**
```
이 TP는 Heimdall(Gemini) 작업입니다.
/delegate-gemini TP-NNN을 사용하세요.
```

**Codex 실행 실패:**
1. INDEX.md status -> `blocked`
2. 오류 내용을 `artifacts/logs/TP-NNN-error.log`에 기록
3. 사용자에게 오류 원인과 해결책 제시
