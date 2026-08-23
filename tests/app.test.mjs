import test from "node:test";
import assert from "node:assert/strict";
import { filterUnreadPosts, mergeReadIds, parseReadIds } from "../app.js";

test("parses stored read IDs and tolerates malformed state", () => {
  assert.deepEqual([...parseReadIds('["1",2]')], ["1", "2"]);
  assert.deepEqual([...parseReadIds("not json")], []);
});

test("filters read posts and marks visible posts without duplicates", () => {
  const posts = [{ id: "1" }, { id: "2" }];
  assert.deepEqual(filterUnreadPosts(posts, new Set(["1"])).map(post => post.id), ["2"]);
  assert.deepEqual(mergeReadIds(new Set(["1"]), posts), ["1", "2"]);
});
