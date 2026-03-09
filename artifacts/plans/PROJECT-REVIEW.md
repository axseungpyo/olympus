# Asgard Project Review — v0.1.0 객관적 검토 보고서

Date: 2026-03-09
Reviewer: Odin (Brain Agent)

---

## 1. 프로젝트 개요

Asgard는 Claude Code(Odin)를 Brain Agent로, Codex CLI(Brokkr)와 Gemini CLI(Heimdall)를 Hands Agent로 활용하는 멀티에이전트 오케스트레이션 시스템이다. 파일 기반 계약(Rune/Saga)으로 에이전트 간 통신하며, API 키 없이 CLI 구독만으로 동작한다.

**현재 상태:** Phase 1 인프라 구축 완료, 실전 사이클 5회 완료 (TP-001 ~ TP-005)

---

## 2. 강점 (Strengths)

### 2.1 아키텍처 설계
- **파일 기반 SSoT**: INDEX.md + Rune/Saga 패턴으로 모든 상태가 파일에 기록되어 감사 추적 가능
- **계약 기반 핸드오프**: TP 없이는 에이전트 호출 불가 — 무분별한 작업 방지
- **관심사 분리**: Brain(기획) / Hands-Code(구현) / Hands-Vision(비전) 역할 명확
- **DECISIONS.md**: 8개 설계 결정이 근거와 트레이드오프 포함 기록 — 의사결정 이력 우수

### 2.2 Watchdog 보호 시스템
- delegate-codex.sh: 600s 타임아웃, 120s stall 감지, 5MB 로그 제한, 에러 루프 감지
- delegate-gemini.sh: 300s 타임아웃, 60s stall 감지, 2MB 로그 제한
- RP 미작성 시 자동 fallback (로그에서 추출 또는 래핑)

### 2.3 개발자 경험 (DX)
- `/plan`, `/delegate`, `/review` 등 11개 Skill로 워크플로우 표준화
- `asgard new`, `asgard doctor`, `asgard update` CLI 제공
- Yggdrasil 대시보드로 실시간 모니터링 가능

### 2.4 확장성
- 새 에이전트 추가 용이 (Loki 예약됨)
- Skill 기반 구조로 기능 추가 독립적
- Mode 시스템 (Spark/Anvil/Mjolnir/Ragnarok)으로 작업 강도 조절

---

## 3. 문제점 (Problems)

### 3.1 [Critical] 테스트 코드 부재
- **현황**: 프로젝트 전체에 테스트 파일 0개 (node_modules 제외)
- **영향**: parser.ts, agents.ts, watcher.ts 등 핵심 로직의 정확성 검증 불가
- **위험**: parseIndex() 정규식이 edge case에서 실패할 수 있으나 감지 불가
- **권장**: Jest/Vitest 도입, parser·agents·watcher 단위 테스트 최소 작성

### 3.2 [Critical] 보안 취약점
- **WebSocket 인증 없음**: `/ws/logs`, `/ws/status` 엔드포인트에 어떤 인증도 없음. 같은 네트워크의 누구나 실시간 로그 열람 가능
- **CORS 설정 없음**: Express에 CORS 미들웨어 미적용, API 무제한 접근 가능
- **Rate Limiting 없음**: `/api/*` 엔드포인트에 요청 제한 없음
- **Path Traversal 부분 대응**: routes.ts에 `startsWith(artifactsDir)` 체크 있으나, `../` 포함 경로의 resolve 결과만 검사 — 추가 검증 필요
- **install.sh curl | bash 패턴**: 업계 표준이지만, 다운로드 중 변조 검증(체크섬) 없음

### 3.3 [High] 에러 핸들링 미흡
- 서버 전체에서 `catch {}` (빈 catch) 패턴 14회 사용
- watcher.ts: 파일 읽기 실패 시 모든 에러를 무시 — 디스크 권한 문제, 파일 손상 등 감지 불가
- agents.ts: `process.kill(pid, 0)` 실패 시 모든 에러를 "프로세스 없음"으로 처리 — EPERM(권한 부족)도 무시됨
- WebSocket 연결 실패 시 클라이언트에 에러 원인 미전달

### 3.4 [High] 하드코딩된 설정값
- 에이전트 색상: `#d97757`, `#10a37f`, `#4285f4`가 최소 6개 파일에 중복 정의
  - `AgentCard.tsx`, `LiveLog.tsx`, `TerminalPanel.tsx`, `Chronicle.tsx`, `SkillsPanel.tsx`, `page.tsx`, `agents.ts`, `globals.css`
