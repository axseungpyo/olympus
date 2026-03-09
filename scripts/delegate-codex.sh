#!/bin/bash
# scripts/delegate-codex.sh — Brokkr(Codex CLI) 실행 래퍼
#
# Usage: bash scripts/delegate-codex.sh TP-NNN
#
# 보안:
#   - TP_ID는 ^TP-[0-9]{3,}(-[a-z]+)?$ 형식만 허용
#   - bash -c 문자열 평가 방식 사용하지 않음
# 이식성:
#   - macOS/Linux 모두 지원 (gtimeout fallback)
# 안정성:
#   - Watchdog: 출력 정체 감지 (STALL_TIMEOUT초 무출력 시 강제 종료)
#   - 최대 출력 크기 제한 (MAX_LOG_SIZE)
#   - 반복 에러 패턴 감지 (ERROR_LOOP_THRESHOLD)

set -euo pipefail

# ─── 설정 ───
TIMEOUT=600          # 전체 타임아웃 (10분)
STALL_TIMEOUT=120    # 출력 정체 감지 (120초 무출력 시 kill)
MAX_LOG_SIZE=5242880 # 최대 로그 크기 5MB
ERROR_LOOP_THRESHOLD=3  # 동일 에러 N회 반복 시 kill
LOG_FILE="artifacts/logs/execution.log"

# ─── TP_ID 파싱 및 검증 ───
TP_ID="${1:?Usage: delegate-codex.sh TP-NNN}"

if [[ ! "$TP_ID" =~ ^TP-[0-9]{3,}(-[a-z]+)?$ ]]; then
    echo "Error: invalid TP_ID format: '$TP_ID'"
    echo "   Expected: TP-NNN or TP-NNN-suffix (e.g. TP-001, TP-002-auth)"
    exit 1
fi

RP_ID="${TP_ID/TP/RP}"

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
    echo -e "${RED}Error: TP file not found: ${TP_FILE}${NC}"
    exit 1
fi

if ! command -v codex &> /dev/null; then
    echo -e "${RED}Error: codex command not found.${NC}"
    echo "   Install: npm install -g @openai/codex"
    echo "   Requires: ChatGPT Plus subscription"
    exit 1
fi

# ─── Complexity Hint 파싱 ───
COMPLEXITY=$(grep -i "complexity" "$TP_FILE" | head -1 | sed 's/.*: *//;s/ .*//' | tr '[:upper:]' '[:lower:]')

case "$COMPLEXITY" in
    extreme)
        APPROVAL_MODE="--full-auto"
        TIMEOUT=1800  # 30분
        echo -e "${CYAN}Mode: Ragnarok (extreme) — timeout ${TIMEOUT}s${NC}"
        ;;
    complex)
        APPROVAL_MODE="--full-auto"
        echo -e "${CYAN}Mode: Mjolnir (complex)${NC}"
        ;;
    moderate)
        APPROVAL_MODE="--full-auto"
        echo -e "${CYAN}Mode: Anvil (moderate)${NC}"
        ;;
    *)
        APPROVAL_MODE="--full-auto"
        echo -e "${CYAN}Mode: Spark (simple)${NC}"
        ;;
esac

# ─── macOS timeout 호환성 ───
TIMEOUT_CMD=""
if command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
elif command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
else
    echo -e "${YELLOW}Warning: timeout command not found. Watchdog-only protection.${NC}"
    echo "   Recommended: brew install coreutils (for gtimeout)"
fi

# ─── 로그 디렉토리 확인 ───
mkdir -p artifacts/logs

