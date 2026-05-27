#!/bin/bash
# Deployment-Script für panini01.pob.li
# Ausführen auf dem lokalen Rechner mit: bash deploy.sh
set -e

SERVER="martin@panini01.pob.li"
SSH_KEY="C:/Users/m/SynologyDrive/HomeLab/SSH-Keys/claudecode"
REMOTE_DIR="/opt/panini2026"

echo "==> Dateien auf Server kopieren..."
rsync -avz --exclude='.env' --exclude='*.db' --exclude='__pycache__' \
  -e "ssh -i \"$SSH_KEY\"" \
  . "$SERVER:$REMOTE_DIR/"

echo "==> Docker Images bauen und starten..."
ssh -i "$SSH_KEY" "$SERVER" "
  cd $REMOTE_DIR
  docker compose pull 2>/dev/null || true
  docker compose build --no-cache
  docker compose up -d
  docker compose ps
"

echo "==> Fertig! App läuft auf https://\$(grep DOMAIN $REMOTE_DIR/.env | cut -d= -f2)"
