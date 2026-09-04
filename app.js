export const READ_STORAGE_KEY = "dyl-nawful-read-posts-v1";
export const MAX_VISIBLE_POSTS = 30;
export const AUTO_REFRESH_MS = 5 * 60 * 1000;
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

export function getFeedStatus(feed, now = Date.now()) {
  const generatedAt = new Date(feed?.generatedAt).getTime();
  const isOld = !Number.isFinite(generatedAt) || now - generatedAt > 2 * 60 * 60 * 1000;
  // Ensure the conditional returns a string in all cases by grouping the boolean
  return (Boolean(feed?.stale) || isOld) ? "Snapshot stale" : "Signal synced";
}

export function getFeedUrl(baseUri = "http://localhost/", now = Date.now()) {
  const url = new URL("data/posts.json", baseUri);
  // GitHub Pages may cache JSON for several minutes. A unique query key makes
  // every manual reload request a new CDN object while remaining same-origin.
  url.searchParams.set("v", String(now));
  return url.href;
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

  // Create a simple alerts area if not present so we can surface errors
  let alerts = documentRef.querySelector('#alerts');
  if (!alerts) {
    alerts = documentRef.createElement('div');
    alerts.id = 'alerts';
    alerts.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:9999;max-width:320px;';
    documentRef.body.appendChild(alerts);
  }

  function showAlert(message, duration = 8000) {
    try {
      const el = documentRef.createElement('div');
      el.className = 'alert';
      el.textContent = message;
      el.style.cssText = 'background:#111;color:#fff;padding:8px 12px;margin-top:8px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:13px;';
      alerts.appendChild(el);
      setTimeout(() => { el.remove(); }, duration);
    } catch (e) { console.warn('showAlert failed', e); }
  }

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

  // local safe fetch wrapper to provide timeouts, cache-bypass and consistent errors
  async function safeFetchJSON(url, options = {}, {timeoutMs = 10000, cacheBypass = true} = {}) {
    try {
      if (cacheBypass) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}_=${Date.now()}`;
      }
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetchImpl(url, {
        ...options,
        cache: 'no-store',
        signal: controller.signal,
        credentials: 'same-origin'
      });
      clearTimeout(id);
      if (!res.ok) {
        const text = await res.text().catch(()=>'<no body>');
        const err = new Error(`Fetch failed ${res.status} ${res.statusText}: ${text}`);
        err.status = res.status;
        throw err;
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return await res.json();
      return await res.text();
    } catch (err) {
      console.error('safeFetchJSON error for', url, err);
      throw err;
    }
  }

  async function loadFeed({ manual = false } = {}) {
    if (isRefreshing) return;
    isRefreshing = true;
    if (refresh) {
      refresh.disabled = true;
      refresh.setAttribute('aria-busy', 'true');
    }
    if (refreshMessage) refreshMessage.textContent = manual ? 'Checking for new articles...' : '';

    try {
      const feedUrl = getFeedUrl(documentRef.baseURI, Date.now());
      const feed = await safeFetchJSON(feedUrl, { method: 'GET' });

      // If the feed is returned as a string (not JSON), try to parse it
      let feedObj = feed;
      if (typeof feed === 'string') {
        try { feedObj = JSON.parse(feed); } catch (e) { /* keep as string */ }
      }

      // If feedObj isn't an object, throw
      if (!feedObj || typeof feedObj !== 'object') {
        throw new Error('Unexpected feed format');
      }

      const cutoff = Date.now() - Number(feedObj.windowHours || 20) * 60 * 60 * 1000;
      const posts = [...(Array.isArray(feedObj.posts) ? feedObj.posts : [])]
        .filter(post => new Date(post.createdAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, MAX_VISIBLE_POSTS);

      visiblePosts = filterUnreadPosts(posts, loadReadIds());
      if (list) list.replaceChildren(...visiblePosts.map(post => renderPost(documentRef, post)));
      if (count) count.textContent = String(visiblePosts.length).padStart(2, "0");
      if (updated) updated.textContent = formatter.format(new Date(feedObj.generatedAt));

      const stale = getFeedStatus(feedObj) === 'Snapshot stale';
      if (status) {
        status.textContent = getFeedStatus(feedObj);
        status.classList.toggle('is-stale', stale);
      }

      if (markRead) markRead.disabled = visiblePosts.length === 0;
      if (empty) {
        empty.textContent = posts.length > 0
          ? 'You are all caught up. New articles will appear after the next refresh.'
          : 'No qualifying posts were captured in this 20-hour window.';
        empty.hidden = visiblePosts.length > 0;
      }

      if (refreshMessage) refreshMessage.textContent = manual
        ? `${visiblePosts.length} unread article${visiblePosts.length === 1 ? '' : 's'} loaded from the latest published snapshot.`
        : '';

      // Clear stale indicator if we successfully refreshed from remote source
      if (!stale && status) status.classList.remove('is-stale');

    } catch (error) {
      console.error('loadFeed failed', error);
      if (refreshMessage) refreshMessage.textContent = `Refresh failed. Showing the last available snapshot (${error.message}).`;
      showAlert(`Refresh failed: ${error.message}`);
    } finally {
      isRefreshing = false;
      if (refresh) {
        refresh.disabled = false;
        refresh.removeAttribute('aria-busy');
      }
    }
  }

  // Mark all as read
  function markAllAsReadAction() {
    try {
      if (visiblePosts.length === 0) return;
      const markedCount = visiblePosts.length;
      saveReadIds(mergeReadIds(loadReadIds(), visiblePosts));
      visiblePosts = [];
      if (list) list.replaceChildren();
      if (count) count.textContent = '00';
      if (markRead) markRead.disabled = true;
      if (empty) {
        empty.textContent = 'You are all caught up. New articles will appear after the next refresh.';
        empty.hidden = false;
      }
      if (refreshMessage) refreshMessage.textContent = `${markedCount} article${markedCount === 1 ? '' : 's'} marked as read.`;
    } catch (err) {
      console.error('markAllAsReadAction failed', err);
      showAlert('Could not mark as read: ' + err.message);
    }
  }

  // Wire up controls using delegation so handlers persist if DOM nodes are replaced
  documentRef.addEventListener('click', (e) => {
    const target = e.target;
    if (target && (target.matches && target.matches('#mark-read') || target.closest && target.closest('#mark-read'))) {
      e.preventDefault();
      markAllAsReadAction();
    } else if (target && (target.matches && target.matches('#refresh-feed') || target.closest && target.closest('#refresh-feed'))) {
      e.preventDefault();
      loadFeed({ manual: true });
    }
  });

  // Keep an open page close to the latest published snapshot. The query-string
  // and no-store request also avoid GitHub Pages/CDN returning an old snapshot.
  setIntervalImpl(() => loadFeed(), AUTO_REFRESH_MS);
  documentRef.addEventListener('visibilitychange', () => {
    if (documentRef.visibilityState === 'visible') loadFeed();
  });
  // Initial load
  loadFeed();

  return { loadFeed };
}

if (typeof document !== "undefined") initializeApp();
