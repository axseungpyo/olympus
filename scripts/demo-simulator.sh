#!/bin/bash
# Yggdrasil Demo Simulator
# 더미 로그와 PID를 생성하여 대시보드 실시간 동작을 시연합니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_DIR/artifacts/logs"

mkdir -p "$LOGS_DIR"

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🌳 Yggdrasil Demo Simulator${NC}"
echo "────────────────────────────────────────"
echo "Logs: $LOGS_DIR"
echo ""

# PID 파일 생성 (현재 쉘 PID 사용 — 살아있는 프로세스)
echo $$ > "$LOGS_DIR/.brokkr.pid"
echo $PPID > "$LOGS_DIR/.heimdall.pid"
echo -e "${BLUE}[Brokkr]${NC}  PID $$  → .brokkr.pid"
echo -e "${GREEN}[Heimdall]${NC} PID $PPID → .heimdall.pid"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Demo 정리 중...${NC}"
    rm -f "$LOGS_DIR/.brokkr.pid" "$LOGS_DIR/.heimdall.pid"
    rm -f "$LOGS_DIR/brokkr.log" "$LOGS_DIR/heimdall.log"
    # INDEX.md 복원
    cat > "$PROJECT_DIR/artifacts/INDEX.md" << 'INDEXEOF'
# Asgard Chronicle — Work Status Index

Last updated: 2026-03-09

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Asgard 공개 배포 구조 구축 | codex | done | 2026-03-06 | 2026-03-06 |
| TP-002 | Yggdrasil Phase 1 — Backend Server + 기본 Dashboard UI | codex | review-needed | 2026-03-09 | 2026-03-09 |

## Completed Tasks

| ID | Title | Agent | Completed |
|----|-------|-------|-----------|

## Next TP Number: TP-003
INDEXEOF
    echo -e "${GREEN}✅ INDEX.md 원본 복원 완료${NC}"
    echo -e "${GREEN}✅ Demo 종료${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# 로그 메시지 풀
BROKKR_MSGS=(
    "[INFO] TP-003 작업 시작: 사용자 인증 API 구현"
    "[INFO] src/auth/jwt.ts 파일 생성 중..."
    "[INFO] JWT 토큰 생성 함수 구현 완료"
    "[INFO] bcrypt 비밀번호 해싱 구현..."
    "[INFO] POST /api/auth/login 라우트 추가"
    "[INFO] POST /api/auth/register 라우트 추가"
    "[INFO] refresh token rotation 로직 구현"
    "[WARN] OAuth callback URL 환경변수 미설정 — 기본값 사용"
    "[INFO] Google OAuth2 클라이언트 설정 완료"
    "[INFO] GitHub OAuth 연동 구현 중..."
    "[INFO] middleware/auth.ts — 인증 미들웨어 작성"
    "[INFO] 테스트: login 성공 케이스 ✓"
    "[INFO] 테스트: login 실패 (잘못된 비밀번호) ✓"
    "[INFO] 테스트: 토큰 만료 처리 ✓"
    "[WARN] rate limiter 미적용 — 추후 TP에서 처리 필요"
    "[INFO] 테스트: register 중복 이메일 거부 ✓"
    "[INFO] OAuth flow 통합 테스트 실행 중..."
    "[INFO] 전체 auth 테스트 12/12 통과 ✓"
    "[INFO] src/auth/ 디렉토리 구조 정리 완료"
    "[INFO] TP-003 구현 완료 — RP-003 작성 중..."
)

HEIMDALL_MSGS=(
    "[INFO] TP-004 작업 시작: 랜딩 페이지 분석"
    "[INFO] 스크린샷 로드: landing-reference.png (1920x1080)"
    "[INFO] 레이아웃 분석: Hero + Features + CTA + Footer"
    "[INFO] 색상 팔레트 추출: #0f172a, #3b82f6, #f59e0b, #10b981"
    "[INFO] 타이포그래피 감지: Inter Bold 48px (Hero), 16px (Body)"
    "[INFO] Hero 섹션 분석 완료 — CTA 버튼 2개 감지"
    "[WARN] Features 섹션 아이콘 해상도 낮음 — SVG 대체 권장"
    "[INFO] 반응형 브레이크포인트 추정: 768px, 1024px, 1280px"
    "[INFO] 그리드 시스템 분석: 12-column, gap 24px"
    "[INFO] Features 카드 3개 — hover 애니메이션 감지"
    "[INFO] Footer 링크 구조 분석 완료"
    "[INFO] CTA 섹션 그라디언트: linear-gradient(135deg, #3b82f6, #8b5cf6)"
    "[INFO] 이미지 에셋 목록 생성 (8개 추출)"
    "[INFO] 컴포넌트 트리 생성 완료"
    "[INFO] Tailwind 클래스 매핑 완료"
    "[INFO] UI 클론 스펙 JSON 생성 중..."
    "[INFO] TP-004 분석 완료 — RP-004 작성 중..."
)

echo -e "${YELLOW}📡 실시간 로그 시뮬레이션 시작 (Ctrl+C로 종료)${NC}"
echo "────────────────────────────────────────"
echo ""

brokkr_idx=0
heimdall_idx=0
cycle=0

