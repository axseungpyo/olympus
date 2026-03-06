---
name: status
description: >
  Asgard 프로젝트의 현재 작업 상태를 요약하여 보고한다.
  "status", "상태", "현황", "어디까지 됐어", "진행 상황", "asgard",
  "뭐가 남았어" 등에 트리거.
allowed-tools: Read, Glob
---

# /status — Asgard 현황 보고

## 역할

`artifacts/INDEX.md`와 `shared/context.md`를 읽어 프로젝트 현황을 한눈에 보고한다.

## 실행 절차

### Step 1: 데이터 수집

1. `artifacts/INDEX.md` 읽기
2. `shared/context.md` 읽기

### Step 2: 상태 집계

INDEX.md에서 아래를 집계:
- `draft`: 작성 중인 TP
- `in-progress`: 실행 중인 TP
- `review-needed`: 검토 대기 RP
- `blocked`: 차단된 TP
- `done`: 완료된 TP

### Step 3: 보고

아래 형식으로 출력:

```
Asgard 현황 — {datetime}

프로젝트: {Project Summary}
단계: {Current Phase}

작업 상태:
  검토 대기 (review-needed): {n}개 — 즉시 처리 필요
  실행 중   (in-progress):   {n}개
  차단됨    (blocked):       {n}개 — 즉시 처리 필요
  초안      (draft):         {n}개
  완료      (done):          {n}개

{review-needed가 있으면}
즉시 검토 필요:
  - RP-NNN: {Title} [Brokkr/Heimdall]
  -> /review RP-NNN

{blocked가 있으면}
차단된 작업:
  - TP-NNN: {Title} — {차단 이유}
  -> 원인 분석 및 재계획 필요

{in-progress가 있으면}
진행 중:
  - TP-NNN: {Title} [Agent] (시작: {date})

다음 TP 번호: TP-{NNN}
```

## 단순 모드

`/status quick` 또는 빠른 확인이 필요할 때:
```
Asgard: done={n} / review={n} / running={n} / blocked={n} | 다음: TP-{NNN}
```
