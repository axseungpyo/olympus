#!/bin/bash
# install.sh — Olympus 글로벌 설치 스크립트
#
# 로컬:  bash install.sh
# 원격:  curl -fsSL https://raw.githubusercontent.com/USER/olympus/main/install.sh | bash
#
# 설치 내용:
#   1. Skills -> ~/.claude/skills/ (모든 Claude Code 세션에서 사용 가능)
#   2. 코어 파일 -> ~/.olympus/ (AGENTS.md, 템플릿, 스크립트)
#   3. olympus CLI -> ~/.olympus/bin/olympus (PATH 등록)

set -euo pipefail

GITHUB_USER="axseungpyo"
GITHUB_REPO="olympus"
GITHUB_BRANCH="main"

OLYMPUS_HOME="$HOME/.olympus"
CLAUDE_DIR="$HOME/.claude"
BASE_URL="https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── 원격/로컬 실행 감지 ───
REMOTE=false
if [[ -z "${BASH_SOURCE[0]:-}" ]] || [[ "${BASH_SOURCE[0]}" == "bash" ]]; then
    REMOTE=true
fi
for arg in "${@:-}"; do
    [[ "$arg" == "--remote" ]] && REMOTE=true
    [[ "$arg" == "--local"  ]] && REMOTE=false
done

echo -e "${BOLD}Olympus 설치 시작...${NC}"
if $REMOTE; then
    echo -e "${CYAN}모드: 원격 (GitHub: ${GITHUB_USER}/${GITHUB_REPO}@${GITHUB_BRANCH})${NC}"
    if ! command -v curl &>/dev/null; then
        echo -e "${RED}오류: curl이 필요합니다.${NC}"
        exit 1
    fi
else
    OLYMPUS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo -e "${CYAN}모드: 로컬 (${OLYMPUS_SRC})${NC}"
fi
echo ""

# ─── 1. 디렉토리 생성 ───
echo -e "${CYAN}[1/5] 디렉토리 준비...${NC}"
mkdir -p "$OLYMPUS_HOME/bin"
mkdir -p "$OLYMPUS_HOME/templates"
mkdir -p "$OLYMPUS_HOME/scripts"
mkdir -p "$CLAUDE_DIR/skills"
mkdir -p "$CLAUDE_DIR/commands"

# ─── 원격 모드: 파일 다운로드 ───
if $REMOTE; then
    TMP_DIR=$(mktemp -d)
    trap "rm -rf '$TMP_DIR'" EXIT
    OLYMPUS_SRC="$TMP_DIR"

    echo -e "${CYAN}파일 다운로드 중...${NC}"
    SKILLS=(plan delegate review delegate-gemini chain digest status)
    for skill in "${SKILLS[@]}"; do
        mkdir -p "$TMP_DIR/.claude/skills/$skill"
        if curl -fsSL "$BASE_URL/.claude/skills/$skill/SKILL.md" \
               -o "$TMP_DIR/.claude/skills/$skill/SKILL.md" 2>/dev/null; then
            echo -e "   ${GREEN}↓${NC} $skill"
        else
            echo -e "   ${YELLOW}⚠${NC} $skill (다운로드 실패, 건너뜀)"
        fi
    done

    mkdir -p "$TMP_DIR/.claude/commands" "$TMP_DIR/scripts"
    curl -fsSL "$BASE_URL/.claude/commands/init.md"  -o "$TMP_DIR/.claude/commands/init.md"
    curl -fsSL "$BASE_URL/AGENTS.md"               -o "$TMP_DIR/AGENTS.md"
    curl -fsSL "$BASE_URL/CLAUDE.md"                 -o "$TMP_DIR/CLAUDE.md"
    curl -fsSL "$BASE_URL/scripts/delegate-gemini.sh" -o "$TMP_DIR/scripts/delegate-gemini.sh"
    chmod +x "$TMP_DIR/scripts/delegate-gemini.sh"
    echo ""
fi

# ─── 2. Skills 글로벌 설치 ───
echo -e "${CYAN}[2/5] Skills 글로벌 등록 (~/.claude/skills/)...${NC}"

SKILLS=(plan delegate review delegate-gemini chain digest status)
for skill in "${SKILLS[@]}"; do
    src="$OLYMPUS_SRC/.claude/skills/$skill"
    dst="$CLAUDE_DIR/skills/$skill"
    if [ -d "$src" ]; then
        cp -r "$src" "$dst"
        echo -e "   ${GREEN}✓${NC} $skill"
    else
        echo -e "   ${YELLOW}⚠${NC} $skill (소스 없음, 건너뜀)"
    fi
