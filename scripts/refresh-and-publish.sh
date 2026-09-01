#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$REPO_DIR"

export DYL_NAWFUL_CDP_ENDPOINT="${DYL_NAWFUL_CDP_ENDPOINT:-http://127.0.0.1:9222}"

cdp_ready() {
  curl --fail --silent --show-error --max-time 2 \
    "$DYL_NAWFUL_CDP_ENDPOINT/json/version" >/dev/null 2>&1
}

start_cdp_browser() {
  local browser_bin profile_dir

  if command -v chromium >/dev/null 2>&1; then
    browser_bin="$(command -v chromium)"
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    browser_bin="$(command -v google-chrome-stable)"
  else
    echo "Chromium or Google Chrome is required for snapshot collection." >&2
    return 127
  fi

  profile_dir="${DYL_NAWFUL_CHROME_PROFILE:-$HOME/.config/chromium-dyl-nawful}"
  mkdir -p "$profile_dir"

  echo "Starting the dedicated Dyl Nawful browser profile..."
  setsid uwsm-app -- "$browser_bin" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
    --user-data-dir="$profile_dir" \
    --no-first-run \
    --no-default-browser-check \
    https://x.com/MarioNawfal >/tmp/dyl-nawful-chromium.log 2>&1 &

  for _ in $(seq 1 30); do
    cdp_ready && return 0
    sleep 1
  done

  echo "Chromium started but CDP did not become ready; see /tmp/dyl-nawful-chromium.log." >&2
  return 1
}

cdp_ready || start_cdp_browser

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
