import test from "node:test";
import assert from "node:assert/strict";
import { MAX_VISIBLE_POSTS, filterUnreadPosts, getFeedStatus, getFeedUrl, mergeReadIds, parseReadIds } from "../app.js";

test("shows up to the newest 30 posts", () => {
  assert.equal(MAX_VISIBLE_POSTS, 30);
});

test("parses stored read IDs and tolerates malformed state", () => {
  assert.deepEqual([...parseReadIds('["1",2]')], ["1", "2"]);
  assert.deepEqual([...parseReadIds("not json")], []);
});

test("filters read posts and marks visible posts without duplicates", () => {
  const posts = [{ id: "1" }, { id: "2" }];
  assert.deepEqual(filterUnreadPosts(posts, new Set(["1"])).map(post => post.id), ["2"]);
  assert.deepEqual(mergeReadIds(new Set(["1"]), posts), ["1", "2"]);
});

test("treats explicit and old snapshots as stale", () => {
  const now = Date.parse("2026-08-24T06:00:00.000Z");
  assert.equal(getFeedStatus({ stale: true, generatedAt: "2026-08-24T05:59:00.000Z" }, now), "Snapshot stale");
  assert.equal(getFeedStatus({ stale: false, generatedAt: "2026-08-24T03:59:00.000Z" }, now), "Snapshot stale");
  assert.equal(getFeedStatus({ stale: false, generatedAt: "2026-08-24T05:59:00.000Z" }, now), "Signal synced");
});

test("builds the feed URL relative to the deployed Pages path", () => {
  assert.equal(
    getFeedUrl("https://dylan2045ad.github.io/dyl-nawful/", 123),
    "https://dylan2045ad.github.io/dyl-nawful/data/posts.json?refresh=123"
  );
});
