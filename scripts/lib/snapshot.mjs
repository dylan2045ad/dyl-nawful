const STATUS_PATTERN = /^\/MarioNawfal\/status\/(\d+)$/i;

export function normalizePosts(rows, options = {}) {
  const now = new Date(options.now ?? Date.now());
  const windowHours = options.windowHours ?? 20;
  const limit = options.limit ?? 30;
  const cutoff = now.getTime() - windowHours * 60 * 60 * 1000;
  const unique = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const match = String(row?.status ?? "").match(STATUS_PATTERN);
    const createdAt = new Date(row?.time ?? "");
    const text = String(row?.text ?? "").trim();
    if (!match || !Number.isFinite(createdAt.getTime()) || !text) continue;
    if (row.isPinned || row.hasRetweet || createdAt.getTime() < cutoff || createdAt > now) continue;
    unique.set(match[1], {
      id: match[1],
      createdAt: createdAt.toISOString(),
      text,
      url: `https://x.com/MarioNawfal/status/${match[1]}`
    });
  }

  return [...unique.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function createSnapshot(rows, options = {}) {
  const now = new Date(options.now ?? Date.now());
  const windowHours = options.windowHours ?? 20;
  return {
    account: "MarioNawfal",
    windowHours,
    generatedAt: now.toISOString(),
    source: "authenticated-chrome",
    stale: false,
    posts: normalizePosts(rows, { ...options, now, windowHours })
  };
}
