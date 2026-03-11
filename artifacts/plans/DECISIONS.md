# Asgard Edicts — Design Decisions

(Options / Chosen / Rationale / Tradeoffs / Review Condition 형식으로 기록)

---

## Decision 1: Python 오케스트레이터 -> Claude Code 네이티브 전환

- **Date**: 2026-03-04
- **Options**:
  - A) Python orchestrator.py가 양쪽 CLI를 subprocess로 조종
  - B) Claude Code가 기획의 주체, Codex/Gemini는 외부 호출
- **Chosen**: B
- **Rationale**:
  - Python 계층이 Claude Code의 내장 기능(파일 접근, 도구 실행, 컨텍스트 관리)을 중복 구현
  - CLI subprocess 호출이 불안정 (출력 형식 변동, JSON 파싱 실패)
  - Claude Code의 CLAUDE.md + Skills + Hooks가 오케스트레이션 기능을 이미 제공
- **Tradeoffs**: Python의 완전 자동화(unattended cycle) 일부 포기. 대신 안정적 컨텍스트 관리 확보.
- **Review Condition**: API 키를 추가하여 LangGraph로 전환할 때

---

## Decision 2: Skill 기반 워크플로 채택

- **Date**: 2026-03-04
- **Options**:
  - A) .claude/commands/에 단순 커맨드만 정의
  - B) .claude/skills/에 SKILL.md로 정의 (자동 트리거 + 맥락 매칭)
- **Chosen**: B
- **Rationale**: Skills는 description 기반 자동 트리거 지원. 지원 파일 포함 가능. 명시적 /slash 호출도 가능.
- **Tradeoffs**: 자동 트리거 오작동 가능성. description을 신중하게 작성 필요.
- **Review Condition**: 자동 트리거 오작동이 빈번할 때

---

## Decision 3: Hook은 PostToolUse 비블록 방식 사용

- **Date**: 2026-03-04
- **Options**:
  - A) PreToolUse로 src/ 수정을 블록
  - B) PostToolUse로 로깅 + 비블록 경고만
- **Chosen**: B
- **Rationale**: PreToolUse 블로킹은 에이전트를 좌절시켜 품질 저하 유발. "완료 후 검증"이 "실행 전 차단"보다 효과적.
- **Policy**: PreToolUse block 금지. warn-only 허용. PostToolUse 로깅은 항상 exit 0.
- **Tradeoffs**: Brain의 src/ 직접 수정을 기술적으로 차단하지 못함. CLAUDE.md 규칙 + 경고로 행동 유도.
- **Review Condition**: Brain의 src/ 직접 수정이 반복될 때

---

## Decision 4: Codex CLI 동기 실행으로 시작

- **Date**: 2026-03-04
- **Options**:
  - A) Bash 도구에서 동기 실행
  - B) delegate.sh로 백그라운드 실행
  - C) watchdog.sh로 파일 감시 + 자동 알림
- **Chosen**: A (동기 실행)
- **Rationale**: 초기에는 각 단계의 결과를 즉시 확인하는 것이 학습에 유리. 동기 실행으로 프로토콜 검증 후 비동기 전환.
- **Tradeoffs**: Codex 실행 중 Claude Code 세션 대기. 복잡한 작업은 타임아웃 위험.
- **Review Condition**: 단일 TP 실행이 10분+를 넘길 때

---

## Decision 5: Brain/Hands 분리 기준 50줄

- **Date**: 2026-03-04
- **Options**: A) 모든 코드 Codex 위임, B) 50줄 이하 Claude 직접, C) 100줄 기준
- **Chosen**: B
- **Rationale**: 작은 설정 파일까지 Codex 호출 시 오버헤드. 50줄은 한 화면에 보이는 양 = 검토 가능한 범위.
- **Tradeoffs**: 줄 수가 아닌 복잡도로 판단해야 할 때도 있음.
- **Review Condition**: Claude가 40줄 코드를 잘못 작성하는 경우가 반복될 때

