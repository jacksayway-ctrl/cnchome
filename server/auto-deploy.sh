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
if [[ -f "$state/attempt" && $(cat "$state/attempt") == "$revision" ]]; then
  echo '이 버전은 이전 배포가 실패하여 재시도하지 않습니다. 오류 수정 후 새 커밋을 게시해 주세요.'; exit 0
fi
git merge --ff-only origin/main
printf '%s\n' "$revision" > "$state/attempt"
if bash server/deploy.sh; then
  printf '%s\n' "$revision" > "$state/success"
  echo "자동 배포 완료: $revision"
else
  echo "자동 배포 실패: $revision. journalctl -u cnchome-deploy.service 로 확인하세요."
  exit 1
fi
