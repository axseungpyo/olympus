---
name: delegate-gemini
description: >
  Heimdall(Gemini CLI)에게 Rune(TP)을 전달하여 비전/생성 작업을 위임한다.
  "gemini", "Heimdall", "이미지 분석", "이미지 생성", "스크린샷 분석",
  "PDF 분석", "문서 OCR", "웹 리서치", "비전 작업" 등에 트리거.
  Agent Target이 "gemini"인 TP에 사용.
allowed-tools: Read, Write, Bash, Glob
---

# /delegate-gemini — Heimdall(Gemini) 실행 위임

## 역할

비전(이미지/영상 분석), 이미지 생성/편집, 대규모 문서 처리, 웹 리서치 등
Heimdall(Gemini CLI)의 멀티모달 능력이 필요한 작업을 위임한다.

## 실행 절차

### Step 1: TP 검증

`$ARGUMENTS`에서 TP ID 파싱 (예: `TP-008`).

확인 사항:
- `artifacts/handoff/TP-NNN.md` 존재 여부
- `Agent Target`이 `gemini`인지 확인
- INDEX.md status가 `draft`인지 확인

### Step 2: 입력 파일 확인

TP의 `Multimodal Input` 섹션 확인:
- 이미지 파일이 명시된 경우 해당 경로 존재 확인
- 문서 파일이 명시된 경우 해당 경로 존재 확인
- 파일 없으면 사용자에게 알리고 중단

### Step 3: Sight Range Mode 결정

TP의 Vision Task 유형:
| Vision Task | Heimdall Mode | 비고 |
|-------------|--------------|------|
| analyze, ocr | Bifrost (3.1 Pro) | 기본값 |
| analyze (대량 파일) | Glint (Flash-Lite) | 빠른 분류 |
| generate, edit | Gjallarhorn (Pro Image) | 이미지 생성 |
| screenshot-to-code | Bifrost (3.1 Pro) | 분석 후 Codex 체인 |

### Step 4: INDEX.md 상태 업데이트

status: `draft` -> `in-progress`, Updated: {datetime}

### Step 5: Heimdall 소환

`scripts/delegate-gemini.sh`를 통해 실행:

```bash
# 텍스트/문서 분석 작업
bash scripts/delegate-gemini.sh TP-NNN

# 이미지 입력이 있는 작업
bash scripts/delegate-gemini.sh TP-NNN --input {image-path}

# 이미지 생성 작업 (출력 디렉토리 지정)
bash scripts/delegate-gemini.sh TP-NNN --output-dir src/assets/
```

실행 중 상태 메시지:
```
Heimdall[{Mode}] 비프로스트 활성화: TP-NNN 분석 중...
```

### Step 6: 결과 확인

스크립트 완료 후:
- `artifacts/handoff/RP-NNN.md` 존재 확인
- 없으면: INDEX.md status -> `blocked`
- 있으면: INDEX.md status -> `review-needed`
- 이미지 생성 작업인 경우 출력 디렉토리에 파일 확인

### Step 7: 완료 보고

```
Heimdall[{Mode}] 관측 완료: RP-NNN

검토 준비 완료. 다음: /review RP-NNN
```

## Watchdog 보호 메커니즘

스크립트에 내장된 안전장치:

| 보호 | 기본값 | 동작 |
|------|-------|------|
| 전체 타임아웃 | 300초 (5분) | timeout/gtimeout으로 강제 종료 |
| 출력 정체 감지 | 60초 무출력 | watchdog이 SIGTERM 전송 |
| 로그 크기 제한 | 2MB | 초과 시 강제 종료 |
| 에러 루프 감지 | 동일 에러 3회 | 반복 에러 패턴 시 강제 종료 |

Watchdog이 강제 종료한 경우:
1. 로그에서 원인 확인: `artifacts/logs/TP-NNN-gemini.log`
2. INDEX.md status -> `blocked`
3. 사용자에게 원인 보고

## Saga Fallback

Gemini가 Saga(RP) 파일을 직접 생성하지 못한 경우:
1. 로그에서 `# RP-NNN` 헤더를 검색하여 Saga 추출 시도
2. 그래도 없으면 전체 로그를 Saga 포맷으로 래핑
3. Odin이 fallback Saga를 검토 후 판정

## 오류 처리

**Gemini 미설치:**
```
Heimdall을 찾을 수 없습니다.
설치: npm install -g @google/gemini-cli
인증: gemini 실행 후 Google 계정 로그인
```

**Watchdog 강제 종료:**
```
가능한 원인:
1. Gemini API 응답 지연 (네트워크 문제)
2. 도구 호출 반복 루프 (Gemini 내부 에러)
3. 작업 범위 초과 (TP를 더 작게 분할 필요)
```

**TP Agent Target이 gemini가 아닌 경우:**
```
이 TP는 Brokkr(Codex) 작업입니다.
/delegate TP-NNN을 사용하세요.
```
