#!/bin/bash
# scripts/delegate-gemini.sh — Heimdall(Gemini CLI) 실행 래퍼
#
# Usage: bash scripts/delegate-gemini.sh TP-NNN [--input image.png] [--output-dir path/]
#
# 보안:
#   - TP_ID는 ^TP-[0-9]{3,}(-[a-z]+)?$ 형식만 허용
#   - INPUT_FILE은 실제 파일 존재 확인 후 직접 argv 전달
#   - bash -c 문자열 평가 방식 사용하지 않음
# 이식성:
#   - macOS/Linux 모두 지원 (gtimeout fallback)
# 안정성:
#   - Watchdog: 출력 정체 감지 (STALL_TIMEOUT초 무출력 시 강제 종료)
#   - 최대 출력 크기 제한 (MAX_LOG_SIZE)
#   - 반복 에러 패턴 감지 (ERROR_LOOP_THRESHOLD)

set -euo pipefail

# ─── 설정 ───
TIMEOUT=300          # 전체 타임아웃 (5분)
STALL_TIMEOUT=60     # 출력 정체 감지 (60초 무출력 시 kill)
MAX_LOG_SIZE=2097152 # 최대 로그 크기 2MB
ERROR_LOOP_THRESHOLD=3  # 동일 에러 N회 반복 시 kill
LOG_FILE="artifacts/logs/execution.log"
INPUT_FILE=""
OUTPUT_DIR=""

# ─── TP_ID 파싱 및 검증 ───
TP_ID="${1:?Usage: delegate-gemini.sh TP-NNN [--input image.png] [--output-dir path/]}"

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
        --output-dir)
            OUTPUT_DIR="$2"
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

