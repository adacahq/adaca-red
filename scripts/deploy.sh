#!/usr/bin/env bash
# Deploy + secret sync. A plain `vinext deploy` was observed (2026-07-17)
# building a version from a stale binding snapshot, silently dropping
# secrets that had been `wrangler secret put` since the previous deploy —
# which left the Basic Auth gate open. Re-putting every secret after each
# deploy is idempotent and makes the deployed version converge on .env.
set -euo pipefail
cd "$(dirname "$0")/.."

# Pin the Cloudflare account (Adaca Enterprise) from .env. Without this,
# wrangler falls back to a cached/default account — observed 2026-07-28
# deploying to the WRONG workspace (Lineer) and re-creating a deleted worker
# there, while the red.adaca.com gate check happily passed against the stale
# version still running in the right account.
export CLOUDFLARE_ACCOUNT_ID=$(grep '^CLOUDFLARE_ACCOUNT_ID=' .env | head -1 | cut -d= -f2- | tr -d '"')
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "ERROR: CLOUDFLARE_ACCOUNT_ID missing from .env — refusing to deploy to an ambiguous account" >&2
  exit 1
fi

npx vinext deploy

SECRETS=(
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  RESEND_API_KEY
  EMAIL_FROM
  PUBLIC_ORIGIN
  TURNSTILE_SECRET_KEY
  BASIC_AUTH_USERNAME
  BASIC_AUTH_PASSWORD
)

for KEY in "${SECRETS[@]}"; do
  VALUE=$(grep "^${KEY}=" .env | head -1 | cut -d= -f2- | tr -d '"')
  if [ -n "$VALUE" ]; then
    printf '%s' "$VALUE" | npx wrangler secret put "$KEY" >/dev/null 2>&1 \
      && echo "synced secret: $KEY" \
      || echo "FAILED secret: $KEY"
  else
    echo "skipped (empty in .env): $KEY"
  fi
done

echo "Verifying Basic Auth gate..."
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://red.adaca.com/" || true)
  [ "$CODE" = "401" ] && echo "gate: 401 (closed)" && exit 0
  sleep 4
done
echo "WARNING: gate did not settle to 401 — check wrangler secret list" >&2
exit 1
