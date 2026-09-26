#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $(id -u) == 0 ]] || { echo 'root로 실행해 주세요.'; exit 1; }
[[ -f /etc/cnchome/database.json ]] || { echo 'DB 연결 설정이 없습니다.'; exit 1; }
for file in server/lib/*.php server/public/*.php server/bin/*.php; do php -l "$file" >/dev/null; done
nginx -t
php server/bin/migrate.php
backup="/var/backups/cnchome/$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /var/www/html "$backup/html"
if [[ -d /opt/cnchome-runtime ]]; then cp -a /opt/cnchome-runtime "$backup/runtime"; fi
install -d -m 755 /opt/cnchome-runtime
install -m 644 server/lib/*.php index.html /opt/cnchome-runtime/
install -m 644 ./*.js ./*.css payroll.html cnc-mark.svg /var/www/html/
for file in server/public/*.php; do
  target="/var/www/html/$(basename "$file")"
  install -m 644 "$file" "$target.new"
  mv "$target.new" "$target"
done
# Keep the original static demo available; the entry page leads to authenticated office.
install -m 644 index.html /var/www/html/preview.html
printf '%s\n' '<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/office.php"><title>씨앤씨 · 업무 관리</title><a href="/office.php">씨앤씨 관리자 로그인</a></html>' > /var/www/html/index.html
chmod 644 /var/www/html/index.html
# On a PHP misconfiguration, do not leave PHP endpoints readable as source.
check=$(mktemp /var/www/html/runtime-check-XXXXXXXX.php)
trap 'rm -f "$check"' EXIT
printf '%s' '<?php header("Content-Type: text/plain"); echo "CNCHOME_PHP_OK";' > "$check"
chmod 644 "$check"
if [[ $(curl --fail --silent --show-error --max-time 20 --resolve jacksayway.cafe24.com:443:127.0.0.1 "https://jacksayway.cafe24.com/$(basename "$check")") != CNCHOME_PHP_OK ]]; then
  for file in server/public/*.php; do chmod 600 "/var/www/html/$(basename "$file")"; done
  echo "PHP 실행 확인 실패. 공개 PHP 접근을 차단했습니다. 백업: $backup"; exit 1
fi
printf '배포 완료. 백업: %s\n' "$backup"
printf '관리자 계정 생성: php /opt/cnchome/server/bin/create-user.php admin admin insurance\n'