done

cp "$OLYMPUS_SRC/.claude/commands/init.md" "$CLAUDE_DIR/commands/init.md"
echo -e "   ${GREEN}✓${NC} /init 커맨드"

# ─── 3. 코어 파일 설치 ───
echo -e "${CYAN}[3/5] Olympus 코어 파일 설치 (~/.olympus/)...${NC}"

cp "$OLYMPUS_SRC/AGENTS.md" "$OLYMPUS_HOME/templates/AGENTS.md"
cp "$OLYMPUS_SRC/CLAUDE.md"   "$OLYMPUS_HOME/templates/CLAUDE.md"
cp "$OLYMPUS_SRC/scripts/delegate-gemini.sh" "$OLYMPUS_HOME/scripts/delegate-gemini.sh"
chmod +x "$OLYMPUS_HOME/scripts/delegate-gemini.sh"

cat > "$OLYMPUS_HOME/templates/context.md" << 'EOF'
# Olympus Lore — Project Context

Last updated: {DATE}

## Project Summary
{프로젝트 목적을 한 문장으로}

## Current Phase
Phase 1 — 초기 설정

## Tech Stack
- (사용할 기술 스택)

## Key File Locations
- CLAUDE.md: Athena 헌법
- AGENTS.md: 에이전트 규칙서
- artifacts/INDEX.md: 작업 상태 추적 (SSoT)
- artifacts/handoff/: TP/RP 교환소
- shared/context.md: 이 파일

## Recent Progress
(없음 — 프로젝트 시작)

## Active Constraints
(없음)
EOF

cat > "$OLYMPUS_HOME/templates/settings.json" << 'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import sys,json,datetime,os; d=json.load(sys.stdin); fp=d.get('tool_input',{}).get('file_path',''); is_tp_rp=any(p in fp for p in ['TP-','RP-']); os.makedirs('artifacts/logs',exist_ok=True) if is_tp_rp else None; open('artifacts/logs/execution.log','a').write(datetime.datetime.now().strftime('%Y-%m-%d %H:%M')+' [write] '+fp+'\\n') if is_tp_rp else None\" 2>/dev/null; exit 0"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import sys,json,datetime,os; d=json.load(sys.stdin); cmd=d.get('tool_input',{}).get('command',''); is_agent=any(p in cmd for p in ['codex','gemini','delegate']); os.makedirs('artifacts/logs',exist_ok=True) if is_agent else None; open('artifacts/logs/execution.log','a').write(datetime.datetime.now().strftime('%Y-%m-%d %H:%M')+' [bash] '+cmd[:120]+'\\n') if is_agent else None\" 2>/dev/null; exit 0"
          }
        ]
      }
    ]
  }
}
EOF

# 설치된 버전 저장
if [ -f "$OLYMPUS_SRC/VERSION" ]; then
    cp "$OLYMPUS_SRC/VERSION" "$OLYMPUS_HOME/VERSION" 2>/dev/null || true
fi

echo -e "   ${GREEN}✓${NC} AGENTS.md, CLAUDE.md, settings.json 템플릿"
echo -e "   ${GREEN}✓${NC} delegate-gemini.sh"

# ─── 4. olympus CLI 설치 ───
echo -e "${CYAN}[4/5] olympus CLI 설치...${NC}"

cat > "$OLYMPUS_HOME/bin/olympus" << 'OLYMPUS_CLI'
#!/bin/bash
# olympus — Olympus 프로젝트 관리 CLI
OLYMPUS_GITHUB_USER="axseungpyo"
OLYMPUS_GITHUB_REPO="olympus"
OLYMPUS_GITHUB_BRANCH="main"

OLYMPUS_HOME="$HOME/.olympus"
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
    local ver=""
    [ -f "$OLYMPUS_HOME/VERSION" ] && ver=" v$(cat "$OLYMPUS_HOME/VERSION")"
    echo -e "${BOLD}Olympus CLI${ver}${NC}"
    echo ""
    echo "Usage: olympus <command> [options]"
    echo ""
    echo "Commands:"
    echo "  new <name>    새 Olympus 프로젝트 생성"
    echo "  new .         현재 디렉토리에 Olympus 구조 추가"
    echo "  update        Skills를 GitHub 최신 버전으로 업데이트"
    echo "  doctor        설치 상태 진단"
}

