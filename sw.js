// PR Hunter · Service Worker: hält die App-Dateien auf dem Handy, damit sie ohne Netz startet.
// VERSION und DATEIEN setzt tools/app_bereitstellen.py beim Bauen (Inhalts-Prüfsumme → jede Änderung lädt neu).
// Anfragen an Supabase gehen nie durch den Cache. Übungsbilder (Free Exercise DB auf GitHub) landen beim ersten Laden in
// einem eigenen Cache, der Versionswechsel überdauert.
// 04.11.: Bilder per CORS holen. Vorher kamen sie als „opaque“ (img ohne crossorigin) – Chrome rechnet jede solche Antwort
// mit ~7 MB an, ein paar hundert Bilder ergaben 3,9 GB „gespeicherte Daten“. bilder-v1 wird deshalb gelöscht.
const VERSION = 'f4ed1fd5a0fe';
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
  "js/ausdauer.js",
  "js/ausdauerplan.js",
  "js/auswertung.js",
  "js/autoregulation.js",
  "js/bearbeiten.js",
  "js/beschwerden.js",
  "js/block.js",
  "js/bodybuilding.js",
  "js/dateiimport.js",
  "js/daten.js",
  "js/erfolge.js",
  "js/generator.js",
  "js/import.js",
  "js/insights.js",
  "js/kidaten.js",
  "js/kombiplan.js",
  "js/konto.js",
  "js/kuerzen.js",
  "js/lokal.js",
  "js/notizchips.js",
  "js/pausenbalken.js",
  "js/programm.js",
  "js/progression.js",
  "js/punkte.js",
  "js/rechnen.js",
  "js/rpegenauigkeit.js",
  "js/rueckblick.js",
  "js/scheibenwechsel.js",
  "js/spotify.js",
  "js/stillstand.js",
  "js/supabase.js",
  "js/sync.js",
  "js/technik.js",
  "js/verweise.js",
  "js/zyklus.js",
  "manifest.webmanifest",
  "programme/candito_6_week.json",
  "programme/candito_int_adv_bench.json",
  "programme/pr_hybrid_candito_pana.json",
  "ui/abschluss.js",
  "ui/ansage.js",
  "ui/aufwaermroutine.js",
  "ui/ausdauer.js",
  "ui/ausdauerplan.js",
  "ui/ausdauerstatistik.js",
  "ui/basis.js",
  "ui/bbgenerator.js",
  "ui/bereitschaft.js",
  "ui/beschwerde.js",
  "ui/challenges.js",
  "ui/coach.js",
  "ui/diagramme.js",
  "ui/editor.js",
  "ui/eigenerplan.js",
  "ui/einfuehrung.js",
  "ui/einsteiger.js",
  "ui/einstellungen.js",
  "ui/en.js",
  "ui/feed.js",
  "ui/generator.js",
  "ui/gewicht.js",
  "ui/gewichtimport.js",
  "ui/glossar.js",
  "ui/gruppen.js",
  "ui/gruss.js",
  "ui/hilfe.js",
  "ui/hintergrund.js",
  "ui/insights.js",
  "ui/ki.js",
  "ui/koerper.js",
  "ui/langeoffen.js",
  "ui/masse.js",
  "ui/menue.js",
  "ui/mitteilung.js",
  "ui/plan.js",
  "ui/plandruck.js",
  "ui/planer.js",
  "ui/plgenerator.js",
  "ui/programme.js",
  "ui/programmtexte.js",
  "ui/rechner.js",
  "ui/rueckblick.js",
  "ui/spotify.js",
  "ui/sprache.js",
  "ui/stand.js",
  "ui/statistik.js",
  "ui/suche.js",
  "ui/timer.js",
  "ui/training.js",
  "ui/trainingsimport.js",
  "ui/uebung.js",
  "ui/vergleich.js",
  "ui/verlauf.js",
  "ui/wettkaempfe.js",
  "ui/wettkampf.js",
  "ui/zusammen.js",
  "ui/zuschnitt.js",
  "ui/zyklus.js",
  "vendor/htm-preact.js",
  "vendor/supabase.js"
];
const CACHE = `prh-${VERSION}`;
const BILDER = 'bilder-v2';
const BILD_QUELLE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((alle) => Promise.all(alle.filter((k) => (k.startsWith('prh-') && k !== CACHE) || (k.startsWith('bilder-') && k !== BILDER)).map((k) => caches.delete(k))))
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
    // nach URL speichern und per CORS laden (echte Größe statt Opaque-Aufschlag); klappt CORS nicht, Bild nur anzeigen, nicht speichern
    const schluessel = e.request.url;
    e.respondWith(caches.open(BILDER).then((c) => c.match(schluessel).then((treffer) => treffer
      ?? fetch(schluessel, { mode: 'cors', credentials: 'omit' }).then((antwort) => { if (antwort.ok) c.put(schluessel, antwort.clone()); return antwort; })
        .catch(() => fetch(e.request)))));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // App-Dateien: erst Cache, sonst Netz. Seitenaufrufe (auch mit ?demo) bekommen die gespeicherte index.html.
  const schluessel = e.request.mode === 'navigate' ? new URL('./index.html', self.location).href : e.request;
  e.respondWith(caches.match(schluessel, { ignoreSearch: e.request.mode === 'navigate' }).then((treffer) => treffer ?? fetch(e.request)));
});
