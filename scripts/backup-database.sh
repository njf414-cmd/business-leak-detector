#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p backups

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP="backups/business-leak-detector_${TIMESTAMP}.sql"

echo "Backing up production database..."
echo "Destination: $BACKUP"

npx supabase db dump \
  --linked \
  --data-only \
  --use-copy \
  --file "$BACKUP"

if [ ! -s "$BACKUP" ]; then
  echo "ERROR: Backup file is empty."
  rm -f "$BACKUP"
  exit 1
fi

echo ""
echo "Backup complete."
echo "File: $BACKUP"
du -h "$BACKUP"
