const list = document.querySelector("#post-list");
const empty = document.querySelector("#empty-state");
const count = document.querySelector("#post-count");
const updated = document.querySelector("#updated-at");
const status = document.querySelector("#feed-status");

const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
});

function renderPost(post) {
  const item = document.createElement("li");
  item.className = "post-card";
  const body = document.createElement("div");
  body.className = "post-body";
  const meta = document.createElement("div");
  meta.className = "post-meta";
  meta.innerHTML = `<span>${formatter.format(new Date(post.createdAt))}</span><span>@MarioNawfal</span>`;
  const text = document.createElement("p");
  text.className = "post-text";
  text.textContent = post.text;
  const link = document.createElement("a");
  link.className = "post-link";
  link.href = post.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open transmission ->";
  body.append(meta, text, link);
  item.append(body);
  return item;
}

async function loadFeed() {
  try {
    const response = await fetch("data/posts.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Feed unavailable (${response.status})`);
    const feed = await response.json();
    const cutoff = Date.now() - Number(feed.windowHours || 20) * 60 * 60 * 1000;
    const posts = [...feed.posts]
      .filter(post => new Date(post.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-20);
    const stale = Boolean(feed.stale) || Date.now() - new Date(feed.generatedAt).getTime() > 2 * 60 * 60 * 1000;
    list.replaceChildren(...posts.map(renderPost));
    count.textContent = String(posts.length).padStart(2, "0");
    updated.textContent = formatter.format(new Date(feed.generatedAt));
    status.textContent = stale ? "Snapshot stale" : "Signal synced";
    status.classList.toggle("is-stale", stale);
    empty.hidden = posts.length > 0;
  } catch (error) {
    count.textContent = "00";
    updated.textContent = "Unavailable";
    status.textContent = "Feed offline";
    empty.textContent = error.message;
    empty.hidden = false;
  }
}

loadFeed();