while true; do
    # Brokkr 로그
    if [ $brokkr_idx -lt ${#BROKKR_MSGS[@]} ]; then
        ts=$(date '+%Y-%m-%d %H:%M:%S')
        msg="${BROKKR_MSGS[$brokkr_idx]}"
        echo "[$ts] $msg" >> "$LOGS_DIR/brokkr.log"
        echo -e "${BLUE}[Brokkr]${NC}  $msg"
        brokkr_idx=$((brokkr_idx + 1))
    fi

    sleep 1.5

    # Heimdall 로그
    if [ $heimdall_idx -lt ${#HEIMDALL_MSGS[@]} ]; then
        ts=$(date '+%Y-%m-%d %H:%M:%S')
        msg="${HEIMDALL_MSGS[$heimdall_idx]}"
        echo "[$ts] $msg" >> "$LOGS_DIR/heimdall.log"
        echo -e "${GREEN}[Heimdall]${NC} $msg"
        heimdall_idx=$((heimdall_idx + 1))
    fi

    sleep 1.5

    # 양쪽 다 끝나면 상태 변경 시뮬레이션
    if [ $brokkr_idx -ge ${#BROKKR_MSGS[@]} ] && [ $heimdall_idx -ge ${#HEIMDALL_MSGS[@]} ]; then
        cycle=$((cycle + 1))

        if [ $cycle -eq 1 ]; then
            echo ""
            echo -e "${YELLOW}━━━ Phase 2: TP-003 review-needed, TP-005 시작 ━━━${NC}"
            echo ""

            # INDEX.md 업데이트 — TP-003 완료, TP-005 진행
            cat > "$PROJECT_DIR/artifacts/INDEX.md" << 'EOF'
# Asgard Chronicle — Work Status Index

Last updated: 2026-03-09

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Asgard 공개 배포 구조 구축 | codex | done | 2026-03-06 | 2026-03-06 |
| TP-002 | Yggdrasil Phase 1 — Backend Server + 기본 Dashboard UI | codex | done | 2026-03-09 | 2026-03-09 |
| TP-003 | 사용자 인증 API 구현 (JWT + OAuth) | codex | review-needed | 2026-03-09 | 2026-03-09 |
| TP-004 | 랜딩 페이지 스크린샷 분석 및 UI 클론 | gemini | review-needed | 2026-03-09 | 2026-03-09 |
| TP-005 | API 문서 자동 생성 (Swagger/OpenAPI) | codex | in-progress | 2026-03-09 | 2026-03-09 |

## Completed Tasks

| ID | Title | Agent | Completed |
|----|-------|-------|-----------|

## Next TP Number: TP-006
EOF
            # Heimdall PID 제거 (작업 완료)
            rm -f "$LOGS_DIR/.heimdall.pid"

            # 새 Brokkr 로그
            BROKKR_MSGS=(
                "[INFO] TP-005 작업 시작: API 문서 자동 생성"
                "[INFO] swagger-jsdoc 설치 중..."
                "[INFO] src/docs/swagger.ts 설정 파일 생성"
                "[INFO] 라우트 스캔 중... 12개 엔드포인트 감지"
                "[INFO] POST /api/auth/login — 스키마 생성"
                "[INFO] POST /api/auth/register — 스키마 생성"
                "[INFO] GET /api/users/:id — 스키마 생성"
                "[INFO] Swagger UI 마운트: /api-docs"
                "[INFO] OpenAPI 3.0 스펙 생성 완료"
                "[INFO] 테스트: /api-docs 접근 ✓"
                "[INFO] TP-005 구현 완료 — RP-005 작성 중..."
            )
            brokkr_idx=0
            heimdall_idx=999  # Heimdall은 이번 라운드 안 씀

        elif [ $cycle -eq 2 ]; then
            echo ""
            echo -e "${YELLOW}━━━ Phase 3: 전체 완료 ━━━${NC}"
            echo ""

            cat > "$PROJECT_DIR/artifacts/INDEX.md" << 'EOF'
# Asgard Chronicle — Work Status Index

Last updated: 2026-03-09

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Asgard 공개 배포 구조 구축 | codex | done | 2026-03-06 | 2026-03-06 |
| TP-002 | Yggdrasil Phase 1 — Backend Server + 기본 Dashboard UI | codex | done | 2026-03-09 | 2026-03-09 |
| TP-003 | 사용자 인증 API 구현 (JWT + OAuth) | codex | done | 2026-03-09 | 2026-03-09 |
| TP-004 | 랜딩 페이지 스크린샷 분석 및 UI 클론 | gemini | done | 2026-03-09 | 2026-03-09 |
| TP-005 | API 문서 자동 생성 (Swagger/OpenAPI) | codex | done | 2026-03-09 | 2026-03-09 |

## Completed Tasks

| ID | Title | Agent | Completed |
|----|-------|-------|-----------|

## Next TP Number: TP-006
EOF
            rm -f "$LOGS_DIR/.brokkr.pid"

            ts=$(date '+%Y-%m-%d %H:%M:%S')
            echo "[$ts] [INFO] 모든 작업 완료. Asgard 대기 중." >> "$LOGS_DIR/brokkr.log"
            echo -e "${GREEN}✅ 전체 시뮬레이션 완료. 대시보드에서 상태 확인하세요.${NC}"
            echo -e "${YELLOW}   Ctrl+C로 종료하면 INDEX.md가 원본으로 복원됩니다.${NC}"

            # 대기
            while true; do sleep 60; done
        fi
    fi
done
