import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshot, normalizePosts } from "../scripts/lib/snapshot.mjs";

const now = "2026-08-23T16:30:00.000Z";
const row = (id, time, overrides = {}) => ({
  status: `/MarioNawfal/status/${id}`,
  time,
  text: `Post ${id}`,
  isPinned: false,
  hasRetweet: false,
  ...overrides
});

test("keeps only posts in the 20-hour window", () => {
  const posts = normalizePosts([
    row("1", "2026-08-22T20:31:00.000Z"),
    row("2", "2026-08-22T20:29:59.000Z")
  ], { now });
  assert.deepEqual(posts.map(post => post.id), ["1"]);
});

test("sorts chronologically and caps the newest 20", () => {
  const rows = Array.from({ length: 24 }, (_, index) => row(
    String(index + 1),
    new Date(Date.parse(now) - index * 60_000).toISOString()
  ));
  const posts = normalizePosts(rows, { now });
  assert.equal(posts.length, 20);
  assert.equal(posts[0].id, "20");
  assert.equal(posts.at(-1).id, "1");
});

test("drops pinned, reposted, malformed, duplicate and future rows", () => {
  const posts = normalizePosts([
    row("1", "2026-08-23T16:00:00.000Z"),
    row("1", "2026-08-23T16:00:00.000Z"),
    row("2", "2026-08-23T16:01:00.000Z", { isPinned: true }),
    row("3", "2026-08-23T16:02:00.000Z", { hasRetweet: true }),
    row("4", "not-a-date"),
    row("5", "2026-08-23T16:31:00.000Z"),
    { status: "/someone/status/6", time: now, text: "Wrong account" }
  ], { now });
  assert.deepEqual(posts.map(post => post.id), ["1"]);
});

test("creates the public snapshot contract", () => {
  const snapshot = createSnapshot([row("9", "2026-08-23T16:00:00.000Z")], { now });
  assert.equal(snapshot.account, "MarioNawfal");
  assert.equal(snapshot.windowHours, 20);
  assert.equal(snapshot.source, "authenticated-chrome");
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.posts.length, 1);
});
