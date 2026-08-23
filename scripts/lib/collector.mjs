const MARIO_STATUS_PATTERN = /^https:\/\/(?:www\.)?x\.com\/MarioNawfal\/status\/(\d+)(?:[/?#].*)?$/i;

export function canonicalMarioStatus(value) {
  const match = String(value ?? "").match(MARIO_STATUS_PATTERN);
  return match ? `/MarioNawfal/status/${match[1]}` : null;
}

export function normalizeCollectedRow(row) {
  const status = canonicalMarioStatus(row?.href);
  const text = String(row?.text ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .trim();
  const time = new Date(row?.time ?? "");
  if (!status || !text || !Number.isFinite(time.getTime())) return null;
  return {
    status,
    time: time.toISOString(),
    text,
    isPinned: Boolean(row?.isPinned),
    hasRetweet: Boolean(row?.hasRetweet)
  };
}
