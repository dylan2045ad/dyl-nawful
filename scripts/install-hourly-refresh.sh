#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"

cat > "$UNIT_DIR/dyl-nawful-refresh.service" <<EOF
[Unit]
Description=Refresh Dyl Nawful snapshot

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/env bash $REPO_DIR/scripts/refresh-and-publish.sh
EOF

cat > "$UNIT_DIR/dyl-nawful-refresh.timer" <<EOF
[Unit]
Description=Refresh Dyl Nawful snapshot hourly

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true
Unit=dyl-nawful-refresh.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now dyl-nawful-refresh.timer
echo "Hourly refresh enabled."
systemctl --user status dyl-nawful-refresh.timer --no-pager
