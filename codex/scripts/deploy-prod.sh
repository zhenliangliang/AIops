#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v git >/dev/null 2>&1; then
  echo "git not found; abort."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo; abort."
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ -z "${branch}" || "${branch}" == "HEAD" ]]; then
  echo "Detached HEAD; abort."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No 'origin' remote configured. Push manually after setting a remote."
  exit 1
fi

echo "Staging deployable paths only…"
git add \
  app \
  components \
  lib \
  public/collected/live-gpt-image-2 \
  scripts \
  package.json \
  package-lock.json \
  next.config.ts \
  next-env.d.ts \
  tsconfig.json \
  README.md \
  .gitignore \
  .env.example

if git diff --cached --quiet; then
  echo "No staged changes. Nothing to deploy."
  exit 0
fi

ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
msg="deploy: update live gpt-image-2 gallery (${ts})"

echo "Committing: ${msg}"
git commit -m "${msg}"

echo "Pushing to origin/${branch}…"
git push origin "${branch}"

echo "Done. If Vercel Git integration is enabled, production deploy will start automatically."

