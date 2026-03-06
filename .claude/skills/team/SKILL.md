---
name: team
description: >
  Claude Code Agent Teams(실험적 기능)를 활용하여 여러 Claude 인스턴스를
  팀으로 구성하고 병렬 협업을 수행한다.
  "team", "팀 에이전트", "에이전트 팀", "팀 구성", "병렬 Claude",
  "멀티 Claude", "팀 작업" 등에 트리거.
  scout(서브에이전트)와 달리 팀원이 서로 직접 소통하며, 각자 독립적으로 코드를 수정할 수 있다.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# /team — Claude Agent Teams (실험적 기능)

## 전제 조건

이 기능은 Claude Code의 **실험적 Agent Teams** 기능을 사용한다.
`.claude/settings.json`에 다음 설정이 필요하다:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "auto"
}
```

## /scout vs /team 차이

| 항목 | /scout (서브에이전트) | /team (팀 에이전트) |
|------|---------------------|-------------------|
| 구조 | 부모-자식 (보고만 함) | 동료 (서로 소통) |
| 코드 수정 | 불가 (읽기 전용) | 가능 |
| 소통 방식 | 부모에게만 결과 반환 | 팀원 간 직접 메시지 |
| 작업 관리 | 없음 | 공유 태스크 리스트 |
| 표시 방식 | 인라인 | tmux/iTerm2 분할 또는 인라인 |
| 용도 | 정보 수집, 탐색 | 대규모 병렬 구현, 멀티파일 작업 |

## 모드

### 1. Spawn 모드 (기본)

`$ARGUMENTS`가 자유 텍스트일 때. 팀원을 구성하고 작업을 분배한다.

```
/team "인증 모듈과 API 라우트를 동시에 구현해줘"
/team "프론트엔드 3페이지를 병렬로 만들어줘"
```

**실행 방법:**

1. 사용자 요청을 2~4개의 **독립적이고 병렬 가능한** 작업으로 분해한다.
2. 각 작업에 대해 `Agent` 도구를 **`subagent_type: "task"`**로 호출한다.

```
예시: /team "로그인 페이지와 회원가입 페이지를 동시에 만들어줘"

→ Agent 1 (task): "src/pages/login.tsx 로그인 페이지 구현. 이메일/비밀번호 폼, 유효성 검증, 로그인 API 호출."
→ Agent 2 (task): "src/pages/signup.tsx 회원가입 페이지 구현. 이메일/비밀번호/이름 폼, 유효성 검증, 회원가입 API 호출."
```

3. 모든 팀원의 작업이 완료되면 결과를 종합하여 보고한다.
4. 충돌 가능성이 있는 공유 파일(예: 라우터, 설정)은 **한 팀원에게만** 할당한다.

### 2. Focus 모드

`$ARGUMENTS`가 `focus "설명"` 형태일 때. 특정 복잡한 작업에 전문 팀을 구성한다.

```
/team focus "결제 시스템 통합"
```

**실행 방법:**

1. 작업을 역할별로 분해:
   - 백엔드 API 구현 담당
   - 프론트엔드 UI 구현 담당
   - 테스트 작성 담당

2. 각 역할별로 `Agent` 도구 호출.

3. 의존성이 있는 작업은 순차 실행:
   - Phase 1: API 스키마/타입 정의 (1명)
   - Phase 2: 백엔드 + 프론트엔드 병렬 (2명)
   - Phase 3: 통합 테스트 (1명)

## Agent 도구 호출 규칙

1. **작업 간 파일 충돌 방지** — 같은 파일을 여러 팀원이 동시 수정하지 않도록 분배
2. **명확한 경계 설정** — 각 팀원에게 담당 파일/디렉토리를 명시
3. **공유 인터페이스 먼저** — 타입, 인터페이스, API 스키마는 먼저 정의 후 분배
4. **결과 검증** — 팀 작업 완료 후 통합 빌드/테스트 실행

## 주의사항

- 이 기능은 **실험적**이며 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 환경변수가 필요
- `teammateMode: "auto"`로 설정되어 있으면 tmux/iTerm2가 있을 때 자동으로 분할창 사용
- 단순 정보 수집 → `/team`이 아니라 `/scout` 사용
- 외부 CLI 위임(Codex/Gemini) → `/team`이 아니라 `/delegate` 또는 `/delegate-gemini` 사용
- `/team`은 **Claude 인스턴스 간 병렬 구현 작업** 전용
