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
