#!/usr/bin/env bash
set -Eeuo pipefail
# Polling health is separate from the last completed runtime deployment.
# Only fixed stages, commit hashes, exit codes and time are public; never Git errors.
deployment_stage=lock
revision=''
target_revision=''
publish_auto_status() {
  local deployment_state=$1 deployment_code=${2:-0} deployment_target=/var/www/html/auto-deploy-status.json
  [[ -d /var/www/html ]] || return 0
  printf '{"revision":"%s","targetRevision":"%s","state":"%s","stage":"%s","exitCode":%s,"checkedAt":"%s"}\n' "$revision" "$target_revision" "$deployment_state" "$deployment_stage" "$deployment_code" "$(date -u +%FT%TZ)" > "$deployment_target.new" || return
  chmod 644 "$deployment_target.new" || return
  mv "$deployment_target.new" "$deployment_target"
}
trap 'deployment_exit=$?; publish_auto_status failed "$deployment_exit" || true; exit "$deployment_exit"' ERR
exec 9>/run/lock/cnchome-auto-deploy.lock
flock -n 9 || exit 0
deployment_stage=repository
cd /opt/cnchome
export GIT_TERMINAL_PROMPT=0
revision=$(git rev-parse HEAD)
publish_auto_status checking || true
install -d -m 700 /var/lib/cnchome-deploy
deployment_stage=tracked-edits
if ! git diff --quiet || ! git diff --cached --quiet; then
  publish_auto_status blocked 1 || true
  echo '서버 코드에 직접 수정한 내용이 있어 자동 배포를 중단합니다.'; exit 1
fi
deployment_stage=fetch
git fetch origin main
target_revision=$(git rev-parse origin/main)
state=/var/lib/cnchome-deploy
if [[ -f "$state/success" && $(cat "$state/success") == "$target_revision" ]]; then
  deployment_stage=current; publish_auto_status current || true; exit 0
fi
retry_count=0
if [[ -f "$state/attempt" && $(cat "$state/attempt") == "$target_revision" ]]; then
  retry_after=$(cat "$state/retry-after" 2>/dev/null || true)
  if [[ "$retry_after" =~ ^[0-9]+$ ]] && (( $(date +%s) < retry_after )); then
    deployment_stage=retry-wait; publish_auto_status waiting || true
    echo '이전 배포 실패 후 자동 재시도 대기 중입니다.'; exit 0
  fi
  saved_count=$(cat "$state/retry-count" 2>/dev/null || true)
  if [[ "$saved_count" =~ ^[0-9]{1,6}$ ]]; then retry_count=$((10#$saved_count)); fi
fi
deployment_stage=merge
git merge --ff-only origin/main
revision=$(git rev-parse HEAD)
printf '%s\n' "$target_revision" > "$state/attempt"
deployment_stage=deployment
publish_auto_status running || true
if bash server/deploy.sh; then
  printf '%s\n' "$target_revision" > "$state/success"
  rm -f "$state/retry-after" "$state/retry-count"
  deployment_stage=complete; publish_auto_status complete || true
  echo "자동 배포 완료: $target_revision"
else
  deployment_exit=$?
  retry_count=$((retry_count+1))
  exponent=$((retry_count-1)); if (( exponent > 4 )); then exponent=4; fi
  retry_delay=$((60*(1<<exponent))); if (( retry_delay > 900 )); then retry_delay=900; fi
  printf '%s\n' "$retry_count" > "$state/retry-count"
  printf '%s\n' "$(( $(date +%s)+retry_delay ))" > "$state/retry-after"
  publish_auto_status failed "$deployment_exit" || true
  echo "자동 배포 실패: $target_revision. ${retry_delay}초 후 재시도합니다. journalctl -u cnchome-deploy.service 로 확인하세요."
  exit 1
fi
