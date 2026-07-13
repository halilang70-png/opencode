#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "==> fetching upstream (anomalyco/opencode dev branch)..."
git fetch upstream dev

echo "==> merging upstream/dev into local dev..."
if git merge upstream/dev --no-edit; then
  echo "==> merge succeeded"
else
  echo "==> MERGE CONFLICT! Showing conflicted files:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "Run 'git mergetool' or edit the files directly, then:"
  echo "  git add . && git commit -m 'merge upstream/dev'"
  echo "  ./sync-upstream.sh   (re-run this script)"
  exit 1
fi

echo "==> checking for bun..."
if ! command -v bun &>/dev/null; then
  echo "bun not found — skipping build. Install bun to build."
  echo "Sync complete but unverified."
  exit 0
fi

echo "==> installing dependencies..."
bun install --frozen-lockfile

echo "==> running typecheck..."
if bun run typecheck; then
  echo "==> typecheck passed"
else
  echo "==> typecheck FAILED — check errors above"
  exit 1
fi

echo "==> sync complete and verified"
echo ""
echo "To push to your fork:"
echo "  git push origin dev"