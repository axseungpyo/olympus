#!/bin/bash
# scripts/rollback.sh — TP 단위 git revert 롤백 유틸리티

set -euo pipefail

usage() {
    echo "Usage: bash scripts/rollback.sh [--dry-run] TP-NNN"
}

DRY_RUN=0
TP_ID=""

while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            ;;
        TP-*)
            if [ -n "$TP_ID" ]; then
                usage
                exit 1
            fi
            TP_ID="$1"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
    shift
done

if [[ -z "$TP_ID" || ! "$TP_ID" =~ ^TP-[0-9]{3,}(-[a-z]+)?$ ]]; then
    usage
    exit 1
fi

mkdir -p artifacts/logs
LOG_FILE="artifacts/logs/rollback.log"

COMMITS=()
while IFS= read -r line; do
    COMMITS+=("$line")
done < <(git log --format='%H %s' --all --grep="$TP_ID")

if [ "${#COMMITS[@]}" -eq 0 ]; then
    echo "No commits found for ${TP_ID}"
    exit 1
fi

echo "Rollback target for ${TP_ID}:"
for commit in "${COMMITS[@]}"; do
    echo "  ${commit}"
done

if [ "$DRY_RUN" -eq 1 ]; then
    exit 0
fi

REVERTED_HASHES=()
IN_REVERT=0

cleanup_on_error() {
    if [ "$IN_REVERT" -eq 1 ]; then
        git revert --abort >/dev/null 2>&1 || true
    fi
    echo "Rollback conflict, manual intervention needed"
    exit 2
}

trap cleanup_on_error ERR

for commit in "${COMMITS[@]}"; do
    hash="${commit%% *}"
    IN_REVERT=1
    git revert --no-commit "$hash"
    IN_REVERT=0
    REVERTED_HASHES+=("$hash")
done

trap - ERR

git commit -m "revert: rollback ${TP_ID} changes" >/dev/null

timestamp="$(date '+%Y-%m-%d %H:%M')"
hash_csv="$(printf '%s, ' "${REVERTED_HASHES[@]}")"
hash_csv="${hash_csv%, }"
echo "${timestamp} [rollback] ${TP_ID}: reverted commits ${hash_csv}" >> "$LOG_FILE"

echo "Rollback completed for ${TP_ID}"
