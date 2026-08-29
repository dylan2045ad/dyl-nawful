// workers/x-proxy.mjs
// Cloudflare Worker scaffold: fetches the public X (twitter) profile page and returns raw HTML.
// NOTE: This is a lightweight scaffold only — parsing X's HTML is fragile and may break if X changes.
// Deploy this Worker (or adapt for Vercel/Netlify function) and point your frontend to the worker URL.

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const username = url.searchParams.get('username') || 'MarioNawfal';
      const target = `https://x.com/${encodeURIComponent(username)}`;

      const res = await fetch(target, {
        headers: {
          'User-Agent': 'Dyl-Nawful-Proxy/1.0 (+https://github.com/dylan2045ad/dyl-nawful)'
        }
      });

      if (!res.ok) return new Response(`Upstream fetch failed: ${res.status}`, { status: 502 });
      const html = await res.text();

      // Return a small JSON envelope with the raw HTML. Parsing to extract posts should be
      // done by a collector (server-side) or enhanced here with a robust HTML parser.
      return new Response(JSON.stringify({
        fetchedAt: new Date().toISOString(),
        username,
        html
      }), {
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
