#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'root로 실행해 주세요.'; exit 1; }
[[ -f /opt/cnchome/server/auto-deploy.sh ]] || { echo '먼저 GitHub 최신 코드를 내려받아 주세요.'; exit 1; }
cat > /etc/systemd/system/cnchome-deploy.service <<'UNIT'
[Unit]
Description=Deploy cnchome updates from GitHub
Wants=network-online.target
After=network-online.target nginx.service mysql.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/cnchome
ExecStart=/bin/bash /opt/cnchome/server/auto-deploy.sh
TimeoutStartSec=300
UMask=0022
UNIT
cat > /etc/systemd/system/cnchome-deploy.timer <<'UNIT'
[Unit]
Description=Check cnchome updates every minute

[Timer]
OnBootSec=60
OnUnitInactiveSec=60
AccuracySec=5
Unit=cnchome-deploy.service

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now cnchome-deploy.timer
systemctl start cnchome-deploy.service
systemctl is-active cnchome-deploy.timer
echo '자동 배포 등록 완료 · GitHub main 변경을 1분 간격으로 확인합니다.'
