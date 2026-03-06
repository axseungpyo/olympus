---
name: review
description: >
  Brokkr 또는 Heimdall이 제출한 Saga(RP-NNN.md)를 검토하고 판정한다.
  "review", "검토", "RP 확인", "결과 봐줘", "승인", "판정", "Saga 도착" 등에 트리거.
  TP의 Acceptance Criteria와 Saga를 대조 검증한다.
allowed-tools: Read, Write, Glob
---

# /review — Saga (RP) 검토

## 역할

Brokkr(Codex) 또는 Heimdall(Gemini)의 작업 결과(Saga)를 Rune(TP)의 계약 기준으로 검토하고
approved / revision / blocked 중 하나로 판정한다.

## 실행 절차

### Step 1: 문서 로드

`$ARGUMENTS`에서 RP ID 파싱 (예: `RP-007`).

아래 순서로 읽는다:
1. `artifacts/handoff/RP-NNN.md` (검토 대상)
2. `artifacts/handoff/TP-NNN.md` (원래 계약)

### Step 2: Acceptance Criteria 대조

TP의 각 AC에 대해 Saga의 "Acceptance Criteria Check"와 비교:

| AC 항목 | Saga 보고 | 실제 증거 | 판단 |
|---------|---------|---------|------|
| ... | PASS/FAIL | ... | OK/NG |

**증거 확인:**
- 실행 결과 로그가 있는가?
- 파일이 실제로 생성/수정되었는가?
- 테스트가 실제로 통과했는가?

### Step 3: 품질 검토

추가 확인 사항:
- [ ] Scope Out에 명시된 작업을 하지 않았는가?
- [ ] 임의 추가 기능이 없는가?
- [ ] Known Issues에 중요한 미해결 문제가 있는가?
- [ ] Context Digest가 향후 작업에 유용한가?

### Step 4: 판정

**approved (승인):**
- 모든 AC가 PASS
- Scope 위반 없음
- Known Issues가 minor하거나 없음

조치:
1. INDEX.md: status -> `done`, Updated: {datetime}
2. `shared/context.md`에 완료 사항 추가 (Context Digest 활용)
3. DECISIONS.md에 중요한 결정 기록 (있는 경우)
4. 아카이빙:
   - `artifacts/archive/` 디렉토리 생성 (없으면)
   - `artifacts/handoff/TP-NNN.md`, `artifacts/handoff/RP-NNN.md`를 `artifacts/archive/`로 복사 (원본 유지)
   - INDEX.md의 Active Tasks 테이블에서 해당 행을 제거하고 Completed Tasks 테이블에 추가

보고:
```
Odin[Counsel] 심판: RP-NNN APPROVED

완료: {Title}
변경 파일: {n}개
다음 작업: (제안 또는 없음)
```

---

**revision (수정 요청):**
- 하나 이상의 AC가 FAIL
- Scope 위반이 있음
- Critical Known Issues가 있음

조치:
1. INDEX.md: status -> `draft` (재작업)
2. 새 패치 TP 작성 내용 결정

보고:
```
Odin[Counsel] 심판: RP-NNN REVISION NEEDED

미통과 항목:
- AC N: {실패 이유}

수정 범위:
- {구체적 수정 사항}

다음: /plan으로 패치 TP-{NNN+1} 작성
```

---

**blocked (차단):**
- Saga가 존재하지 않음
- Brokkr/Heimdall이 작업을 완료하지 못함
- 환경 문제, 의존성 오류 등

조치:
1. INDEX.md: status -> `blocked`
2. 원인 분석 및 해결 방안 제시

보고:
```
Odin[Counsel] 심판: RP-NNN BLOCKED

차단 원인: {원인}
해결 방안: {제안}
```

### Step 5: DECISIONS.md 업데이트 (필요 시)

검토 과정에서 중요한 트레이드오프나 설계 결정이 발견되면 기록:
```markdown
## Decision N: {Title}
- Date: {date}
- Options: A) ... B) ...
- Chosen: B
- Rationale: ...
- Tradeoffs: ...
```

## 검토 원칙

- 기준은 TP의 AC뿐이다. AC 범위 밖의 "더 좋은 방법"으로 반려하지 않는다.
- PASS/FAIL은 증거 기반으로만 판단한다.
- 의심스러우면 직접 파일을 읽어서 확인한다.
