---
name: digest
description: >
  프로젝트 맥락을 압축하여 shared/context.md를 최신 상태로 유지한다.
  "digest", "컨텍스트 정리", "context 업데이트", "맥락 압축", "요약 업데이트",
  "세션 정리" 등에 트리거.
  세션이 길어지거나 TP 3개 이상 완료 후 권장.
allowed-tools: Read, Write, Glob
---

# /digest — Context Digest

## 역할

프로젝트가 진행되면서 누적되는 정보를 `shared/context.md`에 압축·갱신한다.
새 세션 시작 시 빠른 맥락 복구를 가능하게 한다.

## 실행 절차

### Step 1: 현재 상태 수집

아래 파일들을 읽는다:
1. `artifacts/INDEX.md` — 완료/진행중 작업 목록
2. `artifacts/plans/DECISIONS.md` — 최근 결정 사항
3. 최근 완료된 RP 파일들 (INDEX.md에서 `done` 항목)
4. 현재 `shared/context.md` — 기존 내용

### Step 2: 변경 사항 추출

최근 RP들의 `Context Digest` 섹션에서 핵심 내용 추출:
- 아키텍처 변경 사항
- 새로 추가된 파일/컴포넌트
- 환경 설정 변경
- 발견된 Gotchas (주의사항)

### Step 3: shared/context.md 업데이트

아래 섹션을 업데이트한다:

```markdown
# Asgard Lore — Project Context

Last updated: {datetime}

## Project Summary
(변경 없으면 그대로 유지)

## Current Phase
(현재 단계 업데이트)

## Tech Stack
(추가된 기술이 있으면 업데이트)

## Key Architecture
(주요 구조 변경 반영)

## Key File Locations
(새로 생긴 중요 파일 추가)

## Recent Progress
(최근 완료된 TP 3-5개 요약 — 오래된 것은 삭제)

## Active Constraints
(새로 발견된 제약사항 추가, 해결된 것은 삭제)
```

업데이트 원칙:
- Recent Progress는 최근 5개만 유지 (오래된 것 삭제)
- 파일 크기 목표: 100줄 이하
- 미래의 Odin이 5분 안에 맥락을 파악할 수 있어야 함

### Step 4: 완료 보고

```
Context Digest 완료.

업데이트 내용:
- Recent Progress: {n}개 추가
- Architecture: (변경 사항)
- Constraints: (변경 사항)

shared/context.md: {n}줄 (목표: 100줄 이하)
```

## 실행 권장 시점

- TP 3개 이상 완료 후
- 세션이 길어져 컨텍스트 압박이 느껴질 때
- 새 주요 기능이 완성되었을 때
- 다음 세션 전 마무리 정리 시
