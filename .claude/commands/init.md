# /init — Asgard Project Initializer

새 프로젝트를 위한 아티팩트 구조를 초기화한다.

## When to Use

새 개발 프로젝트를 시작할 때 실행한다. 이미 초기화된 프로젝트에서는 실행하지 않는다.

## Steps

1. **디렉토리 구조 확인/생성**

   아래 폴더가 없으면 생성한다:
   - `artifacts/research/`
   - `artifacts/plans/`
   - `artifacts/handoff/`
   - `artifacts/logs/`
   - `shared/`
   - `scripts/`
   - `src/`

2. **artifacts/INDEX.md 초기화**

   없으면 아래 형식으로 생성한다:
   ```markdown
   # Asgard Chronicle — Work Status Index

   Last updated: {date}

   ## Active Tasks

   | ID | Title | Agent | Status | Created | Updated |
   |----|-------|-------|--------|---------|---------|

   ## Completed Tasks

   | ID | Title | Agent | Completed |
   |----|-------|-------|-----------|

   ## Next TP Number: TP-001
   ```

3. **artifacts/plans/DECISIONS.md 초기화**

   없으면 아래 헤더로 생성한다:
   ```markdown
   # Asgard Edicts — Design Decisions

   (Options / Chosen / Rationale / Tradeoffs 형식으로 기록)
   ```

4. **shared/context.md 초기화**

   없으면 아래 형식으로 생성한다:
   ```markdown
   # Asgard Lore — Project Context

   ## Project Summary
   (사용자에게 프로젝트 목적을 한 문장으로 물어본다)

   ## Current Phase
   Phase 1 — 초기 설정

   ## Tech Stack
   (사용할 기술 스택)

   ## Key File Locations
   - CLAUDE.md: Odin 헌법
   - AGENTS.md: 에이전트 규칙서
   - artifacts/INDEX.md: 작업 상태 추적 (SSoT)
   - artifacts/handoff/: TP/RP 교환소
   - shared/context.md: 이 파일 (공유 맥락)

   ## Recent Progress
   (없음 — 프로젝트 시작)

   ## Active Constraints
   (없음)
   ```

5. **확인 메시지 출력**

   ```
   Asgard 프로젝트 초기화 완료.

   다음 단계:
   1. shared/context.md에 프로젝트 목적을 기술하세요.
   2. /plan "첫 번째 작업 설명"으로 TP-001을 만드세요.
   3. /delegate TP-001로 Brokkr를 소환하세요.
   ```

## Notes

- 기존 파일이 있으면 덮어쓰지 않는다.
- src/ 폴더 구조는 프로젝트마다 다르므로 /init에서 생성하지 않는다.