# ─── 동시 실행 Lock ───
LOCK_DIR="artifacts/logs/.brokkr.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "unknown")
    if [ "$LOCK_PID" != "unknown" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        echo -e "${RED}Error: Brokkr is already running (PID: ${LOCK_PID}).${NC}"
        echo "   Wait for it to finish or kill it: kill $LOCK_PID"
        exit 1
    else
        echo -e "${YELLOW}Warning: Stale lock detected (PID: ${LOCK_PID}). Reclaiming.${NC}"
        rm -rf "$LOCK_DIR"
        mkdir "$LOCK_DIR"
    fi
fi
echo $$ > "$LOCK_DIR/pid"

# ─── 로그 로테이션 ───
MAX_EXEC_LOG_SIZE=1048576  # 1MB
MAX_EXEC_LOG_FILES=5
rotate_log() {
    local logfile="$1"
    [ ! -f "$logfile" ] && return
    local size
    size=$(wc -c < "$logfile" 2>/dev/null || echo 0)
    if [ "$size" -gt "$MAX_EXEC_LOG_SIZE" ]; then
        for i in $(seq $((MAX_EXEC_LOG_FILES - 1)) -1 1); do
            [ -f "${logfile}.${i}" ] && mv "${logfile}.${i}" "${logfile}.$((i + 1))"
        done
        mv "$logfile" "${logfile}.1"
        : > "$logfile"
        echo "$(date '+%Y-%m-%d %H:%M') [system] Log rotated (was ${size} bytes)" >> "$logfile"
    fi
}
rotate_log "$LOG_FILE"

# ─── 프롬프트 구성 ───
RAGNAROK_LINE=""
if [ "$COMPLEXITY" = "extreme" ]; then
    RAGNAROK_LINE="This is a Ragnarok-level task: work autonomously until complete."
fi

PROMPT="Read AGENTS.md to understand your role as Brokkr and the Saga(RP) format.
Read shared/context.md for project context.
Then read ${TP_FILE} and implement the task exactly as specified.
${RAGNAROK_LINE}
When complete, write ${RP_FILE} as a Saga per AGENTS.md format.

RP required sections: Summary, Files Changed, Commands Executed,
Acceptance Criteria Check (PASS/FAIL with evidence per criterion),
Known Issues, Recommended Next Actions, Context Digest

Important: You MUST create the ${RP_FILE} file directly on disk."

# ─── 실행 ───
echo -e "${CYAN}Brokkr ${TP_ID} executing...${NC}"
echo "$(date '+%Y-%m-%d %H:%M') [brokkr] START ${TP_ID}" >> "$LOG_FILE"

START_TIME=$(date +%s)
LOG_PATH="artifacts/logs/${TP_ID}-codex.log"
: > "$LOG_PATH"  # 로그 파일 초기화

# ─── Watchdog 프로세스 ───
CODEX_PID=""
watchdog() {
    local last_size=0
    local stall_count=0
    local last_error=""
    local error_repeat=0

    while true; do
        sleep 10

        # Codex 프로세스 종료 확인
        if [ -n "$CODEX_PID" ] && ! kill -0 "$CODEX_PID" 2>/dev/null; then
            break
        fi

        # 로그 파일 크기 확인
        local current_size
        current_size=$(wc -c < "$LOG_PATH" 2>/dev/null || echo 0)

        # 1) 최대 크기 초과
        if [ "$current_size" -gt "$MAX_LOG_SIZE" ]; then
            echo -e "\n${RED}[Watchdog] Log size exceeded ($(( current_size / 1024 ))KB > $(( MAX_LOG_SIZE / 1024 ))KB). Force kill.${NC}"
            echo "$(date '+%Y-%m-%d %H:%M') [watchdog] LOG_OVERFLOW ${TP_ID}" >> "$LOG_FILE"
            [ -n "$CODEX_PID" ] && kill -TERM "$CODEX_PID" 2>/dev/null
            break
        fi

        # 2) 출력 정체 감지
        if [ "$current_size" -eq "$last_size" ]; then
            stall_count=$((stall_count + 10))
            if [ "$stall_count" -ge "$STALL_TIMEOUT" ]; then
                echo -e "\n${RED}[Watchdog] No output for ${STALL_TIMEOUT}s. Stall detected. Force kill.${NC}"
                echo "$(date '+%Y-%m-%d %H:%M') [watchdog] STALL ${TP_ID} (${stall_count}s)" >> "$LOG_FILE"
                [ -n "$CODEX_PID" ] && kill -TERM "$CODEX_PID" 2>/dev/null
                break
            fi
        else
            stall_count=0
            last_size=$current_size
        fi

        # 3) 반복 에러 패턴 감지
        local latest_error
        latest_error=$(grep -o "Error executing tool [^:]*" "$LOG_PATH" 2>/dev/null | tail -1 || true)
        if [ -n "$latest_error" ]; then
            if [ "$latest_error" = "$last_error" ]; then
                error_repeat=$((error_repeat + 1))
                if [ "$error_repeat" -ge "$ERROR_LOOP_THRESHOLD" ]; then
                    echo -e "\n${RED}[Watchdog] Same error repeated ${ERROR_LOOP_THRESHOLD} times. Error loop. Force kill.${NC}"
                    echo -e "   Error: ${latest_error}"
                    echo "$(date '+%Y-%m-%d %H:%M') [watchdog] ERROR_LOOP ${TP_ID}: ${latest_error}" >> "$LOG_FILE"
                    [ -n "$CODEX_PID" ] && kill -TERM "$CODEX_PID" 2>/dev/null
                    break
                fi
            else
                last_error="$latest_error"
                error_repeat=1
            fi
        fi
    done
}

# Watchdog 백그라운드 실행
watchdog &
WATCHDOG_PID=$!

# cleanup 함수
cleanup() {
    # Watchdog 종료
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
    # Codex 잔존 프로세스 정리
    [ -n "$CODEX_PID" ] && kill -TERM "$CODEX_PID" 2>/dev/null || true
    # PID 파일 삭제
    rm -f "artifacts/logs/.brokkr.pid"
    # Lock 해제
    rm -rf "$LOCK_DIR"
}
trap cleanup EXIT

# ─── Codex 실행 ───
run_codex() {
    if [ -n "$TIMEOUT_CMD" ]; then
        "$TIMEOUT_CMD" "$TIMEOUT" codex exec "$APPROVAL_MODE" "$PROMPT"
    else
        codex exec "$APPROVAL_MODE" "$PROMPT"
    fi
}

EXIT_CODE=0
run_codex > >(tee "$LOG_PATH") 2>&1 &
CODEX_PID=$!
echo $CODEX_PID > "artifacts/logs/.brokkr.pid"
wait "$CODEX_PID" || EXIT_CODE=$?
CODEX_PID=""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ─── 결과 확인 ───
if [ "$EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}Timeout! (${TIMEOUT}s exceeded)${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [brokkr] TIMEOUT ${TP_ID} (${DURATION}s)" >> "$LOG_FILE"
    exit 1
elif [ "$EXIT_CODE" -ne 0 ] && [ "$EXIT_CODE" -ne 143 ]; then
    # 143 = SIGTERM (watchdog에 의한 종료)
    echo -e "${RED}Error: ${TP_ID} Codex execution failed (exit: ${EXIT_CODE})${NC}"
    echo "Brokkr failed. Run \`bash scripts/rollback.sh ${TP_ID}\` to revert changes."
    echo "$(date '+%Y-%m-%d %H:%M') [brokkr] FAILED ${TP_ID} (exit: ${EXIT_CODE}, ${DURATION}s)" >> "$LOG_FILE"
    exit 1
fi

# ─── RP 파일 확인 및 fallback ───
if [ -f "$RP_FILE" ]; then
    echo -e "${GREEN}Done: ${TP_ID} (${DURATION}s)${NC}"
    echo -e "${GREEN}   ${RP_FILE} created${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [brokkr] DONE ${TP_ID} -> ${RP_ID} (${DURATION}s)" >> "$LOG_FILE"
else
    # Fallback: Codex가 RP를 직접 생성하지 못한 경우 로그에서 추출
    echo -e "${YELLOW}Warning: RP file not created. Extracting from log...${NC}"

    # 로그에서 마크다운 형태의 RP 내용 추출 시도
    if grep -q "^# RP-" "$LOG_PATH" 2>/dev/null; then
        # RP 헤더가 있으면 해당 지점부터 추출
        sed -n '/^# RP-/,$p' "$LOG_PATH" > "$RP_FILE"
        echo -e "${GREEN}   RP extracted from log: ${RP_FILE}${NC}"
    else
        # 전체 로그를 RP로 래핑
        {
            echo "# ${RP_ID}: ${TP_ID} Result (auto-generated)"
            echo ""
            echo "## Summary"
            echo "Auto-wrapped Codex CLI output. Direct RP creation failed."
            echo ""
            echo "## Raw Output"
            echo '```'
            # 로그에서 ANSI 이스케이프, 에러 스택 제거
            sed 's/\x1b\[[0-9;]*m//g' "$LOG_PATH" | grep -v "^Error executing tool" | grep -v "^    at " | head -200
            echo '```'
            echo ""
            echo "## Known Issues"
            echo "- Codex CLI failed to create RP file directly"
            echo "- Odin should review and manually organize this content"
        } > "$RP_FILE"
        echo -e "${YELLOW}   RP wrapped from log: ${RP_FILE}${NC}"
    fi
    echo "$(date '+%Y-%m-%d %H:%M') [brokkr] DONE-FALLBACK ${TP_ID} -> ${RP_ID} (${DURATION}s)" >> "$LOG_FILE"
fi

if grep -qi "rejected" "$RP_FILE" 2>/dev/null; then
    echo "Brokkr failed. Run \`bash scripts/rollback.sh ${TP_ID}\` to revert changes."
fi
