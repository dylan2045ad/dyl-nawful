# Dyl Nawful

A chronological, cyberpunk-styled viewer for up to 20 posts authored by [@MarioNawfal](https://x.com/MarioNawfal) during the latest 20-hour window.

## Data contract

- `data/posts.json` is the public, deployable snapshot.
- Posts are limited to the newest 20 qualifying items and stored oldest to newest.
- Pinned posts, repost-only entries, malformed rows, duplicates, future timestamps, and rows outside 20 hours are rejected.
- The browser collector uses Dylan's existing authenticated Chrome session. No credentials are stored in this repository.
- A failed refresh preserves the last successful snapshot; the page marks data older than two hours as stale.

## Validation

```powershell
npm test
npm run validate
```

## Refresh input

The local updater exports visible authenticated timeline rows to `data/browser-export.json` with this shape:

```json
[
  {
    "status": "/MarioNawfal/status/123",
    "time": "2026-08-23T16:00:00.000Z",
    "text": "Post text",
    "isPinned": false,
    "hasRetweet": false
  }
]
```

Then it runs:

```powershell
node scripts/build-snapshot.mjs
```

GitHub Pages deploys automatically after each verified snapshot commit reaches `main`.

## Hourly refresh

The Windows task `Dyl Nawful Hourly Refresh` runs `scripts/refresh-and-publish.ps1` once per hour while Dylan is signed in. The runner:

1. Connects to the authenticated Chrome CDP session at `http://127.0.0.1:9222`.
2. Collects and validates current `@MarioNawfal` timeline rows.
3. Preserves the last successful snapshot if collection or validation fails.
4. Runs all tests, commits only `data/posts.json`, and pushes `main`.
5. Lets the existing GitHub Pages workflow deploy the verified snapshot.

Install or repair the task with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-hourly-task.ps1
```

Run one refresh manually with `npm run refresh`. Logs are written to `logs/hourly-refresh.log`.

## Read and refresh controls

- `Mark all as read` remembers every visible post in local browser storage.
- `Refresh all articles` fetches the newest deployed snapshot without using the browser cache and removes posts marked read.
- An open page also refreshes automatically once per hour.
