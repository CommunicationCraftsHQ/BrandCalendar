/* ═══════════════════════════════════════════════════════════════════
   MARKETING CALENDAR — the phone's helper. V116.1 Tbilisi, 14 Oct 2026.
   It does two things and nothing else: shows a notification when the
   server sends one, and opens the Calendar on that task when it is
   tapped. There is NO fetch handler on purpose — it never stores or
   serves a copy of any page, so a deploy reaches every phone at once,
   exactly as before.
   ═══════════════════════════════════════════════════════════════════ */
const ICON = 'icons/marketing-calendar/favicon-192x192.png?v=champagneF7';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Mkt Cal', body: e.data ? e.data.text() : '' }; }
  const url = new URL(d.url || 'index.html', self.registration.scope).href;
  e.waitUntil(self.registration.showNotification(d.title || 'Mkt Cal', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: ICON,
    badge: ICON,
    timestamp: d.ts || Date.now(),
    data: { url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // only the Calendar itself — not CC Platform or another tool that
    // happens to live beside it
    const home = new URL(self.registration.scope).pathname;
    const cal = wins.find((w) => {
      const u = new URL(w.url);
      return u.origin === self.location.origin && (u.pathname === home || u.pathname === home + 'index.html');
    });
    if (cal) {
      // the Calendar is already open: bring it forward and let it move
      // to the task itself, without reloading the page
      await cal.focus();
      cal.postMessage({ type: 'cc-open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
