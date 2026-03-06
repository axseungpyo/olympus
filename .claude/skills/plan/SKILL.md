---
name: plan
description: >
  Rune(TP-NNN.md)을 생성한다.
  "기획", "plan", "TP 작성", "태스크 만들어", "작업 지시", "Brokkr에게 시켜",
  "Heimdall에게 시켜", "구현 계획" 등에 트리거.
  새로운 개발 작업, 기능 추가, 버그 수정, 리서치 등 모든 작업의 시작점.
allowed-tools: Read, Write, Glob
---

# /plan — Rune 생성

## 역할

사용자 요청을 분석하여 Brokkr(Codex) 또는 Heimdall(Gemini)가 바로 실행할 수 있는
구체적인 Rune(TP-NNN.md)을 생성한다.

## 실행 절차

### Step 1: 컨텍스트 파악

1. `artifacts/INDEX.md` 읽기 → 다음 TP 번호 확인 (예: TP-007)
2. `shared/context.md` 읽기 → 프로젝트 맥락 파악
3. 필요 시 `src/` 폴더 구조 확인

### Step 2: 요청 분석

아래 항목을 결정한다:

**Agent Target 결정:**
| 작업 유형 | Agent |
|---------|-------|
| 코드 구현, 테스트, 빌드, 리뷰 | codex |
| 이미지 분석, 생성, OCR, 리서치 | gemini |
| 스크린샷 -> 코드 구현 | chain:gemini->codex |

**Complexity Hint 결정 (Codex만):**
| 작업 규모 | Hint | Brokkr Mode |
|---------|------|------------|
| 단순 편집, 설정 파일 | simple | Spark |
| 일반 기능 구현, 테스트 | moderate | Anvil (기본값) |
| 멀티파일 리팩토링, 복잡한 로직 | complex | Mjolnir |
| MVP 전체, 장시간 자율 작업 | extreme | Ragnarok |

### Step 3: TP 작성

`artifacts/handoff/TP-NNN.md`를 AGENTS.md의 Rune 형식에 따라 작성한다.

작성 원칙:
- Objective는 정확히 한 문장. 동사로 시작.
- Scope In/Out을 구체적으로 명시. 모호함 금지.
- Acceptance Criteria는 테스트 가능한 형태로. (예: "npm test 전체 PASS")
- Relevant files는 실제 존재하는 파일 경로만 기재.
- Implementation Notes에 접근 방법과 파일 구조 힌트 포함.

### Step 4: Quality Checklist (자가 검증)

TP 작성 후 아래를 확인한다:

- [ ] Objective가 한 문장이고 구체적인가?
- [ ] Scope In/Out이 명확히 구분되는가?
- [ ] Acceptance Criteria가 모두 테스트 가능한가?
- [ ] Agent Target이 올바르게 선택되었는가?
- [ ] Relevant files가 실제 존재하는가?
- [ ] 모호한 표현("적절히", "필요하면")이 없는가?

하나라도 No면 해당 항목을 수정한다.

### Step 5: INDEX.md 업데이트

`artifacts/INDEX.md`의 Active Tasks 테이블에 추가:
```
| TP-NNN | {Title} | {codex|gemini} | draft | {date} | {date} |
```

Next TP Number를 TP-(NNN+1)로 업데이트.

### Step 6: 사용자에게 보고

```
TP-NNN 생성 완료: {Title}
Agent: {Brokkr|Heimdall} [{Mode}]
파일: artifacts/handoff/TP-NNN.md

다음: /delegate TP-NNN 또는 /delegate-gemini TP-NNN
```

## 주의사항

- TP가 너무 크면 분할한다. (단일 TP = 단일 집중 가능한 작업)
- 의존 관계가 있는 작업은 별도 TP로 분리하고 Dependencies에 명시.
- Gemini 작업의 경우 실제 입력 파일이 존재하는지 먼저 확인.