cmd_new() {
    local target="${1:-.}"
    local name

    if [ "$target" = "." ]; then
        name="$(basename "$(pwd)")"
    else
        name="$target"
        mkdir -p "$target"
        cd "$target"
    fi

    echo -e "${CYAN}Olympus 프로젝트 초기화: ${BOLD}$name${NC}"
    echo ""

    mkdir -p artifacts/research artifacts/plans artifacts/handoff artifacts/logs
    mkdir -p shared scripts src .claude/commands .claude/skills

    local today
    today=$(date '+%Y-%m-%d')

    if [ ! -f "CLAUDE.md" ]; then
        cp "$OLYMPUS_HOME/templates/CLAUDE.md" "CLAUDE.md"
        echo -e "   ${GREEN}✓${NC} CLAUDE.md"
    else
        echo -e "   ${YELLOW}~${NC} CLAUDE.md (이미 존재, 유지)"
    fi

    cp "$OLYMPUS_HOME/templates/AGENTS.md" "AGENTS.md"
    echo -e "   ${GREEN}✓${NC} AGENTS.md"

    cp "$OLYMPUS_HOME/templates/settings.json" ".claude/settings.json"
    echo -e "   ${GREEN}✓${NC} .claude/settings.json"

    cp "$OLYMPUS_HOME/scripts/delegate-gemini.sh" "scripts/delegate-gemini.sh"
    chmod +x "scripts/delegate-gemini.sh"
    echo -e "   ${GREEN}✓${NC} scripts/delegate-gemini.sh"

    if [ ! -f "artifacts/INDEX.md" ]; then
        cat > "artifacts/INDEX.md" << EOF
# Olympus Chronicle — Work Status Index

Last updated: $today

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|

## Completed Tasks

| ID | Title | Agent | Completed |
|----|-------|-------|-----------|

## Next TP Number: TP-001
EOF
        echo -e "   ${GREEN}✓${NC} artifacts/INDEX.md"
    fi

    if [ ! -f "artifacts/plans/DECISIONS.md" ]; then
        cat > "artifacts/plans/DECISIONS.md" << EOF
# Olympus Edicts — Design Decisions

(Options / Chosen / Rationale / Tradeoffs / Review Condition 형식으로 기록)
EOF
        echo -e "   ${GREEN}✓${NC} artifacts/plans/DECISIONS.md"
    fi

    if [ ! -f "shared/context.md" ]; then
        sed "s/{DATE}/$today/" "$OLYMPUS_HOME/templates/context.md" > "shared/context.md"
        echo -e "   ${GREEN}✓${NC} shared/context.md"
    fi

    touch "artifacts/logs/execution.log"

    # Codex CLI는 git repo를 요구함 — 없으면 자동 초기화
    if [ ! -d ".git" ]; then
        git init -q
        git branch -m main 2>/dev/null || true
        echo -e "   ${GREEN}✓${NC} git init (Codex CLI 요구사항)"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}완료!${NC} 프로젝트 준비됨: $(pwd)"
    echo ""
    echo -e "다음 단계:"
    echo -e "  1. ${CYAN}shared/context.md${NC} 에 프로젝트 목적 기술"
    echo -e "  2. Claude Code로 이 디렉토리 열기"
    echo -e "  3. ${CYAN}/plan \"첫 번째 작업\"${NC} 으로 시작"
}

cmd_update() {
    echo -e "${CYAN}Skills 업데이트 중 (GitHub: ${OLYMPUS_GITHUB_USER}/${OLYMPUS_GITHUB_REPO})...${NC}"

    if ! command -v curl &>/dev/null; then
        echo -e "${RED}오류: curl이 필요합니다.${NC}"; exit 1
    fi

    local base_url="https://raw.githubusercontent.com/${OLYMPUS_GITHUB_USER}/${OLYMPUS_GITHUB_REPO}/${OLYMPUS_GITHUB_BRANCH}"
    local claude_dir="$HOME/.claude"
    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" EXIT

    local skills=(plan delegate review delegate-gemini chain digest status)
    for skill in "${skills[@]}"; do
        mkdir -p "$tmp_dir/$skill"
        if curl -fsSL "$base_url/.claude/skills/$skill/SKILL.md" \
               -o "$tmp_dir/$skill/SKILL.md" 2>/dev/null; then
            mkdir -p "$claude_dir/skills/$skill"
            cp "$tmp_dir/$skill/SKILL.md" "$claude_dir/skills/$skill/SKILL.md"
            echo -e "   ${GREEN}✓${NC} $skill"
        else
            echo -e "   ${YELLOW}✗${NC} $skill (다운로드 실패)"
        fi
    done

    if curl -fsSL "$base_url/scripts/delegate-gemini.sh" \
           -o "$OLYMPUS_HOME/scripts/delegate-gemini.sh" 2>/dev/null; then
        chmod +x "$OLYMPUS_HOME/scripts/delegate-gemini.sh"
        echo -e "   ${GREEN}✓${NC} delegate-gemini.sh"
    fi

    # 버전 업데이트
    curl -fsSL "$base_url/VERSION" -o "$OLYMPUS_HOME/VERSION" 2>/dev/null || true

    echo -e "${GREEN}업데이트 완료.${NC}"
}