---

## Decision 6: Saga(RP) 포맷 .md 단일화

- **Date**: 2026-03-06
- **Options**: A) .json 출력, B) .md 출력, C) 병행
- **Chosen**: B (.md 단일화)
- **Rationale**: Claude Code가 마크다운을 자연스럽게 읽고 검토. 별도 파싱 로직 불필요. 사람이 직접 읽고 편집 가능.
- **Tradeoffs**: 구조화된 데이터 파싱은 텍스트 파싱으로 대응.
- **Review Condition**: 자동 RP 파싱이 필요한 시스템 추가 시

---

## Decision 7: Asgard 테마 하이브리드 채택

- **Date**: 2026-03-06
- **Options**:
  - A) 모든 파일명과 Skill 이름을 Asgard 테마 적용
  - B) 에이전트 이름만 신화 테마, 파일/Skill은 기능 기반 (/plan, /delegate 등)
  - C) 이름만 내부에서 사용
- **Chosen**: B
- **Rationale**: 에이전트 캐릭터성(Odin/Brokkr/Heimdall)은 유지하되, 파일/Skill 이름은 기능으로 직관성 확보.
- **Tradeoffs**: 완전한 몰입감은 아님. 하지만 신규 참여자 이해 비용 최소화.
- **Review Condition**: 없음

---

## Decision 8: Olympus에서 Asgard로 테마 전환

- **Date**: 2026-03-06
- **Options**:
  - A) Olympus(그리스 신화) 테마 유지
  - B) Asgard(북유럽 신화) 테마로 전환
- **Chosen**: B
- **Rationale**: 북유럽 신화의 역할 분담이 시스템 구조와 더 정확히 매핑됨. Odin(전략가)→Brokkr(장인)→Heimdall(관측자)의 관계가 Brain→Code→Vision 구조에 자연스럽게 대응. Loki(변환자)로 향후 이미지 생성 에이전트 확장 가능.
- **Tradeoffs**: 기존 Olympus 참조 코드/문서와의 호환성 단절. GitHub 저장소명 변경 필요.
- **Review Condition**: 없음

---

## Decision 9: Plan B — Clean Architecture 기반 AI Brain 구현

- **Date**: 2026-03-12
- **Options**:
  - A) 기존 domain/ 구조 위에 바로 AI Brain 추가 (빠르지만 결합도 높음)
  - B) Clean Architecture 레이어 도입 후 AI Brain 추가 (시간 더 걸리지만 확장성 확보)
  - C) 완전 재작성 (과도함)
- **Chosen**: B
- **Rationale**: 현재 domain/ 코드는 파일 I/O와 비즈니스 로직이 혼재. AI Brain(LLM Gateway)을 깔끔하게 추가하려면 Repository Pattern + Use Case Layer가 필수. core/는 순수 도메인(외부 의존성 제로), adapters/는 구현체 분리.
- **Tradeoffs**: 4개 Phase로 나눠야 하므로 AI 기능 도달까지 시간 소요. 하지만 각 Phase가 독립적으로 검증 가능.
- **Review Condition**: core/ 내부에 fs/path/child_process import가 발견되면 구조 재검토

---

## Decision 10: DI 전략 — Simple Factory (프레임워크 미사용)

- **Date**: 2026-03-12
- **Options**:
  - A) InversifyJS / tsyringe 등 DI 프레임워크 사용
  - B) Simple Factory 패턴 (di/container.ts에서 수동 조립)
  - C) 글로벌 싱글톤
- **Chosen**: B
- **Rationale**: 현재 규모(서버 파일 ~30개)에서 DI 프레임워크는 과도. Factory 패턴으로 충분히 테스트 가능한 구조 확보. 데코레이터 의존 없이 순수 TypeScript.
- **Tradeoffs**: 의존성 수가 크게 늘면 factory 코드가 비대해질 수 있음.
- **Review Condition**: 의존성 생성 코드가 50줄 이상 되면 프레임워크 도입 검토
