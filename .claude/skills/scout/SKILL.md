---
name: scout
description: >
  Claude 서브에이전트를 병렬로 실행하여 코드베이스 탐색, Saga 검증, 기획 리서치를 수행한다.
  "scout", "정찰", "탐색", "병렬 분석", "코드 조사", "멀티 분석",
  "verify", "검증해줘", "코드베이스 파악" 등에 트리거.
  Odin이 직접 실행하는 내부 서브에이전트 (외부 CLI 호출 아님).
allowed-tools: Read, Write, Glob, Grep, Agent
---

# /scout — Odin 정찰대 (Claude 서브에이전트 병렬 실행)

## 역할

Odin이 판단을 내리기 전에 **Claude 서브에이전트를 병렬로** 보내어
코드베이스 탐색, Saga 검증, 기획 리서치를 수행한다.

Brokkr(Codex)/Heimdall(Gemini)와 다른 점:
- **외부 CLI가 아닌 Claude 자체 분신** — 더 빠르고 컨텍스트 공유
- **읽기 전용** — 코드를 수정하지 않고 정보만 수집
- **병렬 실행** — 독립적인 질문은 동시에 처리

## 모드

### 1. Explore 모드 (기본)

`$ARGUMENTS`가 자유 텍스트일 때.

```
/scout "src/ 디렉토리 구조와 주요 진입점 파악"
/scout "인증 관련 코드가 어디에 있는지 찾아줘"
/scout "현재 프로젝트의 의존성과 기술 스택 파악"
```

**실행 방법:**

사용자 요청을 2~4개의 독립적인 탐색 질문으로 분해한다.
각 질문을 `Agent` 도구로 병렬 실행한다.

```
예시: /scout "로그인 기능 추가를 위한 코드베이스 파악"

→ Agent 1 (Explore): "src/ 폴더 구조와 주요 파일 역할 분석"
→ Agent 2 (Explore): "기존 인증/세션 관련 코드 검색"
→ Agent 3 (Explore): "package.json 의존성과 설정 파일 분석"
```

결과를 종합하여 사용자에게 구조화된 보고를 제공한다.

### 2. Verify 모드

`$ARGUMENTS`가 `verify RP-NNN` 형태일 때.

```
/scout verify RP-003
```

**실행 방법:**

1. `artifacts/handoff/TP-NNN.md`에서 Acceptance Criteria 목록 추출
2. 각 AC를 독립적인 검증 질문으로 변환
3. AC별로 `Agent` 도구를 병렬 실행

```
예시: /scout verify RP-003 (AC가 3개인 경우)

→ Agent 1: "artifacts/research/에 PNG/JPG 이미지가 있는지 확인"
→ Agent 2: "생성된 이미지가 날씨 관련 시각 요소를 포함하는지 확인"
→ Agent 3: "RP-003.md에 이미지 경로가 명시되어 있는지 확인"
```

결과를 AC 체크리스트 형태로 보고한다:
```
Scout 검증 결과: RP-003
- [x] AC 1: 이미지 파일 존재 — PASS (logo.png, 7KB)
- [x] AC 2: 날씨 시각 요소 — PASS (구름 아이콘 확인)
- [x] AC 3: RP에 경로 명시 — PASS (line 26)

→ /review RP-003 진행 권장
```

### 3. Plan 모드

`$ARGUMENTS`가 `plan "설명"` 형태일 때.

```
/scout plan "OAuth 소셜 로그인 기능"
```

**실행 방법:**

1. 기획에 필요한 관점을 3~4개로 분해:
   - 기존 코드베이스 영향 범위
   - 기술적 선택지와 트레이드오프
   - 유사 패턴이 프로젝트에 이미 있는지
   - 필요한 파일 변경 목록 예측

2. 각 관점별로 `Agent` 도구를 병렬 실행

```
예시: /scout plan "OAuth 소셜 로그인"

→ Agent 1 (Explore): "현재 인증 체계와 사용자 모델 구조 파악"
→ Agent 2 (Explore): "OAuth 관련 기존 코드/설정 검색"
→ Agent 3 (Explore): "라우트 구조와 미들웨어 패턴 분석"
```

3. 종합 결과를 TP 작성에 바로 활용할 수 있는 형태로 보고:
```
Scout 리서치 완료: "OAuth 소셜 로그인"

[코드베이스 현황]
- 현재 인증: JWT 기반, src/auth/...
- 사용자 모델: src/models/user.js (email, password)

[영향 범위]
- 수정 필요: src/auth/strategy.js, src/models/user.js
- 신규 생성: src/auth/oauth.js, src/config/oauth.json

[기술 선택지]
- Passport.js (프로젝트에 이미 express 사용 중)
- 직접 구현 (단순하지만 유지보수 부담)

→ /plan으로 TP 작성 진행 권장
```

## Agent 도구 호출 규칙

1. **항상 `subagent_type: "Explore"`를 사용** — 서브에이전트는 탐색 전용
2. **독립적인 질문만 병렬 실행** — 의존성 있으면 순차 실행
3. **서브에이전트는 파일을 수정하지 않음** — 읽기 + 검색만
4. **결과는 구조화된 마크다운으로 종합** — 바로 다음 단계에 활용 가능

## 주의사항

- 단순한 질문 (파일 1개 확인) → `/scout` 불필요, 직접 Read 사용
- 코드 구현이 필요한 작업 → `/scout`가 아니라 `/delegate` 사용
- 이미지/비전 분석 → `/scout`가 아니라 `/delegate-gemini` 사용
- `/scout`는 **정보 수집 전용** — 판단과 실행은 Odin 본체가 직접 수행
