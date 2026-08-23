import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";
import { normalizeCollectedRow } from "./lib/collector.mjs";

const output = resolve(process.argv[2] ?? "data/browser-export.json");
const endpoint = process.env.DYL_NAWFUL_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const maxScrolls = Number(process.env.DYL_NAWFUL_MAX_SCROLLS ?? 14);
const cutoff = Date.now() - 20 * 60 * 60 * 1000;

async function collectVisibleRows(page) {
  return page.locator('article[data-testid="tweet"]').evaluateAll(articles => articles.map(article => {
    const timeElement = article.querySelector("time");
    const statusLink = timeElement?.closest("a");
    const textElement = article.querySelector('[data-testid="tweetText"]');
    const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent ?? "";
    const articleText = article.textContent ?? "";
    return {
      href: statusLink?.href ?? "",
      time: timeElement?.getAttribute("datetime") ?? "",
      text: textElement?.innerText ?? "",
      isPinned: /(^|\n)Pinned(\n|$)/i.test(articleText),
      hasRetweet: /reposted/i.test(socialContext)
    };
  }));
}

async function collectTimelineRows(page) {
  const collected = new Map();

  for (let attempt = 0; attempt <= maxScrolls; attempt += 1) {
    for (const rawRow of await collectVisibleRows(page)) {
      const row = normalizeCollectedRow(rawRow);
      if (row) collected.set(row.status, row);
    }

    const qualifying = [...collected.values()].filter(row => (
      !row.isPinned && !row.hasRetweet && Date.parse(row.time) >= cutoff
    ));
    if (qualifying.length >= 24) break;
    if (attempt === maxScrolls) break;
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 1.6, 1200)));
    await page.waitForTimeout(900);
  }

  return [...collected.values()];
}

async function main() {
  let page;
  try {
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("Authenticated Chrome context was not found.");
    page = await context.newPage();
    await page.goto("https://x.com/MarioNawfal", { waitUntil: "domcontentloaded", timeout: 45_000 });

    if (/\/i\/flow\/login|\/login/i.test(page.url())) {
      throw new Error("The Chrome X session requires login.");
    }
    await page.locator('a[data-testid="AppTabBar_Profile_Link"]').waitFor({ state: "visible", timeout: 20_000 });
    await page.locator('article[data-testid="tweet"]').first().waitFor({ state: "visible", timeout: 30_000 });

    const rows = await collectTimelineRows(page);
    if (rows.length === 0) throw new Error("No @MarioNawfal timeline rows were collected.");

    await mkdir(dirname(output), { recursive: true });
    const temp = `${output}.tmp`;
    await writeFile(temp, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    await rename(temp, output);
    console.log(`Collected ${rows.length} timeline rows to ${output}`);
  } finally {
    await page?.close().catch(() => {});
  }
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
);
