# Changelog

이 프로젝트의 주요 변경사항을 기록합니다.
형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)

## [0.2.4] - 2026-03-09

### Added
- **Pino 구조화 로깅** — `server/logger.ts` 생성, 전 서버 모듈에 child logger 적용
  - 개발: pino-pretty (컬러, 타임스탬프, PID 숨김)
  - 프로덕션: JSON 포맷
  - `LOG_LEVEL` 환경변수로 레벨 제어

### Changed
- `server/` 내 `console.log/warn/error` 직접 호출 전부 제거 → Pino logger 사용
- **FlowView** — TP→Agent→RP 3단계 파이프라인 시각화 (CSS/SVG, 상태 색상)
- **StatsPanel** — 태스크 통계 대시보드 (완료율, 에이전트별/상태별 분포 바 차트)
- page.tsx에 `flow`, `stats` 탭 추가 (총 5개 탭)

## [0.2.3] - 2026-03-09

### Added
- **`scripts/archive-done.sh`** — done 태스크 자동 아카이빙 (Active→Completed 이동 + 파일 복사)
- **retry 버저닝** — retry Skill에 RP-NNN-attempt{N}.md 백업 절차 추가
- `install.sh`에 archive-done.sh 포함

### Changed
- `/review` Skill이 `archive-done.sh`를 사용하도록 업데이트
- INDEX.md: 5개 완료 태스크를 Completed 테이블로 이동
- **DocViewer 비교 모드** — TP↔RP side-by-side 비교 (토글 버튼)
- **GitHub Actions CI** — push/PR 시 test + build 자동 실행
- **Docker 지원** — Dockerfile + docker-compose.yml (Yggdrasil 컨테이너화)

## [0.2.2] - 2026-03-09

### Added
- **동시 실행 Lock** — `mkdir` 기반 atomic lock (stale lock 자동 회수, macOS/Linux 호환)
- **로그 로테이션** — `execution.log` 1MB 초과 시 자동 로테이션 (최대 5개 백업)
- **태스크 검색/필터** — Chronicle에 텍스트 검색 + 6개 상태 필터 버튼
- **브라우저 알림** — 에이전트 done/blocked 전환 시 Notification API 알림
- `watcher.ts` 로그 타임스탬프 파싱 (`YYYY-MM-DD HH:MM` 추출)
- `watcher.ts` `unlink` 이벤트로 stale fileOffsets 자동 정리

### Changed
- `parseIndex()` 테이블 헤더 감지: case-insensitive 정규식으로 개선
- `parseIndex()` status 필드 `toLowerCase()` 적용
- `parseDocument()` 빈 catch → ENOENT 구분 에러 로깅

## [0.2.1] - 2026-03-09

### Added
- **Vitest 테스트 프레임워크** — 단위 테스트 20개 (parser, agents, constants)
- `dashboard/lib/constants.ts` — 에이전트 설정 중앙화 (SSoT)
- `GET /api/health` — 서버 헬스체크 엔드포인트
- WebSocket heartbeat (30초 ping/pong) — 좀비 연결 자동 제거
- DocViewer ESC 키보드 핸들러

### Changed
- 에러 핸들링 전면 개선: 빈 `catch {}` 14건 → 구조화된 에러 로깅 (ENOENT 구분)
- `agents.ts`: EPERM 에러를 프로세스 alive로 올바르게 처리
- `getWsBase()`: HTTPS 환경에서 wss:// 자동 판별
- 8개 컴포넌트의 하드코딩된 색상/이름/모델 → `constants.ts` 참조로 교체
- `package.json` version 0.2.0 → 0.2.1, `test`/`test:watch` 스크립트 추가

### Fixed
- WebSocket 초기 데이터 전송 시 `readyState` 미체크 → 체크 추가
- `watcher.ts` chokidar error 이벤트 미핸들링 → 리스너 추가

## [0.2.0] - 2026-03-09

### Added
- **Yggdrasil 대시보드** — 에이전트 실시간 모니터링 시스템
  - Next.js 15 + React 19 + Tailwind CSS 4 프론트엔드
  - Express 5 + WebSocket 백엔드 (실시간 로그/상태 스트리밍)
  - Chokidar 기반 파일 감시 (INDEX.md, 로그, PID 파일)
  - Overview 탭: 에이전트 상태 카드, Chronicle, 실시간 로그
  - Terminals 탭: 에이전트별 터미널 뷰 (로그 분리)
  - Skills 탭: 12개 내장 Skill 카탈로그 (카테고리 필터, 상세 정보)
  - DocViewer: TP/RP 마크다운 슬라이드 패널 뷰어
  - WebSocket 자동 재연결 (3초 간격)
- `scripts/demo-simulator.sh` — 대시보드 데모용 시뮬레이터
- `artifacts/plans/PROJECT-REVIEW.md` — v0.1.0 프로젝트 종합 검토 보고서
- `asgard dashboard` CLI 명령어 — Yggdrasil 대시보드 실행

### Changed
- `.gitignore` 업데이트: `src/yggdrasil/` 대시보드 코드 추적 포함
- README.md 전면 개편: Yggdrasil 대시보드 섹션 추가, Skills 카테고리별 정리
- `install.sh` 업데이트

## [0.1.1] - 2026-03-06

### Added
- `/retry` Skill — 실패한(blocked) TP 재실행 지원
- `/validate` Skill — TP 포맷/품질 자동 검증
- `scripts/delegate-codex.sh` — Brokkr(Codex) 실행 래퍼 + Watchdog 보호
- Saga(RP) approved 시 `artifacts/archive/`로 자동 아카이빙
- `asgard doctor` 프로젝트 레벨 진단 (CLAUDE.md, INDEX.md 등 확인)
- `CONTRIBUTING.md` — 기여 가이드
- `CHANGELOG.md` — 변경 이력 추적

### Changed
- `/delegate` Skill이 `delegate-codex.sh` 래퍼를 사용하도록 변경
- `install.sh`에 delegate-codex.sh, retry, validate 설치 포함
- README.md에 실전 사이클 예시, 신규 Skills 추가
- ChatGPT Pro → ChatGPT Plus로 구독 요구사항 수정

### Fixed
- `.gitignore` Olympus 잔재 → Asgard로 수정
- `RP-001.md` "Context Digest (for Athena)" → "(for Odin)" 수정

## [0.1.0] - 2026-03-06

### Added
- Odin(Claude Code) + Brokkr(Codex CLI) + Heimdall(Gemini CLI) 멀티모델 오케스트레이션
- 파일 기반 계약: Rune(TP) / Saga(RP) 포맷
- Skills: /plan, /delegate, /delegate-gemini, /chain, /scout, /team, /review, /digest, /status
- `scripts/delegate-gemini.sh` Watchdog 보호 래퍼
- `install.sh` 원격/로컬 설치 지원
- `asgard` CLI (new, update, doctor)
- AGENTS.md 에이전트 규칙서
- PostToolUse 로깅 Hooks
