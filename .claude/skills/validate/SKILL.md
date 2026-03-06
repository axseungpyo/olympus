---
name: validate
description: >
  Rune(TP)의 포맷과 품질을 자동 검증한다.
  "validate", "검증", "TP 확인", "포맷 체크" 등에 트리거.
allowed-tools: Read, Glob
---

# /validate — Rune (TP) 포맷 및 품질 검증

## 역할

Rune(TP)이 계약 기반 핸드오프에 필요한 포맷과 품질 기준을 충족하는지 자동 검증한다.
결과를 PASS/WARN/FAIL 체크리스트로 출력한다.

## 실행 절차

### Step 1: TP 로드

`$ARGUMENTS`에서 TP ID 파싱 (예: `TP-007`).

`artifacts/handoff/TP-NNN.md` 읽기.
- 파일이 없으면 즉시 FAIL:
  ```
  FAIL: artifacts/handoff/TP-NNN.md를 찾을 수 없습니다.
  ```

### Step 2: 필수 섹션 검증

아래 섹션이 존재하는지 확인:

| 섹션 | 필수 | 판정 |
|------|------|------|
| Agent Target | 필수 | FAIL if missing |
| Objective | 필수 | FAIL if missing |
| Scope — In | 필수 | FAIL if missing |
| Scope — Out | 필수 | FAIL if missing |
| Acceptance Criteria | 필수 | FAIL if missing |
| Deliverables | 필수 | FAIL if missing |
| Complexity Hint | 선택 (codex만) | WARN if missing for codex |
| Relevant Files | 선택 | WARN if missing |
| Context / Notes | 선택 | — |

### Step 3: 값 유효성 검증

**Agent Target:**
- 유효값: `codex`, `gemini`, `chain:gemini->codex`
- 이외의 값이면 FAIL

**Objective:**
- 한 문장인지 확인 (마침표/문장부호 기준으로 2문장 이상이면 WARN)
- 비어있으면 FAIL

**Complexity Hint (Agent Target이 codex인 경우):**
- 유효값: `simple`, `moderate`, `complex`, `extreme`
- 이외의 값이면 FAIL
- Agent Target이 codex인데 없으면 WARN

**Acceptance Criteria:**
- 1개 이상 존재해야 함 (없으면 FAIL)
- 체크박스 형태(`- [ ]`)인지 확인 (아니면 WARN)

### Step 4: 파일 존재 확인

Relevant Files 섹션에 나열된 파일들이 실제로 존재하는지 Glob으로 확인:
- 존재하지 않는 파일이 있으면 WARN (새로 생성할 파일일 수 있으므로 FAIL은 아님)
- 모든 파일이 존재하면 PASS

### Step 5: 모호 표현 감지

TP 전체 텍스트에서 아래 표현을 검색:
- "적절히", "적절하게"
- "필요하면", "필요한 경우"
- "등등", "기타"
- "알아서"
- "적당히"
- "대충"

발견 시 WARN 처리. 해당 라인 번호와 내용 표시.

### Step 6: 결과 출력

체크리스트 형태로 출력:

```
TP-NNN 검증 결과
================

[PASS] Agent Target: codex (유효)
[PASS] Objective: 한 문장 (유효)
[PASS] Scope In: 존재
[PASS] Scope Out: 존재
[PASS] Acceptance Criteria: 3개 (체크박스 형태)
[PASS] Deliverables: 존재
[WARN] Complexity Hint: 없음 (codex TP에 권장)
[WARN] Relevant Files: src/foo.ts 존재하지 않음 (신규 파일?)
[WARN] 모호 표현: L15 "필요하면 리팩토링"

최종: X PASS / Y WARN / Z FAIL
```

**최종 판정:**
- FAIL이 1개 이상: `FAIL — 수정 후 재검증 필요`
- WARN만 있음: `WARN — 확인 후 진행 가능`
- 모두 PASS: `PASS — 위임 준비 완료`