- 모델명: `"Claude Opus 4.6"`, `"GPT-5.4"`, `"Gemini 3.1 Pro"`가 `page.tsx`와 `AgentCard.tsx`에 각각 하드코딩
- WS_BASE: `ws://${window.location.hostname}:7777` 하드코딩 — HTTPS 환경에서 동작 불가

### 3.5 [Medium] INDEX.md 파싱 취약성
- parseIndex()가 `| ID` 또는 `| id`로 시작하는 줄만 테이블 헤더로 인식
- 사용자가 테이블 순서를 변경하면 파싱 실패
- `cells.length >= 6` 체크만으로 데이터 무결성 보장 불가
- status 캐스팅이 `as TaskStatus`로 unsafe — validStatuses 배열 체크는 있으나 타입 안전하지 않음

### 3.6 [Medium] 로그 타임스탬프 부정확
- watcher.ts `handleLogChange()`: 로그의 실제 타임스탬프가 아닌 `Date.now()` 사용
- 파일 변경 감지 시점의 현재 시간을 기록하므로, 일괄 기록된 로그의 타임스탬프가 모두 동일
- 로그 파일 자체의 타임스탬프 파싱 로직 없음

### 3.7 [Medium] 메모리 관리
- `page.tsx`: logs 배열이 MAX_LOGS(500)으로 제한되지만, 매번 `[...prev, msg.data]` spread 후 slice — O(n) 복사 반복
- `watcher.ts`: fileOffsets Map이 삭제된 파일의 항목을 정리하지 않음
- `getRecentLogs()`: 각 로그 파일에서 tailFile() 호출 시 전체 파일을 메모리에 로드

---

## 4. 보완점 (Improvements)

### 4.1 대시보드 기능 부족
- **검색/필터**: Chronicle에서 태스크 검색, 상태 필터 없음
- **페이지네이션**: 태스크가 많아지면 성능 저하 — 가상 스크롤 또는 페이지네이션 필요
- **반응형 미흡**: 모바일에서 grid 레이아웃이 깨질 가능성 (md:grid-cols-3 사용)
- **키보드 단축키**: DocViewer에 ESC 키 핸들러 없음 (버튼만 존재)
- **다크/라이트 모드**: 다크 모드만 지원

### 4.2 Skill 시스템 개선
- **실행 이력**: Skill 실행 결과가 artifacts/logs/execution.log에만 한 줄로 기록 — 상세 이력 부족
- **Skill 파라미터 검증**: /delegate가 존재하지 않는 TP-ID를 받아도 Skill 레벨에서 검증 없음 (스크립트에서 catch)
- **Skill 체이닝**: `/chain`은 있으나, 3개 이상 에이전트 체인 미지원
- **Skill 취소**: 실행 중인 delegate를 취소하는 메커니즘 없음 (PID kill만 가능)

### 4.3 파일 구조 개선
- `artifacts/handoff/`에 TP와 RP가 혼재 — 수십 개 쌓이면 관리 어려움
- Completed Tasks가 INDEX.md의 별도 테이블이지만 실제로는 비어있음 — done 상태 태스크 아카이빙 미구현
- `shared/context.md`의 "Recent Progress" 섹션이 비어있음 — /digest가 실행된 적 없음

### 4.4 설치 스크립트 개선
- `install.sh`에서 `for arg in "${@:-}"` 구문이 set -u와 충돌 가능
- 원격 모드에서 개별 파일 다운로드 — 느림. tar.gz 단일 아카이브 권장
- 업데이트 시 기존 프로젝트의 로컬 scripts/ 자동 갱신 없음

### 4.5 TypeScript 엄격성
- `tsconfig.json` 미확인 — strict 모드 설정 여부 불명
- `as TaskStatus` 타입 캐스팅 사용 — 런타임 안전성 미보장
- WebSocket 메시지 타입이 `unknown`에서 `as WSMessage`로 캐스팅 — 유효성 검사 없음

---

## 5. 취약점 (Vulnerabilities)

### 5.1 에이전트 실행 안정성
- **PID 파일 경쟁 조건**: 두 delegate가 동시 실행되면 같은 에이전트의 PID 파일을 덮어쓸 수 있음
- **좀비 프로세스**: watchdog이 프로세스를 kill한 후 .pid 파일 삭제가 보장되지 않음 (SIGTERM vs SIGKILL)
- **동시 실행 제어 없음**: 같은 에이전트를 동시에 두 번 호출하는 것을 방지하는 lock 메커니즘 없음

