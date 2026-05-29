#!/usr/bin/env bash
# deploy-staging.sh — full staging workflow
# 1. Build
# 2. Deploy to Firebase Hosting "staging" channel
# 3. Write current HEAD hash to .claude/.staging-gate (production deploy is gated on this)
# 4. Print staging URL + prompt for production confirmation
#
# Run via:  npm run deploy:staging
#           (or: bash scripts/deploy-staging.sh from villa-lev-platform/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"
GATE_FILE="$REPO_DIR/.claude/.staging-gate"

cd "$APP_DIR"

echo "" >&2
echo "════════════════════════════════════════════════════════" >&2
echo " STAGING DEPLOY — villa-lev-platform" >&2
echo "════════════════════════════════════════════════════════" >&2

# ── Step 1: Build ─────────────────────────────────────────
echo "" >&2
echo "── 1/3  Building..." >&2
npm run build

# ── Step 2: Deploy to staging channel ─────────────────────
echo "" >&2
echo "── 2/3  Deploying to Firebase staging site..." >&2
DEPLOY_OUTPUT=$(firebase deploy --only hosting:staging 2>&1)
echo "$DEPLOY_OUTPUT" >&2

STAGING_URL="https://villa-lev-finance-staging.web.app"

# ── Step 3: Write gate file ────────────────────────────────
CURRENT_HEAD=$(git -C "$REPO_DIR" rev-parse HEAD)
echo "$CURRENT_HEAD" > "$GATE_FILE"

echo "" >&2
echo "── 3/3  Gate written — HEAD: ${CURRENT_HEAD:0:8}" >&2
echo "" >&2
echo "════════════════════════════════════════════════════════" >&2
if [[ -n "$STAGING_URL" ]]; then
  echo " ✅  STAGING: $STAGING_URL" >&2
else
  echo " ✅  Staging deployed (see URL above)" >&2
fi
echo "" >&2
echo " Open in an incognito window and verify the change." >&2
echo "" >&2
echo " Ready to go live? → Commit and make live to production?" >&2
echo "════════════════════════════════════════════════════════" >&2
