#!/usr/bin/env bash
# sync-to-cloud-cron.sh — Wrapper for launchd daily sync to Supabase Cloud.
set -euo pipefail

export PATH="/Users/hartmacm4/.local/homebrew/opt/libpq/bin:/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/sync-to-cloud.log"
ENV_FILE="$PROJECT_DIR/apps/web/.env.local"

mkdir -p "$PROJECT_DIR/logs"

echo "" >> "$LOG_FILE"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

# Load CLOUD_DB_URL from .env.local
if [ -f "$ENV_FILE" ]; then
  export CLOUD_DB_URL=$(grep '^CLOUD_DB_URL=' "$ENV_FILE" | cut -d= -f2-)
else
  echo "ERROR: $ENV_FILE not found" >> "$LOG_FILE"
  exit 1
fi

if [ -z "${CLOUD_DB_URL:-}" ]; then
  echo "ERROR: CLOUD_DB_URL not set in $ENV_FILE" >> "$LOG_FILE"
  exit 1
fi

# Run sync and log output
bash "$SCRIPT_DIR/sync-to-cloud.sh" >> "$LOG_FILE" 2>&1
echo "Done: exit $?" >> "$LOG_FILE"
