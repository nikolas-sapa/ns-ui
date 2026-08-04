#!/usr/bin/env bash
# Copies the six /submit variables from Production to "all Preview branches".
#
#   bash scripts/copy-env-to-preview.sh
#
# Values are read straight from Production and never printed.
#
# TWO THINGS THIS SCRIPT GETS RIGHT THAT THE FIRST VERSION DID NOT, both of
# which made it report success while adding nothing:
#
# 1. It passes the value with `--value`, NOT by piping into stdin. Piping makes
#    the Vercel CLI treat the session as non-interactive, and in that mode
#    omitting the git-branch argument (which is how you say "all preview
#    branches") returns `{"status":"action_required","reason":
#    "git_branch_required"}` instead of prompting.
# 2. It checks that the variable actually EXISTS afterwards rather than
#    trusting the exit code. `vercel env add` exits 0 even when it returns
#    action_required, so an exit-status check is not evidence of anything.
set -uo pipefail

VARS=(
  AUTH_GITHUB_ID
  AUTH_GITHUB_SECRET
  SUBMIT_TOKEN_BINDING_SECRET
  GITHUB_REPO_OWNER
  GITHUB_REPO_NAME
  GITHUB_DEFAULT_BRANCH
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Pulling Production values..."
vercel env pull "$TMP/.env.production" --environment=production >/dev/null 2>&1

echo "Existing Preview variables:"
vercel env ls preview > "$TMP/before.txt" 2>&1

added=0
failed=0

for name in "${VARS[@]}"; do
  value="$(grep -m1 "^${name}=" "$TMP/.env.production" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"

  if [ -z "$value" ]; then
    echo "  SKIP  $name — not set in Production"
    failed=$((failed + 1))
    continue
  fi

  if grep -qE "^ ${name} " "$TMP/before.txt"; then
    vercel env rm "$name" preview --yes >/dev/null 2>&1
  fi

  # No git-branch argument => all Preview branches. `--value` keeps stdin a
  # TTY so that path stays interactive-capable.
  out="$(vercel env add "$name" preview --value "$value" --force 2>&1)"

  # Verify by reading it back. This is the check that matters — the previous
  # version of this script trusted the exit code and reported six successes
  # against zero actual writes.
  if vercel env ls preview 2>/dev/null | grep -qE "^ ${name} "; then
    echo "  OK    $name -> preview (all branches)"
    added=$((added + 1))
  else
    echo "  FAIL  $name"
    echo "$out" | grep -oE '"reason": *"[^"]*"' | head -1 | sed 's/^/          /'
    failed=$((failed + 1))
  fi
done

echo
echo "added: $added   failed: $failed"
if [ "$failed" -gt 0 ]; then
  echo
  echo "For anything that failed, add it interactively and press Enter at the"
  echo "branch prompt to mean ALL preview branches:"
  echo "    vercel env add <NAME> preview"
  exit 1
fi
echo "Env vars bind at BUILD time — redeploy or push for previews to pick them up."
