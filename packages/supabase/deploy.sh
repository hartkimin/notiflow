#!/usr/bin/env bash
set -euo pipefail

# NotiFlow Supabase Deployment Script
# Usage: ./deploy.sh [functions|db|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

deploy_functions() {
  echo "==> Deploying Edge Functions..."
  supabase functions deploy parse-message --no-verify-jwt
  supabase functions deploy send-push --no-verify-jwt
  supabase functions deploy manage-users
  supabase functions deploy test-parse
  echo "==> Edge Functions deployed successfully."
}

deploy_db() {
  echo "==> Pushing database migrations..."
  supabase db push
  echo "==> Database migrations applied successfully."
}

case "${1:-all}" in
  functions)
    deploy_functions
    ;;
  db)
    deploy_db
    ;;
  all)
    deploy_db
    deploy_functions
    ;;
  *)
    echo "Usage: $0 [functions|db|all]"
    exit 1
    ;;
esac

echo "==> Deployment complete!"
