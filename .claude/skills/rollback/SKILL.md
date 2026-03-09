---
name: rollback
description: >
  실패한(blocked) TP의 커밋을 git revert로 롤백한다.
  "rollback", "롤백", "되돌리기", "실패 작업 복구" 등에 트리거.
allowed-tools: Read, Write, Bash, Glob
---

# /rollback — Failed TP 롤백

## 역할

blocked 상태로 끝났거나 RP가 rejected된 TP의 변경 커밋을 찾아 `scripts/rollback.sh`로 안전하게 되돌린다.
자동 실행은 하지 않고, Odin의 명시적 호출에서만 수행한다.

## 실행 절차

### Step 1: TP 파싱 및 사전 확인

`$ARGUMENTS`에서 TP ID 파싱 (예: `TP-010`).

1. `artifacts/handoff/TP-NNN.md` 존재 확인
2. `artifacts/INDEX.md`가 있으면 상태를 참고해 blocked 또는 rejected 맥락인지 확인
3. TP가 없으면 중단:
   ```
   artifacts/handoff/TP-NNN.md를 찾을 수 없습니다.
   /status로 현재 작업 목록을 확인하세요.
   ```

### Step 2: 롤백 대상 확인

먼저 dry-run으로 대상 커밋을 보여준다.

```bash
bash scripts/rollback.sh --dry-run TP-NNN
```

출력 요약:
```
롤백 대상:
- 커밋: <hash> <subject>
- 커밋 수: <N>
```

커밋이 없으면 중단:
```
No commits found for TP-NNN
```

### Step 3: 실제 롤백 실행

사용자가 계속 진행할 맥락이면 실제 롤백 실행:

```bash
bash scripts/rollback.sh TP-NNN
```

성공 시:
```
Rollback completed for TP-NNN
```

실패 시:
- 충돌: `Rollback conflict, manual intervention needed`
- 이 경우 수동 개입 필요 사항을 함께 보고

### Step 4: 결과 보고

다음을 사용자에게 요약한다:

```
롤백 결과: TP-NNN
- 결과: success | failed
- revert 커밋: revert: rollback TP-NNN changes
- 로그: artifacts/logs/rollback.log
```

## 주의사항

- 자동 롤백은 금지. `/rollback TP-NNN` 명령으로만 수행한다.
- 원격 force push는 하지 않는다.
- INDEX.md 상태 변경은 수동으로 남긴다.