cmd_doctor() {
    local ver=""
    [ -f "$OLYMPUS_HOME/VERSION" ] && ver=" v$(cat "$OLYMPUS_HOME/VERSION")"
    echo -e "${BOLD}Olympus 설치 진단${ver}${NC}"
    echo ""

    local ok=true

    check() {
        if [ -e "$2" ]; then
            echo -e "   ${GREEN}✓${NC} $1"
        else
            echo -e "   ${YELLOW}✗${NC} $1 (없음: $2)"
            ok=false
        fi
    }

    echo "글로벌 Skills:"
    for skill in plan delegate review delegate-gemini chain digest status; do
        check "$skill" "$HOME/.claude/skills/$skill/SKILL.md"
    done

    echo ""
    echo "Olympus 코어:"
    check "AGENTS.md 템플릿"  "$OLYMPUS_HOME/templates/AGENTS.md"
    check "delegate-gemini.sh" "$OLYMPUS_HOME/scripts/delegate-gemini.sh"
    check "olympus CLI"        "$OLYMPUS_HOME/bin/olympus"

    echo ""
    echo "외부 도구:"
    command -v codex   &>/dev/null && echo -e "   ${GREEN}✓${NC} codex"   || echo -e "   ${YELLOW}✗${NC} codex (ChatGPT Pro 필요)"
    command -v gemini  &>/dev/null && echo -e "   ${GREEN}✓${NC} gemini"  || echo -e "   ${YELLOW}✗${NC} gemini (npm install -g @google/gemini-cli)"
    command -v gtimeout &>/dev/null && echo -e "   ${GREEN}✓${NC} gtimeout" || echo -e "   ${YELLOW}~${NC} gtimeout 없음 (권장: brew install coreutils)"

    echo ""
    $ok && echo -e "${GREEN}모든 구성 요소 정상.${NC}" || echo -e "${YELLOW}일부 구성 요소 누락. install.sh를 다시 실행하세요.${NC}"
}

case "${1:-}" in
    new)    cmd_new "${2:-}" ;;
    update) cmd_update ;;
    doctor) cmd_doctor ;;
    *)      usage ;;
esac
OLYMPUS_CLI

chmod +x "$OLYMPUS_HOME/bin/olympus"
echo -e "   ${GREEN}✓${NC} ~/.olympus/bin/olympus"

# ─── 5. PATH 등록 ───
echo -e "${CYAN}[5/5] PATH 등록...${NC}"

SHELL_RC=""
[ -f "$HOME/.zshrc"  ] && SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && [ -z "$SHELL_RC" ] && SHELL_RC="$HOME/.bashrc"

PATH_LINE='export PATH="$HOME/.olympus/bin:$PATH"'
if [ -n "$SHELL_RC" ]; then
    if ! grep -q ".olympus/bin" "$SHELL_RC" 2>/dev/null; then
        { echo ""; echo "# Olympus CLI"; echo "$PATH_LINE"; } >> "$SHELL_RC"
        echo -e "   ${GREEN}✓${NC} PATH 등록됨 ($SHELL_RC)"
    else
        echo -e "   ${YELLOW}~${NC} PATH 이미 등록되어 있음"
    fi
fi

export PATH="$HOME/.olympus/bin:$PATH"

echo ""
echo -e "${GREEN}${BOLD}Olympus 설치 완료!${NC}"
echo ""
echo -e "터미널을 재시작하거나:"
[ -n "$SHELL_RC" ] && echo -e "  ${CYAN}source $SHELL_RC${NC}"
echo ""
echo -e "새 프로젝트:"
echo -e "  ${CYAN}olympus new my-project${NC}"
echo -e "  ${CYAN}olympus doctor${NC}"
