#!/bin/bash
# scripts/delegate-gemini.sh — Argus(Gemini CLI) 실행 래퍼
#
# Usage: bash scripts/delegate-gemini.sh TP-NNN [--input image.png]
#
# 보안:
#   - TP_ID는 ^TP-[0-9]{3,}$ 형식만 허용 (F-02 fix)
#   - INPUT_FILE은 실제 파일 존재 확인 후 직접 argv 전달 (F-02 fix)
#   - bash -c 문자열 평가 방식 사용하지 않음
# 이식성:
#   - macOS/Linux 모두 지원 (gtimeout fallback) (F-01 fix)

set -euo pipefail

# ─── 설정 ───
TIMEOUT=300  # 5분
LOG_FILE="artifacts/logs/execution.log"
INPUT_FILE=""

# ─── TP_ID 파싱 및 검증 (F-02: injection 방지) ───
TP_ID="${1:?Usage: delegate-gemini.sh TP-NNN [--input image.png]}"

if [[ ! "$TP_ID" =~ ^TP-[0-9]{3,}(-[a-z]+)?$ ]]; then
    echo "❌ 잘못된 TP_ID 형식: '$TP_ID'"
    echo "   올바른 형식: TP-NNN 또는 TP-NNN-suffix (예: TP-001, TP-002-vision)"
    exit 1
fi

RP_ID="${TP_ID/TP/RP}"

# ─── 옵션 파싱 ───
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --input)
            INPUT_FILE="$2"
            shift 2
            ;;
        *)
            echo "⚠️ 알 수 없는 옵션: $1"
            shift
            ;;
    esac
done

# ─── 색상 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── 사전 검증 ───
TP_FILE="artifacts/handoff/${TP_ID}.md"
RP_FILE="artifacts/handoff/${RP_ID}.md"

if [ ! -f "$TP_FILE" ]; then
    echo -e "${RED}❌ TP 파일을 찾을 수 없습니다: ${TP_FILE}${NC}"
    exit 1
fi

if ! command -v gemini &> /dev/null; then
    echo -e "${RED}❌ gemini 명령어를 찾을 수 없습니다.${NC}"
    echo "   설치: npm install -g @google/gemini-cli"
    echo "   인증: gemini 실행 후 Google 계정 로그인"
    exit 1
fi

# INPUT_FILE 검증 — 실제 파일 존재 확인만 (경로 sanity check)
if [ -n "$INPUT_FILE" ]; then
    if [ ! -f "$INPUT_FILE" ]; then
        echo -e "${RED}❌ 입력 파일을 찾을 수 없습니다: ${INPUT_FILE}${NC}"
        exit 1
    fi
fi

# ─── macOS timeout 호환성 (F-01 fix) ───
TIMEOUT_CMD=""
if command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
elif command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
else
    echo -e "${YELLOW}⚠️ timeout 명령어 없음. 시간 제한 없이 실행됩니다.${NC}"
    echo "   권장: brew install coreutils (gtimeout 설치)"
fi

# ─── 로그 디렉토리 확인 ───
mkdir -p artifacts/logs

# ─── 프롬프트 구성 ───
PROMPT="다음 순서로 작업하세요:

1. AGENTS.md를 읽어 Argus로서의 행동 규칙과 RP 포맷을 파악하세요.
2. shared/context.md를 읽어 프로젝트 맥락을 파악하세요.
3. ${TP_FILE}을 읽고 지시사항을 정확히 수행하세요.
4. 완료 후 ${RP_FILE}을 AGENTS.md의 RESULT_PACKET 형식으로 작성하세요.

RP 필수 섹션: Summary, Files Changed, Commands Executed,
Acceptance Criteria Check (각 기준별 PASS/FAIL + 증거),
Known Issues, Recommended Next Actions, Context Digest"

# ─── 실행 ───
echo -e "${CYAN}👁️ [Argus] ${TP_ID} 실행 중...${NC}"
[ -n "$INPUT_FILE" ] && echo -e "   입력 파일: ${INPUT_FILE}"
echo "$(date '+%Y-%m-%d %H:%M') [argus] START ${TP_ID}" >> "$LOG_FILE"

START_TIME=$(date +%s)
LOG_PATH="artifacts/logs/${TP_ID}-gemini.log"

# ─── Gemini 직접 실행 (F-02: bash -c 없이 직접 argv 전달) ───
run_with_timeout() {
    if [ -n "$TIMEOUT_CMD" ]; then
        if [ -n "$INPUT_FILE" ]; then
            "$TIMEOUT_CMD" "$TIMEOUT" gemini -p "$PROMPT" --input "$INPUT_FILE"
        else
            "$TIMEOUT_CMD" "$TIMEOUT" gemini -p "$PROMPT"
        fi
    else
        if [ -n "$INPUT_FILE" ]; then
            gemini -p "$PROMPT" --input "$INPUT_FILE"
        else
            gemini -p "$PROMPT"
        fi
    fi
}

EXIT_CODE=0
run_with_timeout 2>&1 | tee "$LOG_PATH" || EXIT_CODE=${PIPESTATUS[0]}

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ─── 결과 확인 ───
if [ "$EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}⏰ 타임아웃! (${TIMEOUT}초 초과)${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] TIMEOUT ${TP_ID} (${DURATION}s)" >> "$LOG_FILE"
    exit 1
elif [ "$EXIT_CODE" -ne 0 ]; then
    echo -e "${RED}❌ ${TP_ID} Gemini 실행 실패 (exit: ${EXIT_CODE})${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] FAILED ${TP_ID} (exit: ${EXIT_CODE}, ${DURATION}s)" >> "$LOG_FILE"
    exit 1
fi

if [ -f "$RP_FILE" ]; then
    echo -e "${GREEN}✅ ${TP_ID} 완료 (${DURATION}s)${NC}"
    echo -e "${GREEN}   📄 ${RP_FILE} 생성됨${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] DONE ${TP_ID} -> ${RP_ID} (${DURATION}s)" >> "$LOG_FILE"
else
    echo -e "${YELLOW}⚠️ ${TP_ID} 완료, RP 파일 미생성. 로그를 RP로 저장합니다.${NC}"
    cp "$LOG_PATH" "$RP_FILE"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] DONE-NO-RP ${TP_ID} (${DURATION}s)" >> "$LOG_FILE"
fi