### 5.2 데이터 무결성
- **INDEX.md 동시 쓰기**: Odin과 Skill이 동시에 INDEX.md를 수정하면 데이터 손실 가능
- **RP 파일 덮어쓰기**: 같은 TP-ID로 retry 시 이전 RP-NNN.md가 덮어써짐 — 이전 시도의 기록 소실
- **로그 파일 로테이션 없음**: 로그 파일이 무한 증가 — 디스크 공간 고갈 가능

### 5.3 네트워크 계층
- **WebSocket 재연결**: 클라이언트의 3초 재연결은 있으나, 서버 측 heartbeat/ping 없음 — 좀비 연결 감지 불가
- **HTTP Only**: HTTPS/WSS 미지원 — 로컬 전용이라면 OK, 원격 접속 시 취약
- **ASGARD_ROOT 추론**: `path.resolve(process.cwd(), "../..")` — 서버 실행 위치에 의존적

### 5.4 운영 안정성
- **프로세스 관리자 없음**: pm2, systemd 등 없이 raw node 프로세스로 실행
- **헬스체크 엔드포인트 없음**: 서버 상태 확인 불가
- **로그 수준 제어 없음**: 모든 로그가 console.log — 프로덕션에서 noise 발생
- **graceful shutdown**: watcher.stop()과 server.close()가 순차적이지만, 진행 중인 WS 메시지 처리 보장 없음

---

## 6. 추가 개발 사항 (Roadmap)

### Phase 2: 안정화 (Stability)

| Priority | Task | Description | Effort | Status |
|----------|------|-------------|--------|--------|
| P0 | 테스트 프레임워크 | Vitest 도입, parser/agents/constants 단위 테스트 20개 | 2일 | **v0.2.1 완료** |
| P0 | 에러 핸들링 개선 | 빈 catch 14건 제거, ENOENT/EPERM 구분, 구조화된 로깅 | 1일 | **v0.2.1 완료** |
| P0 | 설정 중앙화 | constants.ts 생성, 8개 파일 중복 제거 | 0.5일 | **v0.2.1 완료** |
| P1 | 동시 실행 Lock | mkdir 기반 에이전트 동시 실행 방지 (stale lock 자동 회수) | 1일 | **v0.2.2 완료** |
| P1 | 로그 로테이션 | execution.log 1MB 초과 시 자동 로테이션 (최대 5개) | 0.5일 | **v0.2.2 완료** |
| P1 | WS 인증 | 토큰 기반 WebSocket 인증 (로컬 토큰 파일) | 1일 | → Phase 5 이동 |

### Phase 3: 대시보드 고도화 (Dashboard v2)

| Priority | Task | Description | Effort | Status |
|----------|------|-------------|--------|--------|
| P1 | ESC 키보드 핸들러 | DocViewer에 ESC 키 닫기 추가 | 0.5시간 | **v0.2.1 완료** |
| P1 | 태스크 검색/필터 | Chronicle 검색 + 상태 필터 | 1일 | **v0.2.2 완료** |
| P1 | 알림 시스템 | 에이전트 완료/실패 시 브라우저 Notification | 0.5일 | **v0.2.2 완료** |
| P2 | 실행 흐름 시각화 | FlowView — TP→Agent→RP 파이프라인 시각화 | 2일 | **v0.2.4 완료** |
| P2 | Skill 실행 UI | 대시보드에서 직접 /plan, /delegate 트리거 | 3일 | **v0.2.5 완료** |
| P2 | 비교 뷰어 | DocViewer에 TP↔RP side-by-side 비교 모드 추가 | 1일 | **v0.2.3 완료** |
| P3 | 모바일 반응형 | ASCII art 모바일 숨김, DocViewer 전체폭 | 2일 | **v0.2.3 완료** |
| P3 | 통계 대시보드 | StatsPanel — 완료율, 에이전트별/상태별 분포 | 2일 | **v0.2.4 완료** |

### Phase 4: 프로토콜 확장 (Protocol v2)

