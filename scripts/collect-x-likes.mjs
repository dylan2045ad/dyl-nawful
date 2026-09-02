import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const output = resolve(process.argv[2] ?? "data/likes-export.json");
const endpoint = process.env.DYL_NAWFUL_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const maxScrolls = Number(process.env.DYL_NAWFUL_MAX_SCROLLS ?? 18);
const targetPosts = Number(process.env.DYL_NAWFUL_TARGET_POSTS ?? 30);
const cutoff = Date.now() - 24 * 60 * 60 * 1000;

async function assertCdpReady(endpoint, fetchImpl = fetch) {
  const response = await fetchImpl(`${endpoint}/json/version`);
  if (!response.ok) {
    throw new Error(`Chrome CDP preflight failed at ${endpoint}/json/version with HTTP ${response.status}.`);
  }
  const version = await response.json();
  if (!version.webSocketDebuggerUrl) {
    throw new Error(`Chrome CDP preflight returned no webSocketDebuggerUrl at ${endpoint}.`);
  }
  return version;
}

function canonicalStatus(href) {
  const match = String(href || "").match(/status\/(\d+)/);
  return match ? `/status/${match[1]}` : null;
}

async function collectVisibleRows(page) {
  return page.locator('article[data-testid="tweet"]').evaluateAll(articles => articles.map(article => {
    const timeElement = article.querySelector("time");
    const statusLink = timeElement?.closest("a");
    const textElement =article.querySelector('[data-testid="tweetText"]');
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
      const status = canonicalStatus(rawRow.href);
      const text = String(rawRow.text || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").trim();
      const time = new Date(rawRow.time || "");
      if (!status || !text || !Number.isFinite(time.getTime())) continue;
      collected.set(status, { status, href: rawRow.href, time: time.toISOString(), text, isPinned: !!rawRow.isPinned, hasRetweet: !!rawRow.hasRetweet });
    }

    const qualifying = [...collected.values()].filter(row => !row.isPinned && !row.hasRetweet && Date.parse(row.time) >= cutoff);
    if (qualifying.length >= targetPosts + 4) break;
    if (attempt === maxScrolls) break;
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 1.6, 1200)));
    await page.waitForTimeout(900);
  }

  return [...collected.values()];
}

async function main() {
  let page;
  try {
    await assertCdpReady(endpoint);
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    const context = browser.contexts()[0];
    if (!context) throw new Error("Authenticated Chrome context was not found.");
    page = await context.newPage();
    await page.goto("https://x.com/i/history/likes", { waitUntil: "domcontentloaded", timeout: 45_000 });

    if (/\/i\/flow\/login|\/login/i.test(page.url())) {
      throw new Error("The Chrome X session requires login.");
    }
    await page.locator('a[data-testid="AppTabBar_Profile_Link"]').waitFor({ state: "visible", timeout: 20_000 });
    await page.locator('article[data-testid="tweet"]').first().waitFor({ state: "visible", timeout: 30_000 });

    const rows = await collectTimelineRows(page);
    const qualifying = rows.filter(row => !row.isPinned && !row.hasRetweet && Date.parse(row.time) >= cutoff);
    if (qualifying.length === 0) throw new Error("No liked posts within 24h were collected.");

    await mkdir(dirname(output), { recursive: true });
    const temp = `${output}.tmp`;
    await writeFile(temp, `${JSON.stringify(qualifying, null, 2)}\n`, "utf8");
    await rename(temp, output);
    console.log(`Collected ${qualifying.length} likes to ${output}`);
  } finally {
    await page?.close().catch(() => {});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    () => process.exit(0),
    error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  );
}
