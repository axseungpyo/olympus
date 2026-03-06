---
name: chain
description: >
  Heimdall(Gemini) 분석 결과를 Brokkr(Codex) 구현으로 연결하는 멀티에이전트 체인을 실행한다.
  "chain", "체인", "스크린샷 보고 구현", "UI 클론", "이미지 보고 만들어",
  "비전 후 구현", "분석 후 코딩" 등에 트리거.
  Agent Target이 "chain:gemini->codex"인 TP에 사용.
allowed-tools: Read, Write, Bash, Glob
---

# /chain — Heimdall -> Brokkr 체인

## 역할

Heimdall(Gemini)의 비전/분석 결과를 바탕으로 Brokkr(Codex)가 코드를 구현하는
2단계 에이전트 체인을 실행한다.

## 주요 사용 시나리오

| 시나리오 | Phase 1 (Heimdall) | Phase 2 (Brokkr) |
|---------|-------------------|------------------|
| UI 클론 | 스크린샷 분석 -> 컴포넌트 구조/스타일 추출 | 추출된 스펙으로 코드 구현 |
| 문서 -> API | 문서/PDF 분석 -> 데이터 구조 추출 | 추출된 구조로 API 구현 |
| 디자인 -> 코드 | 목업 이미지 분석 | UI 컴포넌트 구현 |

## 실행 절차

### Step 1: 체인 TP 확인

`$ARGUMENTS`에서 TP ID 파싱 또는 사용자 요청 분석.

Agent Target이 `chain:gemini->codex`인 TP를 사용한다.
없으면 체인용 TP를 먼저 생성한다 (`/plan` 활용).

### Step 2: Phase 1 — Heimdall 실행

1. INDEX.md에서 Phase 1 TP 상태 확인
2. 입력 파일(이미지/문서) 존재 확인
3. Heimdall 소환:
   ```bash
   bash scripts/delegate-gemini.sh TP-NNN-vision --input {input-file}
   ```
4. RP-NNN-vision.md 생성 확인

Phase 1 완료 후 중간 보고:
```
Heimdall[Bifrost] Phase 1 완료: RP-NNN-vision.md
추출된 구조: (RP 핵심 내용 요약)
```

### Step 3: Phase 1 검토 (빠른 검토)

RP-NNN-vision.md의 출력이 Phase 2 구현에 충분한지 확인:
- 컴포넌트 구조가 명확한가?
- 색상/폰트/레이아웃이 명시되었는가?
- 코드로 변환 가능한 형태인가?

불충분하면: Heimdall에게 보완 요청 (패치 TP 생성)

### Step 4: Phase 2 TP 생성

Heimdall의 출력을 바탕으로 Brokkr용 TP를 자동 생성:

- Agent Target: codex
- Complexity Hint: 스크린샷/문서 복잡도에 따라 결정
- Relevant files: RP-NNN-vision.md (Heimdall 분석 결과)
- Implementation Notes: Heimdall이 추출한 구조/스펙 참조

### Step 5: Phase 2 — Brokkr 실행

```bash
codex exec --full-auto \
  "Read AGENTS.md for agent rules.
   Read artifacts/handoff/RP-NNN-vision.md for Heimdall vision analysis results.
   Read artifacts/handoff/TP-NNN-impl.md for implementation spec.
   Implement the code exactly as specified using the vision analysis as reference."
```

### Step 6: 체인 완료 보고

```
체인 완료: Heimdall[Bifrost] -> Brokkr[{Mode}]

Phase 1 (Heimdall):  TP-NNN-vision -> RP-NNN-vision (분석 완료)
Phase 2 (Brokkr): TP-NNN-impl -> RP-NNN-impl (구현 완료)

검토: /review RP-NNN-impl
```

## 체인 TP 네이밍 컨벤션

```
TP-NNN-vision.md   -- Heimdall용 비전 분석 TP
RP-NNN-vision.md   -- Heimdall 분석 결과
TP-NNN-impl.md     -- Brokkr용 구현 TP (Heimdall 결과 참조)
RP-NNN-impl.md     -- Brokkr 구현 결과
```

또는 단일 체인이면:
```
TP-NNN.md          -- 체인 전체 TP (Agent Target: chain:gemini->codex)
RP-NNN-v.md        -- Heimdall 비전 결과 (vision)
RP-NNN.md          -- Brokkr 최종 구현 결과
```
