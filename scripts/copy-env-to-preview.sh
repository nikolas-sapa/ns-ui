#!/usr/bin/env bash
# Copies the six /submit variables from Production to "all Preview branches".
#
# Why this is a script you run rather than something the agent ran: `vercel env
# add <name> preview` needs to be told which git branch, and answering "all
# preview branches" means omitting the argument and confirming at a prompt.
# In non-interactive mode (which the CLI selects automatically when it detects
# an agent) that prompt cannot be answered, so it returns `git_branch_required`
# forever. Interactive shells do not have that problem.
#
# Values are read straight from Production and never printed.
#
#   bash scripts/copy-env-to-preview.sh
#
set -euo pipefail

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
vercel env pull "$TMP/.env.production" --environment=production >/dev/null

for name in "${VARS[@]}"; do
  # Strip the KEY= prefix and any surrounding quotes; keep the value itself
  # untouched (the HMAC secret is hex, but do not assume that of the others).
  value="$(grep -m1 "^${name}=" "$TMP/.env.production" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"

  if [ -z "$value" ]; then
    echo "  SKIP  $name — not set in Production"
    continue
  fi

  # Omitting the git-branch argument targets all Preview branches. `--force`
  # overwrites a previous value instead of failing.
  if printf '%s' "$value" | vercel env add "$name" preview --force >/dev/null 2>&1; then
    echo "  OK    $name -> preview (all branches)"
  else
    echo "  FAIL  $name — run manually: vercel env add $name preview"
  fi
done

echo
echo "Done. Verify with:  vercel env ls preview"
echo "Env vars bind at BUILD time, so redeploy (or push) for previews to pick them up."
