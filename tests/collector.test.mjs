import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMarioStatus, normalizeCollectedRow } from "../scripts/lib/collector.mjs";
import { assertCdpReady } from "../scripts/collect-x-posts.mjs";

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

test("reports an actionable Chrome CDP preflight failure", async () => {
  await assert.rejects(
    () => assertCdpReady("http://127.0.0.1:9222", async () => { throw new Error("refused"); }),
    /Chrome CDP is unreachable.*remote debugging enabled/
  );
});

test("accepts a healthy Chrome CDP preflight", async () => {
  const version = await assertCdpReady("http://127.0.0.1:9222", async () => ({
    ok: true,
    json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test" })
  }));
  assert.match(version.webSocketDebuggerUrl, /^ws:/);
});
