#!/usr/bin/env bash
# Apply the reviewed PHP release from a local Git bundle, without GitHub credentials.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'root SSH 창에서 실행해 주세요.'; exit 1; }
bundle=$(realpath "${1:?사용법: bash server/install-bundle.sh /경로/cnchome-php.bundle}")
[[ -f "$bundle" ]] || { echo '전달받은 bundle 파일이 없습니다.'; exit 1; }
cd /opt/cnchome
[[ -z $(git status --porcelain) ]] || { echo '서버 소스에 수정한 파일이 있습니다. 기존 작업을 보존하기 위해 설치를 중단했습니다.'; exit 1; }
git bundle verify "$bundle"
git fetch "$bundle" refs/heads/refactor/php-application
release=$(git rev-parse FETCH_HEAD)
git merge-base --is-ancestor HEAD "$release" || { echo '서버가 다른 버전으로 변경되었습니다. 덮어쓰지 않고 중단했습니다.'; exit 1; }
php -v >/dev/null
nginx -t
[[ -f /etc/cnchome/database.json ]] || { echo '기존 DB 연결 설정이 없습니다.'; exit 1; }
# Hold the same lock as automatic deployment while switching source and runtime.
systemctl stop cnchome-deploy.timer
exec 9>/run/lock/cnchome-auto-deploy.lock
flock -w 60 9 || { systemctl start cnchome-deploy.timer; echo '진행 중인 배포가 있습니다. 완료 후 다시 시도해 주세요.'; exit 1; }
previous=$(git rev-parse HEAD)
install -d -m 700 /var/lib/cnchome-deploy
printf '%s\n' "$previous" > /var/lib/cnchome-deploy/before-php-release
# Pause the timer across reboot until the same commits have been pushed to GitHub.
systemctl disable cnchome-deploy.timer
trap 'echo "설치 중단. 자동 배포는 정지 상태입니다. 위 오류를 확인해 주세요. 기존 버전: $previous"' ERR
git merge --ff-only "$release"
bash server/deploy.sh
printf '%s\n' "$release" > /var/lib/cnchome-deploy/success
printf '%s\n' "$release" > /var/lib/cnchome-deploy/attempt
printf '설치 완료: %s\n' "$release"
echo 'GitHub 업로드 인증 없이 PHP 버전을 설치했습니다.'
echo 'GitHub에도 같은 버전을 올린 다음 자동 배포를 다시 켤 수 있습니다.'
