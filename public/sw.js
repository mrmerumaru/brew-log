// Service worker for the installed app.
//
// Scope is deliberately narrow: cache the shell and the build's static assets
// so the app opens instantly and doesn't show a browser error page when the
// network is flaky. It does NOT make the app work offline in any meaningful
// sense — every brew lives in Supabase, so with no connection you get the shell
// and an error. Real offline logging would need a local write queue that syncs
// later, which is a much larger feature.

const CACHE = "brew-log-v1";
const SHELL = ["/", "/index.html"];

// Public, static, and identical for everyone — safe to cache.
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);

  // Everything else crossing the network is Supabase: per-user, auth-scoped,
  // and changing constantly. Caching it could serve one account's brews to
  // another after a sign-out, or show stale data as though it were current.
  // Leave those requests entirely alone.
  if (!sameOrigin && !isFont) return;

  // Navigations: try the network so a new deploy is picked up, and fall back to
  // the cached shell only when the network fails.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  // Static assets. Vite fingerprints build output, so a filename that exists
  // always has the same bytes — cache-first can't serve a stale version.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && (response.type === "basic" || response.type === "cors")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
