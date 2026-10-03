#!/usr/bin/env bash
set -euo pipefail
exec 9>/run/lock/cnchome-auto-deploy.lock
flock -n 9 || exit 0
cd /opt/cnchome
export GIT_TERMINAL_PROMPT=0
install -d -m 700 /var/lib/cnchome-deploy
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo '서버 코드에 직접 수정한 내용이 있어 자동 배포를 중단합니다.'; exit 1
fi
git fetch origin main
revision=$(git rev-parse origin/main)
state=/var/lib/cnchome-deploy
if [[ -f "$state/success" && $(cat "$state/success") == "$revision" ]]; then exit 0; fi
retry_count=0
if [[ -f "$state/attempt" && $(cat "$state/attempt") == "$revision" ]]; then
  retry_after=$(cat "$state/retry-after" 2>/dev/null || true)
  if [[ "$retry_after" =~ ^[0-9]+$ ]] && (( $(date +%s) < retry_after )); then
    echo '이전 배포 실패 후 자동 재시도 대기 중입니다.'; exit 0
  fi
  saved_count=$(cat "$state/retry-count" 2>/dev/null || true)
  if [[ "$saved_count" =~ ^[0-9]{1,6}$ ]]; then retry_count=$((10#$saved_count)); fi
fi
git merge --ff-only origin/main
printf '%s\n' "$revision" > "$state/attempt"
if bash server/deploy.sh; then
  printf '%s\n' "$revision" > "$state/success"
  rm -f "$state/retry-after" "$state/retry-count"
  echo "자동 배포 완료: $revision"
else
  retry_count=$((retry_count+1))
  exponent=$((retry_count-1)); if (( exponent > 4 )); then exponent=4; fi
  retry_delay=$((60*(1<<exponent))); if (( retry_delay > 900 )); then retry_delay=900; fi
  printf '%s\n' "$retry_count" > "$state/retry-count"
  printf '%s\n' "$(( $(date +%s)+retry_delay ))" > "$state/retry-after"
  echo "자동 배포 실패: $revision. ${retry_delay}초 후 재시도합니다. journalctl -u cnchome-deploy.service 로 확인하세요."
  exit 1
fi
