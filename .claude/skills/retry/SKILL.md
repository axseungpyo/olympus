---
name: retry
description: >
  실패한(blocked) Rune(TP)을 재실행한다.
  "retry", "재시도", "다시 실행", "blocked 해결" 등에 트리거.
allowed-tools: Read, Write, Bash, Glob
---

# /retry — Blocked Rune 재실행

## 역할

blocked 상태의 Rune(TP)을 분석하고, 이전 에러를 확인한 뒤 해당 에이전트를 재실행한다.
최대 3회까지 재시도하며, 초과 시 사용자에게 수동 개입을 요청한다.

## 실행 절차

### Step 1: TP 파싱 및 상태 확인

`$ARGUMENTS`에서 TP ID 파싱 (예: `TP-007`).

1. `artifacts/INDEX.md` 읽기
2. 해당 TP의 status가 `blocked`인지 확인
3. blocked가 아니면 중단:
   ```
   TP-NNN은 blocked 상태가 아닙니다 (현재: {status}).
   /retry는 blocked 상태의 TP만 재실행합니다.
   ```

### Step 2: 에러 로그 분석

1. `artifacts/logs/` 디렉토리에서 `TP-NNN` 관련 로그 파일 검색 (Glob: `artifacts/logs/TP-NNN-*.log`)
2. `artifacts/handoff/RP-NNN.md`가 있으면 에러 정보 확인
3. `artifacts/logs/execution.log`에서 해당 TP 관련 기록 확인

에러 원인 요약 출력:
```
이전 실패 분석:
- 에러 유형: {에러 유형}
- 원인: {원인 요약}
- 로그: {로그 파일 경로}
```

### Step 3: 재시도 횟수 확인

INDEX.md에서 해당 TP의 행을 확인하여 `retry:N` 표기 검색.
- 표기가 없으면 retry:0으로 간주
- retry:3 이상이면 중단:
  ```
  TP-NNN은 이미 3회 재시도했습니다.
  수동 개입이 필요합니다.

  이전 에러: {에러 요약}
  제안: {해결 방안}
  ```

### Step 4: Agent Target 확인 및 재실행

`artifacts/handoff/TP-NNN.md` 읽기:
- Agent Target이 `codex`이면 delegate-codex 방식으로 재실행
- Agent Target이 `gemini`이면 delegate-gemini 방식으로 재실행
- Agent Target이 `chain:gemini->codex`이면 chain 방식으로 재실행

INDEX.md 업데이트:
- status: `blocked` -> `in-progress`
- retry 횟수 증가: `retry:{N+1}` 주석을 Updated 컬럼 뒤에 추가

재실행 명령 (codex 예시):
```bash
codex exec --full-auto \
  "Read AGENTS.md to understand your role as Brokkr and the Saga(RP) format.
   Read shared/context.md for project context.
   Then read artifacts/handoff/TP-NNN.md and implement the task exactly as specified.
   Previous attempt failed. Check artifacts/logs/ for error details.
   When complete, write artifacts/handoff/RP-NNN.md as a Saga per AGENTS.md format."
```

상태 메시지:
```
재시도 {N}/3: TP-NNN ({Agent}) 재실행 중...
```

### Step 5: 결과 확인

실행 완료 후:
- `artifacts/handoff/RP-NNN.md` 존재 확인
- 있으면: INDEX.md status -> `review-needed`
- 없으면: INDEX.md status -> `blocked` 유지

보고:
```
재시도 결과: TP-NNN
- 시도: {N}/3
- 결과: {review-needed 또는 blocked}
- 다음: {/review RP-NNN 또는 원인 분석}
```

## 오류 처리

**TP가 존재하지 않는 경우:**
```
artifacts/handoff/TP-NNN.md를 찾을 수 없습니다.
/status로 현재 작업 목록을 확인하세요.
```

**Agent CLI 미설치:**
- codex: `Brokkr를 찾을 수 없습니다. npm install -g @openai/codex`
- gemini: `Heimdall을 찾을 수 없습니다. npm install -g @google/gemini-cli`
