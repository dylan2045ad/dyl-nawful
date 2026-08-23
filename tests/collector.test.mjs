import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMarioStatus, normalizeCollectedRow } from "../scripts/lib/collector.mjs";

test("accepts only canonical Mario Nawfal status URLs", () => {
  assert.equal(canonicalMarioStatus("https://x.com/MarioNawfal/status/123?ref=home"), "/MarioNawfal/status/123");
  assert.equal(canonicalMarioStatus("https://x.com/someone/status/123"), null);
});

test("normalizes valid collected rows and rejects malformed rows", () => {
  assert.deepEqual(normalizeCollectedRow({
    href: "https://x.com/MarioNawfal/status/123",
    time: "2026-08-23T16:00:00Z",
    text: "  New \u201cpost\u201d - it\u2019s live...  ",
    isPinned: false,
    hasRetweet: false
  }), {
    status: "/MarioNawfal/status/123",
    time: "2026-08-23T16:00:00.000Z",
    text: "New \"post\" - it's live...",
    isPinned: false,
    hasRetweet: false
  });
  assert.equal(normalizeCollectedRow({ href: "bad", time: "bad", text: "" }), null);
});