if [ -n "$INPUT_FILE" ] && [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ 입력 파일을 찾을 수 없습니다: ${INPUT_FILE}${NC}"
    exit 1
fi

# 이미지 출력 디렉토리 기본값
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="artifacts/research"
fi
mkdir -p "$OUTPUT_DIR"

# ─── macOS timeout 호환성 ───
TIMEOUT_CMD=""
if command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
elif command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
else
    echo -e "${YELLOW}⚠️ timeout 명령어 없음. watchdog만으로 보호됩니다.${NC}"
    echo "   권장: brew install coreutils (gtimeout 설치)"
fi

# ─── 로그 디렉토리 확인 ───
mkdir -p artifacts/logs

# ─── 프롬프트 구성 ───
PROMPT="다음 순서로 작업하세요:

1. AGENTS.md를 읽어 Heimdall로서의 행동 규칙과 Saga(RP) 포맷을 파악하세요.
2. shared/context.md를 읽어 프로젝트 맥락을 파악하세요.
3. ${TP_FILE}을 읽고 지시사항을 정확히 수행하세요.
4. 이미지를 생성하는 작업이라면 ${OUTPUT_DIR}/ 디렉토리에 저장하세요.
5. 완료 후 ${RP_FILE}을 AGENTS.md의 Saga 형식으로 작성하세요.

RP 필수 섹션: Summary, Files Changed, Commands Executed,
Acceptance Criteria Check (각 기준별 PASS/FAIL + 증거),
Known Issues, Recommended Next Actions, Context Digest

중요: 반드시 ${RP_FILE} 파일을 직접 생성하세요. stdout 출력만으로는 부족합니다."

# ─── Gemini 실행 인자 구성 ───
GEMINI_ARGS=(-p "$PROMPT" --yolo)
[ -n "$INPUT_FILE" ] && GEMINI_ARGS+=(-- "$INPUT_FILE")

# ─── 실행 ───
echo -e "${CYAN}👁️ [Heimdall] ${TP_ID} 실행 중...${NC}"
[ -n "$INPUT_FILE" ] && echo -e "   입력 파일: ${INPUT_FILE}"
echo -e "   출력 디렉토리: ${OUTPUT_DIR}"
echo "$(date '+%Y-%m-%d %H:%M') [argus] START ${TP_ID}" >> "$LOG_FILE"

START_TIME=$(date +%s)
LOG_PATH="artifacts/logs/${TP_ID}-gemini.log"
: > "$LOG_PATH"  # 로그 파일 초기화

# ─── Watchdog 프로세스 ───
GEMINI_PID=""
watchdog() {
    local last_size=0
    local stall_count=0
    local last_error=""
    local error_repeat=0

    while true; do
        sleep 10

        # Gemini 프로세스 종료 확인
        if [ -n "$GEMINI_PID" ] && ! kill -0 "$GEMINI_PID" 2>/dev/null; then
            break
        fi

        # 로그 파일 크기 확인
        local current_size
        current_size=$(wc -c < "$LOG_PATH" 2>/dev/null || echo 0)

        # 1) 최대 크기 초과
        if [ "$current_size" -gt "$MAX_LOG_SIZE" ]; then
            echo -e "\n${RED}🛑 [Watchdog] 로그 크기 초과 ($(( current_size / 1024 ))KB > $(( MAX_LOG_SIZE / 1024 ))KB). 강제 종료.${NC}"
            echo "$(date '+%Y-%m-%d %H:%M') [watchdog] LOG_OVERFLOW ${TP_ID}" >> "$LOG_FILE"
            [ -n "$GEMINI_PID" ] && kill -TERM "$GEMINI_PID" 2>/dev/null
            break
        fi

        # 2) 출력 정체 감지
        if [ "$current_size" -eq "$last_size" ]; then
            stall_count=$((stall_count + 10))
            if [ "$stall_count" -ge "$STALL_TIMEOUT" ]; then
                echo -e "\n${RED}🛑 [Watchdog] ${STALL_TIMEOUT}초간 출력 없음. 정체 감지. 강제 종료.${NC}"
                echo "$(date '+%Y-%m-%d %H:%M') [watchdog] STALL ${TP_ID} (${stall_count}s)" >> "$LOG_FILE"
                [ -n "$GEMINI_PID" ] && kill -TERM "$GEMINI_PID" 2>/dev/null
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
                    echo -e "\n${RED}🛑 [Watchdog] 동일 에러 ${ERROR_LOOP_THRESHOLD}회 반복 감지. 루프 탈출. 강제 종료.${NC}"
                    echo -e "   에러: ${latest_error}"
                    echo "$(date '+%Y-%m-%d %H:%M') [watchdog] ERROR_LOOP ${TP_ID}: ${latest_error}" >> "$LOG_FILE"
                    [ -n "$GEMINI_PID" ] && kill -TERM "$GEMINI_PID" 2>/dev/null
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
    # Gemini 잔존 프로세스 정리
    [ -n "$GEMINI_PID" ] && kill -TERM "$GEMINI_PID" 2>/dev/null || true
    # PID 파일 삭제
    rm -f "artifacts/logs/.heimdall.pid"
}
trap cleanup EXIT

# ─── Gemini 실행 ───
run_gemini() {
    if [ -n "$TIMEOUT_CMD" ]; then
        "$TIMEOUT_CMD" "$TIMEOUT" gemini "${GEMINI_ARGS[@]}"
    else
        gemini "${GEMINI_ARGS[@]}"
    fi
}

EXIT_CODE=0
run_gemini > >(tee "$LOG_PATH") 2>&1 &
GEMINI_PID=$!
echo $GEMINI_PID > "artifacts/logs/.heimdall.pid"
wait "$GEMINI_PID" || EXIT_CODE=$?
GEMINI_PID=""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ─── 결과 확인 ───
if [ "$EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}⏰ 타임아웃! (${TIMEOUT}초 초과)${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] TIMEOUT ${TP_ID} (${DURATION}s)" >> "$LOG_FILE"
    exit 1
elif [ "$EXIT_CODE" -ne 0 ] && [ "$EXIT_CODE" -ne 143 ]; then
    # 143 = SIGTERM (watchdog에 의한 종료)
    echo -e "${RED}❌ ${TP_ID} Gemini 실행 실패 (exit: ${EXIT_CODE})${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] FAILED ${TP_ID} (exit: ${EXIT_CODE}, ${DURATION}s)" >> "$LOG_FILE"
    exit 1
fi

# ─── RP 파일 확인 및 fallback ───
if [ -f "$RP_FILE" ]; then
    echo -e "${GREEN}✅ ${TP_ID} 완료 (${DURATION}s)${NC}"
    echo -e "${GREEN}   📄 ${RP_FILE} 생성됨${NC}"
    echo "$(date '+%Y-%m-%d %H:%M') [argus] DONE ${TP_ID} -> ${RP_ID} (${DURATION}s)" >> "$LOG_FILE"
else
    # Fallback: Gemini가 RP를 직접 생성하지 못한 경우 로그에서 추출
    echo -e "${YELLOW}⚠️ RP 파일 미생성. 로그에서 RP를 추출합니다...${NC}"

    # 로그에서 마크다운 형태의 RP 내용 추출 시도
    if grep -q "^# RP-" "$LOG_PATH" 2>/dev/null; then
        # RP 헤더가 있으면 해당 지점부터 추출
        sed -n '/^# RP-/,$p' "$LOG_PATH" > "$RP_FILE"
        echo -e "${GREEN}   📄 로그에서 RP 추출 완료: ${RP_FILE}${NC}"
    else
        # 전체 로그를 RP로 래핑
        {
            echo "# ${RP_ID}: ${TP_ID} 분석 결과 (자동 생성)"
            echo ""
            echo "## Summary"
            echo "Gemini CLI 출력을 자동 래핑한 결과입니다. RP 직접 생성 실패."
            echo ""
            echo "## Raw Output"
            echo '```'
            # 로그에서 ANSI 이스케이프, 에러 스택 제거
            sed 's/\x1b\[[0-9;]*m//g' "$LOG_PATH" | grep -v "^Error executing tool" | grep -v "^    at " | head -200
            echo '```'
            echo ""
            echo "## Known Issues"
            echo "- Gemini CLI가 RP 파일을 직접 생성하지 못함"
            echo "- Odin이 이 내용을 검토 후 수동으로 정리 필요"
        } > "$RP_FILE"
        echo -e "${YELLOW}   📄 로그 래핑으로 RP 생성: ${RP_FILE}${NC}"
    fi
    echo "$(date '+%Y-%m-%d %H:%M') [argus] DONE-FALLBACK ${TP_ID} -> ${RP_ID} (${DURATION}s)" >> "$LOG_FILE"
fi

# ─── 생성된 이미지 파일 보고 ───
IMAGE_COUNT=$(find "$OUTPUT_DIR" -newer "$LOG_PATH" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.webp" -o -name "*.svg" \) 2>/dev/null | wc -l | tr -d ' ')
if [ "$IMAGE_COUNT" -gt 0 ]; then
    echo -e "${CYAN}   🖼️  생성된 이미지: ${IMAGE_COUNT}개 (${OUTPUT_DIR}/)${NC}"
    find "$OUTPUT_DIR" -newer "$LOG_PATH" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.webp" -o -name "*.svg" \) -exec echo "      - {}" \;
fi
