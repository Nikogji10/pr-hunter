// PR Hunter · Lokaler Speicher (IndexedDB). Eine Datenbank je Nutzer, damit sich bei einem Kontowechsel nichts mischt.
// trainings: lokale Trainings (Format siehe js/daten.js); meta: Schlüssel/Wert (Serverstand, Block, Einstellungen, laufendes Training).

const VERSION = 1;
const anfrage = (r) => new Promise((ok, fehler) => { r.onsuccess = () => ok(r.result); r.onerror = () => fehler(r.error); });

function oeffne(name) {
  const r = indexedDB.open(name, VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('trainings')) db.createObjectStore('trainings', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
  };
  return anfrage(r);
}

/** Speicher für einen Nutzer: { alle, schreibe, entferne, meta, setzeMeta, leeren } (Schnittstelle wie in js/sync.js erwartet). */
export async function speicherFuer(nutzerId) {
  const db = await oeffne(`pr-hunter-${nutzerId}`);
  const store = (name, modus = 'readonly') => db.transaction(name, modus).objectStore(name);
  return {
    alle: () => anfrage(store('trainings').getAll()),
    schreibe: (w) => anfrage(store('trainings', 'readwrite').put(w)),
    entferne: (id) => anfrage(store('trainings', 'readwrite').delete(id)),
    meta: async (k) => (await anfrage(store('meta').get(k))) ?? null,
    setzeMeta: (k, v) => anfrage(v == null ? store('meta', 'readwrite').delete(k) : store('meta', 'readwrite').put(v, k)),
    async leeren() {
      const t = db.transaction(['trainings', 'meta'], 'readwrite');
      t.objectStore('trainings').clear();
      t.objectStore('meta').clear();
      await new Promise((ok, fehler) => { t.oncomplete = ok; t.onerror = () => fehler(t.error); });
    },
    schliessen: () => db.close(),
  };
}

/** Speicher dauerhaft machen (Browser darf ihn dann nicht bei Platzmangel räumen). iOS ignoriert das teils. */
export async function dauerhaft() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