| Priority | Task | Description | Effort | Status |
|----------|------|-------------|--------|--------|
| P1 | TP 버저닝 | retry 시 RP-NNN-attempt{N}.md + 로그 백업으로 이력 보존 | 1일 | **v0.2.3 완료** |
| P1 | Completed 아카이빙 | `archive-done.sh` — Active→Completed 자동 이동 + 파일 복사 | 0.5일 | **v0.2.3 완료** |
| P2 | 의존성 그래프 | TP 간 depends-on 필드 추가, DAG 기반 실행 순서 | 3일 | **v0.2.6 완료** |
| P2 | 우선순위 시스템 | /plan Skill에 P0~P3 priority 체계 도입 | 1일 | **v0.2.3 완료** |
| P2 | 롤백 메커니즘 | 실패 시 git revert 기반 자동 롤백 | 2일 | **v0.2.7 완료** |
| P3 | Loki 에이전트 | 이미지 생성 전문 에이전트 (Nano Banana API) | 3일 | 미진행 |
| P3 | 멀티 프로젝트 | 하나의 Yggdrasil에서 여러 프로젝트 관리 | 5일 | 미진행 |

### Phase 5: 운영 (Operations)

| Priority | Task | Description | Effort | Status |
|----------|------|-------------|--------|--------|
| P1 | 헬스체크 API | `GET /api/health` 엔드포인트 추가 | 0.5시간 | **v0.2.1 완료** |
| P2 | Docker 지원 | Dockerfile + docker-compose.yml | 1일 | **v0.2.3 완료** |
| P2 | CI/CD | GitHub Actions: test + build on push/PR | 1일 | **v0.2.3 완료** |
| P2 | 구조화된 로깅 | Pino 도입, JSON/pretty 로그 포맷 | 1일 | **v0.2.4 완료** |
| P3 | 원격 접속 | HTTPS + WSS + 기본 인증 | 2일 | 미진행 |
| P3 | 메트릭 수집 | 에이전트 실행 시간, 성공률 등 수집 + 시각화 | 3일 | 미진행 |

---

## 7. 코드 품질 점수

| 카테고리 | 점수 | 비고 |
|---------|------|------|
| 아키텍처 설계 | 9/10 | Brain/Hands 분리, 파일 기반 계약 패턴 우수 |
| 코드 구조 | 7/10 | 컴포넌트 분리 양호, 중복 상수가 다수 |
| 타입 안전성 | 6/10 | TypeScript 사용하나 unsafe 캐스팅 다수 |
| 에러 핸들링 | 3/10 | 빈 catch 14개, 에러 무시 패턴 과다 |
| 테스트 커버리지 | 0/10 | 테스트 코드 전무 |
| 보안 | 4/10 | 기본적 path traversal 방어만, 인증/CORS 없음 |
| 문서화 | 8/10 | CLAUDE.md, AGENTS.md, DECISIONS.md 등 우수 |
| DX (개발자 경험) | 8/10 | CLI 도구, Skill 시스템, 대시보드 완성도 높음 |
| 운영 준비도 | 3/10 | 프로세스 관리, 로깅, 모니터링 미비 |
| **종합** | **5.3/10** | **v0.1.0 프로토타입으로는 양호, 프로덕션에는 부족** |

---

## 8. 즉시 조치 권장 사항 (Quick Wins)

아래 항목은 1일 이내에 완료 가능하며, 프로젝트 품질을 크게 개선한다:

1. ~~**설정 중앙화** — `dashboard/lib/constants.ts` 생성~~ **v0.2.1 완료**
2. ~~**빈 catch 개선** — 구조화된 에러 로깅으로 교체~~ **v0.2.1 완료**
3. ~~**DocViewer ESC 키** — `useEffect` + `keydown` 이벤트 리스너~~ **v0.2.1 완료**
4. ~~**헬스체크 API** — `GET /api/health`~~ **v0.2.1 완료**
5. ~~**WS_BASE 수정** — `getWsBase()` 함수로 프로토콜 동적 판별~~ **v0.2.1 완료**

---

## 9. 결론

Asgard v0.1.0은 **설계 철학과 아키텍처 품질이 뛰어난 프로토타입**이다. 파일 기반 계약 패턴, Brain/Hands 역할 분리, Skill 시스템 등의 설계는 멀티에이전트 오케스트레이션의 핵심 문제를 잘 해결한다.

그러나 **엔지니어링 성숙도 측면에서 보완이 필요**하다. 테스트 부재, 에러 핸들링 미흡, 보안 기본기 부족이 가장 시급한 과제다. Phase 2(안정화)를 통해 이 기반을 다지면, Phase 3~5의 기능 확장이 안전하게 진행될 수 있다.

**우선순위 요약:**
1. 테스트 프레임워크 + 핵심 로직 단위 테스트 (P0)
2. 에러 핸들링 체계화 (P0)
3. 설정 중앙화로 중복 제거 (P0)
4. 동시 실행 제어 + 로그 로테이션 (P1)
5. 대시보드 UX 고도화 (P1~P2)
