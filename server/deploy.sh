#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $(id -u) == 0 ]] || { echo 'root로 실행해 주세요.'; exit 1; }
[[ -f /etc/cnchome/database.json ]] || { echo 'DB 연결 설정이 없습니다.'; exit 1; }
while IFS= read -r -d '' file; do php -l "$file" >/dev/null; done < <(find server -name '*.php' -type f -print0)
php server/bin/check-views.php
nginx -t
backup="/var/backups/cnchome/$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /var/www/html "$backup/html"
if [[ -d /opt/cnchome-runtime ]]; then cp -a /opt/cnchome-runtime "$backup/runtime"; fi
# Existing additive migrations preserve accounts, grade history and payroll records.
php server/bin/migrate.php
php server/bin/provision-test-user.php
php server/bin/seed-test-data.php
install -d -m 755 /opt/cnchome-runtime /opt/cnchome-runtime/views/partials /opt/cnchome-runtime/config /opt/cnchome-runtime/docs
install -m 644 server/lib/*.php /opt/cnchome-runtime/
install -m 644 server/views/*.php /opt/cnchome-runtime/views/
install -m 644 server/views/partials/*.php /opt/cnchome-runtime/views/partials/
install -m 644 server/config/*.json /opt/cnchome-runtime/config/
install -m 644 docs/*.md docs/*.json /opt/cnchome-runtime/docs/
# Atomic file replacements avoid truncated assets during a page refresh.
for file in ./*.js ./*.css cnc-mark.svg index.html payroll.html; do
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
printf '%s\n' '<!doctype html><html lang="ko"><meta charset="utf-8"><title>씨앤씨</title><body data-cnc-destination="preview.php"><a href="./preview.php?role=admin">미리보기 열기</a><script src="./legacy-redirect.js"></script></body></html>' > /var/www/html/preview.html
chmod 644 /var/www/html/preview.html
# Compatibility index.html handles servers whose index order has HTML before PHP.
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
