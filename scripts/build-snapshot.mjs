import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSnapshot } from "./lib/snapshot.mjs";

const input = resolve(process.argv[2] ?? "data/browser-export.json");
const output = resolve(process.argv[3] ?? "data/posts.json");
const temp = `${output}.tmp`;
const rows = JSON.parse(await readFile(input, "utf8"));
const snapshot = createSnapshot(rows);

if (snapshot.posts.length === 0) {
  throw new Error("No qualifying @MarioNawfal posts were found. The last successful snapshot was preserved.");
}

await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
await rename(temp, output);
console.log(`Wrote ${snapshot.posts.length} posts to ${output}`);
