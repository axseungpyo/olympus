# Contributing to Asgard

Asgard에 기여해주셔서 감사합니다!

## 개발 환경 설정

1. 저장소 클론
   ```bash
   git clone https://github.com/axseungpyo/asgard.git
   cd asgard
   bash install.sh
   ```

2. 필수 도구
   - Claude Code (Claude Pro/Team 구독)
   - Codex CLI (ChatGPT Plus 구독)
   - Gemini CLI (`npm install -g @google/gemini-cli`)

## 기여 방법

### 새 Skill 추가

1. `.claude/skills/{skill-name}/SKILL.md` 생성
2. YAML 프론트매터 포함:
   ```yaml
   ---
   name: skill-name
   description: >
     Skill 설명. 트리거 키워드 목록.
   allowed-tools: Read, Write, Bash, Glob
   ---
   ```
3. `install.sh`의 SKILLS 배열에 추가 (4곳: L67, L90, L315, L358 근처)
4. `README.md` Skills 목록 테이블에 추가

### 새 에이전트 추가

1. `AGENTS.md`에 에이전트 섹션 추가 (Mission, Rules, Modes, Prohibitions)
2. `The_Asgard.md`에 페르소나 설계 추가
3. `CLAUDE.md`의 Agent Routing Table에 추가
4. 필요 시 래퍼 스크립트 `scripts/delegate-{name}.sh` 생성

### PR 규칙

- 브랜치: `feat/{description}`, `fix/{description}`, `docs/{description}`
- 커밋 메시지: 영문, 명령형 현재시제 (예: "add retry skill")
- PR 설명에 변경 이유와 테스트 방법 포함

## 이슈 리포트

GitHub Issues를 사용하세요:
- **Bug**: 재현 절차, 기대 동작, 실제 동작
- **Feature**: 사용 시나리오, 기대 효과

## 코드 스타일

- Shell 스크립트: `set -euo pipefail`, ShellCheck 준수
- Markdown: ATX 헤더(#), 테이블 정렬
- SKILL.md: YAML 프론트매터 필수

## 라이선스

기여하신 코드는 MIT 라이선스로 배포됩니다.
