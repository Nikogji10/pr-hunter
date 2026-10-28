// PR Hunter · Service Worker: hält die App-Dateien auf dem Handy, damit sie ohne Netz startet.
// VERSION und DATEIEN setzt tools/app_bereitstellen.py beim Bauen (Inhalts-Prüfsumme → jede Änderung lädt neu).
// Anfragen an Supabase gehen nie durch den Cache. Übungsbilder (Free Exercise DB auf GitHub) landen beim ersten Laden in
// einem eigenen Cache, der Versionswechsel überdauert.
const VERSION = '0cc8cdd9114f';
const DATEIEN = [
  "./",
  "app.js",
  "css/app.css",
  "css/schriften.css",
  "daten/katalog.json",
  "fonts/archivo-100-900-latin-ext.woff2",
  "fonts/archivo-100-900-latin.woff2",
  "fonts/big-shoulders-stencil-display-800-latin-ext.woff2",
  "fonts/big-shoulders-stencil-display-800-latin.woff2",
  "fonts/big-shoulders-stencil-display-900-latin-ext.woff2",
  "fonts/big-shoulders-stencil-display-900-latin.woff2",
  "fonts/encode-sans-latin-ext-wdth-normal.woff2",
  "fonts/encode-sans-latin-wdth-normal.woff2",
  "fonts/saira-latin-ext-wdth-normal.woff2",
  "fonts/saira-latin-wdth-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/badge-96.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/auswertung.js",
  "js/bearbeiten.js",
  "js/block.js",
  "js/bodybuilding.js",
  "js/daten.js",
  "js/generator.js",
  "js/import.js",
  "js/konto.js",
  "js/lokal.js",
  "js/programm.js",
  "js/punkte.js",
  "js/rechnen.js",
  "js/supabase.js",
  "js/sync.js",
  "js/verweise.js",
  "manifest.webmanifest",
  "programme/candito_6_week.json",
  "programme/candito_int_adv_bench.json",
  "programme/pr_hybrid_candito_pana.json",
  "ui/abschluss.js",
  "ui/basis.js",
  "ui/bbgenerator.js",
  "ui/beispiel.js",
  "ui/bereitschaft.js",
  "ui/diagramme.js",
  "ui/editor.js",
  "ui/eigenerplan.js",
  "ui/einfuehrung.js",
  "ui/einstellungen.js",
  "ui/en.js",
  "ui/feed.js",
  "ui/generator.js",
  "ui/gewicht.js",
  "ui/hintergrund.js",
  "ui/koerper.js",
  "ui/mitteilung.js",
  "ui/plan.js",
  "ui/programme.js",
  "ui/programmtexte.js",
  "ui/rechner.js",
  "ui/sprache.js",
  "ui/stand.js",
  "ui/statistik.js",
  "ui/suche.js",
  "ui/training.js",
  "ui/uebung.js",
  "ui/vergleich.js",
  "ui/verlauf.js",
  "ui/zuschnitt.js",
  "vendor/htm-preact.js",
  "vendor/supabase.js"
];
const CACHE = `prh-${VERSION}`;
const BILDER = 'bilder-v1';
const BILD_QUELLE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((alle) => Promise.all(alle.filter((k) => k.startsWith('prh-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Tippen auf eine Benachrichtigung (laufendes Training, Pausenende): offene App nach vorne holen, sonst öffnen
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
    const offen = fenster.find((f) => f.url.startsWith(self.registration.scope));
    return offen ? offen.focus() : self.clients.openWindow(e.notification.data?.url ?? './#training');
  }));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && e.request.url.startsWith(BILD_QUELLE)) {
    e.respondWith(caches.open(BILDER).then((c) => c.match(e.request).then((treffer) => treffer
      ?? fetch(e.request).then((antwort) => { if (antwort.ok || antwort.type === 'opaque') c.put(e.request, antwort.clone()); return antwort; }))));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // App-Dateien: erst Cache, sonst Netz. Seitenaufrufe (auch mit ?demo) bekommen die gespeicherte index.html.
  const schluessel = e.request.mode === 'navigate' ? new URL('./index.html', self.location).href : e.request;
  e.respondWith(caches.match(schluessel, { ignoreSearch: e.request.mode === 'navigate' }).then((treffer) => treffer ?? fetch(e.request)));
});
