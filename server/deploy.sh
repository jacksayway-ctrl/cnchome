#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
[[ $(id -u) == 0 ]] || { echo 'root로 실행해 주세요.'; exit 1; }
# Public deployment health contains only revision, state, stage and time; never logs or account data.
deployment_stage=prerequisites
publish_deployment_status() {
  local deployment_state=$1 deployment_code=${2:-0} deployment_target=/var/www/html/deployment-status.json
  [[ -d /var/www/html ]] || return 0
  printf '{"revision":"%s","state":"%s","stage":"%s","exitCode":%s,"updatedAt":"%s"}\n' "$(git rev-parse HEAD)" "$deployment_state" "$deployment_stage" "$deployment_code" "$(date -u +%FT%TZ)" > "$deployment_target.new"
  chmod 644 "$deployment_target.new"
  mv "$deployment_target.new" "$deployment_target"
}
trap 'deployment_exit=$?; publish_deployment_status failed "$deployment_exit" || true; exit "$deployment_exit"' ERR
run_deploy_step() {
  deployment_stage=${1##*/}
  publish_deployment_status running
  php "$@"
}
publish_deployment_status running
[[ -f /etc/cnchome/database.json ]] || { echo 'DB 연결 설정이 없습니다.'; exit 1; }
# Intake regression checks use a temporary in-memory DB, never the production DB.
if ! php -r 'exit(in_array("sqlite", PDO::getAvailableDrivers(), true) ? 0 : 1);'; then
  command -v apt-get >/dev/null || { echo '격리 검증에 필요한 PHP SQLite 모듈을 설치해 주세요.'; exit 1; }
  php_cli_version=$(php -r 'echo PHP_MAJOR_VERSION,".",PHP_MINOR_VERSION;')
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "php${php_cli_version}-sqlite3"
  php -r 'exit(in_array("sqlite", PDO::getAvailableDrivers(), true) ? 0 : 1);'
fi
deployment_stage=php-lint
publish_deployment_status running
while IFS= read -r -d '' file; do php -l "$file" >/dev/null; done < <(find server -name '*.php' -type f -print0)
run_deploy_step server/bin/check-views.php
run_deploy_step server/bin/check-intake-management.php
run_deploy_step server/bin/check-intake-live.php
run_deploy_step server/bin/check-receipt-identity.php
run_deploy_step server/bin/check-receipt-identity-repair.php
run_deploy_step server/bin/check-account-transfer.php
run_deploy_step server/bin/check-intake-birth-edit.php
run_deploy_step server/bin/check-address-search.php
run_deploy_step server/bin/check-attendance.php
run_deploy_step server/bin/check-membership.php
run_deploy_step server/bin/check-personnel.php
run_deploy_step server/bin/check-business-calendar.php
run_deploy_step server/bin/check-pay-statements.php
run_deploy_step server/bin/check-grade-ledger.php
run_deploy_step server/bin/check-grade-departments.php
run_deploy_step server/bin/check-grade-summary.php
run_deploy_step server/bin/check-grade-settings.php
run_deploy_step server/bin/check-grade-visibility.php
run_deploy_step server/bin/check-intake-policy.php
run_deploy_step server/bin/check-performance-reset.php
run_deploy_step server/bin/check-user1-cleanup.php
run_deploy_step server/bin/check-automatic-sales-cleanup.php
run_deploy_step server/bin/check-window-session.php
deployment_stage=web-config
publish_deployment_status running
nginx -t
deployment_stage=backup
publish_deployment_status running
backup="/var/backups/cnchome/$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /var/www/html "$backup/html"
if [[ -d /opt/cnchome-runtime ]]; then cp -a /opt/cnchome-runtime "$backup/runtime"; fi
# Existing additive migrations preserve accounts, grade history and payroll records.
run_deploy_step server/bin/migrate.php
# Live operation: never recreate demo sales, attendance or payroll on deployment.
run_deploy_step server/bin/cleanup-automatic-sales.php
run_deploy_step server/bin/update-personnel-schedule.php
deployment_stage=runtime-install
publish_deployment_status running
install -d -m 755 /opt/cnchome-runtime /opt/cnchome-runtime/views/partials /opt/cnchome-runtime/config /opt/cnchome-runtime/docs
install -m 644 server/lib/window-session.php /opt/cnchome-runtime/
install -m 644 server/lib/*.php /opt/cnchome-runtime/
install -m 644 server/views/*.php /opt/cnchome-runtime/views/
install -m 644 server/views/partials/*.php /opt/cnchome-runtime/views/partials/
install -m 644 server/config/*.json /opt/cnchome-runtime/config/
install -m 644 docs/*.md docs/*.json /opt/cnchome-runtime/docs/
# Atomic file replacements avoid truncated assets during a page refresh.
for file in ./*.js ./*.css cnc-mark.svg login-system-notice-v1.png index.html payroll.html; do
  target="/var/www/html/$(basename "$file")"
  install -m 644 "$file" "$target.new"
  mv "$target.new" "$target"
done
for file in server/public/*.php; do
  target="/var/www/html/$(basename "$file")"
  install -m 644 "$file" "$target.new"
  mv "$target.new" "$target"
done
# Old bookmarked demo URLs now enter the PHP-authenticated preview.
printf '%s\n' '<!doctype html><html lang="ko"><meta charset="utf-8"><title>씨앤씨</title><script src="./window-session.js"></script><body data-cnc-destination="preview.php"><a href="./preview.php?role=admin">미리보기 열기</a><script src="./legacy-redirect.js"></script></body></html>' > /var/www/html/preview.html
chmod 644 /var/www/html/preview.html
# Compatibility index.html handles servers whose index order has HTML before PHP.
deployment_stage=php-health
publish_deployment_status running
check=$(mktemp /var/www/html/runtime-check-XXXXXXXX.php)
trap 'rm -f "$check"' EXIT
printf '%s' '<?php header("Content-Type: text/plain"); echo "CNCHOME_PHP_OK";' > "$check"
chmod 644 "$check"
if [[ $(curl --fail --silent --show-error --max-time 20 --resolve jacksayway.cafe24.com:443:127.0.0.1 "https://jacksayway.cafe24.com/$(basename "$check")") != CNCHOME_PHP_OK ]]; then
  for file in server/public/*.php; do chmod 600 "/var/www/html/$(basename "$file")"; done
  echo "PHP 실행 확인 실패. 공개 PHP 접근을 차단했습니다. 백업: $backup"; exit 1
fi
curl --fail --silent --show-error --max-time 20 --resolve jacksayway.cafe24.com:443:127.0.0.1 'https://jacksayway.cafe24.com/login.php?role=employee' -o /dev/null
printf 'PHP 화면 배포 완료. 백업: %s\n' "$backup"
# The separately authorized, transactional data cleanup must not hold back verified screen fixes.
run_deploy_step server/bin/clear-hantest-performance.php
run_deploy_step server/bin/cleanup-user1.php
run_deploy_step server/bin/transfer-lee001-to-lsh.php
run_deploy_step server/bin/repair-receipt-identities.php
deployment_stage=complete
publish_deployment_status complete
