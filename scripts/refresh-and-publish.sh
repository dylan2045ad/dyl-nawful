#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$REPO_DIR"

export DYL_NAWFUL_CDP_ENDPOINT="${DYL_NAWFUL_CDP_ENDPOINT:-http://127.0.0.1:9222}"

node scripts/collect-x-posts.mjs data/browser-export.json
node scripts/build-snapshot.mjs data/browser-export.json data/posts.json
npm test
npm run validate

if git diff --quiet -- data/posts.json; then
  echo "No snapshot change."
  exit 0
fi

git add -- data/posts.json
git commit -m "Refresh Dyl Nawful snapshot $(date --iso-8601=minutes)"
git push origin main
