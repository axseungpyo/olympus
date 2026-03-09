# Changelog

이 프로젝트의 주요 변경사항을 기록합니다.
형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)

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
