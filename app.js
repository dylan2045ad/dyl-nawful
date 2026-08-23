export const READ_STORAGE_KEY = "dyl-nawful-read-posts-v1";
const MAX_STORED_READ_IDS = 1000;

const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
});

export function parseReadIds(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function filterUnreadPosts(posts, readIds) {
  return posts.filter(post => !readIds.has(String(post.id)));
}

export function mergeReadIds(readIds, posts) {
  const merged = new Set(readIds);
  posts.forEach(post => merged.add(String(post.id)));
  return [...merged].slice(-MAX_STORED_READ_IDS);
}

function renderPost(documentRef, post) {
  const item = documentRef.createElement("li");
  item.className = "post-card";
  const body = documentRef.createElement("div");
  body.className = "post-body";
  const meta = documentRef.createElement("div");
  meta.className = "post-meta";
  meta.innerHTML = `<span>${formatter.format(new Date(post.createdAt))}</span><span>@MarioNawfal</span>`;
  const text = documentRef.createElement("p");
  text.className = "post-text";
  text.textContent = post.text;
  const link = documentRef.createElement("a");
  link.className = "post-link";
  link.href = post.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open transmission ->";
  body.append(meta, text, link);
  item.append(body);
  return item;
}

export function initializeApp({
  documentRef = document,
  storage = localStorage,
  fetchImpl = fetch,
  setIntervalImpl = setInterval
} = {}) {
  const list = documentRef.querySelector("#post-list");
  const empty = documentRef.querySelector("#empty-state");
  const count = documentRef.querySelector("#post-count");
  const updated = documentRef.querySelector("#updated-at");
  const status = documentRef.querySelector("#feed-status");
  const markRead = documentRef.querySelector("#mark-read");
  const refresh = documentRef.querySelector("#refresh-feed");
  const refreshMessage = documentRef.querySelector("#refresh-message");
  let visiblePosts = [];
  let isRefreshing = false;

  function loadReadIds() {
    try {
      return parseReadIds(storage.getItem(READ_STORAGE_KEY));
    } catch {
      return new Set();
    }
  }

  function saveReadIds(ids) {
    storage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  }

  async function loadFeed({ manual = false } = {}) {
    if (isRefreshing) return;
    isRefreshing = true;
    refresh.disabled = true;
    refresh.setAttribute("aria-busy", "true");
    refreshMessage.textContent = manual ? "Checking for new articles..." : "";

    try {
      const response = await fetchImpl(`data/posts.json?refresh=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Feed unavailable (${response.status})`);
      const feed = await response.json();
      const cutoff = Date.now() - Number(feed.windowHours || 20) * 60 * 60 * 1000;
      const posts = [...(Array.isArray(feed.posts) ? feed.posts : [])]
        .filter(post => new Date(post.createdAt).getTime() >= cutoff)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-20);
      visiblePosts = filterUnreadPosts(posts, loadReadIds());
      const stale = Boolean(feed.stale) || Date.now() - new Date(feed.generatedAt).getTime() > 2 * 60 * 60 * 1000;
      list.replaceChildren(...visiblePosts.map(post => renderPost(documentRef, post)));
      count.textContent = String(visiblePosts.length).padStart(2, "0");
      updated.textContent = formatter.format(new Date(feed.generatedAt));
      status.textContent = stale ? "Snapshot stale" : "Signal synced";
      status.classList.toggle("is-stale", stale);
      markRead.disabled = visiblePosts.length === 0;
      empty.textContent = posts.length > 0
        ? "You are all caught up. New articles will appear after the next refresh."
        : "No qualifying posts were captured in this 20-hour window.";
      empty.hidden = visiblePosts.length > 0;
      refreshMessage.textContent = manual
        ? `${visiblePosts.length} unread article${visiblePosts.length === 1 ? "" : "s"} loaded.`
        : "";
    } catch (error) {
      count.textContent = "00";
      updated.textContent = "Unavailable";
      status.textContent = "Feed offline";
      empty.textContent = error.message;
      empty.hidden = false;
      refreshMessage.textContent = "Refresh failed. The last page state was preserved.";
    } finally {
      isRefreshing = false;
      refresh.disabled = false;
      refresh.removeAttribute("aria-busy");
    }
  }

  markRead.addEventListener("click", () => {
    if (visiblePosts.length === 0) return;
    const markedCount = visiblePosts.length;
    saveReadIds(mergeReadIds(loadReadIds(), visiblePosts));
    refreshMessage.textContent = `${markedCount} article${markedCount === 1 ? "" : "s"} marked as read. Refresh to clear them.`;
  });

  refresh.addEventListener("click", () => loadFeed({ manual: true }));
  setIntervalImpl(() => loadFeed(), 60 * 60 * 1000);
  loadFeed();

  return { loadFeed };
}

if (typeof document !== "undefined") initializeApp();
