/* ═══════════════════════════════════════════════════════════════════
   MARKETING CALENDAR — the phone's helper. V116.4 Tbilisi, 14 Oct 2026.
   It shows a notification when the server sends one and opens the
   Calendar on that task when it is tapped. There is NO fetch handler on
   purpose — it never stores or serves a copy of any page, so a deploy
   reaches every phone at once, exactly as before.

   V116.4 ("03 - Phone notifications, better"):
     one notification per conversation — each new message adds a line
       and the title says "· N new"
     the sender's photo, emoji or initials as the picture on the left
     a picture on the message shown large
     Reply (opens the conversation, keyboard up) and Mark as read
       (clears it without opening)
     the count on the app icon; a white calendar in the status bar
   ═══════════════════════════════════════════════════════════════════ */
const ICON  = 'icons/marketing-calendar/favicon-192x192.png?v=champagneF7';
const BADGE = 'icons/marketing-calendar/badge-96.png?v=1';
const FN    = 'https://qsxldzqdjdplffxqdokd.supabase.co/functions/v1/push-send';
const KEEP  = 5;           // lines a conversation keeps on the lock screen

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* initials on black, or an emoji on stone — the same faces the page draws */
async function face(ini, emoji) {
  try {
    if (typeof OffscreenCanvas === 'undefined') return '';
    const c = new OffscreenCanvas(192, 192), g = c.getContext('2d');
    g.beginPath(); g.arc(96, 96, 96, 0, Math.PI * 2);
    g.fillStyle = emoji ? '#F0EFEB' : '#0D0D0D'; g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (emoji) { g.font = '112px sans-serif'; g.fillText(emoji, 96, 104); }
    else { g.fillStyle = '#FFFFFF'; g.font = 'bold 78px sans-serif'; g.fillText(String(ini || '?').slice(0, 2), 96, 100); }
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'data:image/png;base64,' + btoa(s);
  } catch (x) { return ''; }
}

/* the number on the app icon: every message still waiting */
async function badgeCount() {
  try {
    const all = await self.registration.getNotifications();
    const n = all.reduce((s, x) => s + ((x.data && x.data.n) || 1), 0);
    const nav = self.navigator || {};
    if (n && nav.setAppBadge) await nav.setAppBadge(n);
    else if (!n && nav.clearAppBadge) await nav.clearAppBadge();
  } catch (x) { /* a phone without app badges */ }
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Mkt Cal', body: e.data ? e.data.text() : '' }; }
  const url = new URL(d.url || 'index.html', self.registration.scope).href;
  e.waitUntil((async () => {
    let prev = null;
    if (d.tag && self.registration.getNotifications) {
      try { prev = (await self.registration.getNotifications({ tag: d.tag }))[0] || null; } catch (x) { prev = null; }
    }
    const pd = (prev && prev.data) || {};
    const line = d.line || d.body || '';
    const lines = (pd.lines || []).concat(line ? [line] : []).slice(-KEEP);
    const n = (pd.n || 0) + 1;
    const icon = d.icon || await face(d.ini, d.emoji) || ICON;
    const opts = {
      body: lines.join('\n'),
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon,
      badge: BADGE,
      timestamp: d.ts || Date.now(),
      actions: [{ action: 'reply', title: 'Reply' }, { action: 'read', title: 'Mark as read' }],
      data: { url, lines, n, cid: d.cid || '', key: d.key || '' },
    };
    if (d.image) opts.image = d.image;
    await self.registration.showNotification(n > 1 ? `${d.title || 'Mkt Cal'} · ${n} new` : (d.title || 'Mkt Cal'), opts);
    await badgeCount();
  })());
});

/* Mark as read: the server marks the conversation seen for this phone's
   person, exactly as opening it would — the bell clears too */
async function markRead(data) {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub || !data.cid || !data.key) return;
    await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'seen', endpoint: sub.endpoint, key: data.key, comment_id: data.cid }) });
  } catch (x) { /* offline: the bell still has it */ }
}

self.addEventListener('notificationclose', (e) => e.waitUntil(badgeCount()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  if (e.action === 'read') { e.waitUntil(markRead(data).then(badgeCount)); return; }
  let url = data.url || self.registration.scope;
  if (e.action === 'reply') url += (url.includes('?') ? '&' : '?') + 'reply=1';
  e.waitUntil((async () => {
    await badgeCount();
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
