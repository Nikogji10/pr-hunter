// PR Hunter · Eigenes Hintergrundbild: verkleinert auf höchstens 1600 px (JPEG), darüber eine Abdunklung in der Farbe des
// Designs; Karten werden dann zu Glas. Auf dem Gerät im Browser-Speicher (sofort beim Start da), in der Datenbank in
// user_assets (Update 11) – „offen“ heißt: noch nicht hochgeladen. Die Abdunklung liegt in den App-Einstellungen.
import { speicher } from './basis.js';

const BILD = 'prh-hintergrund', DUNKEL = 'prh-hintergrund-dunkel', STAND = 'prh-hintergrund-stand', OFFEN = 'prh-hintergrund-offen';
export const ABDUNKELN = [[0.35, 'Leicht'], [0.55, 'Mittel'], [0.75, 'Stark']];

/** Bild anwenden (oder entfernen mit null). */
export function setzeHintergrund(dataUrl, dunkel = 0.55) {
  const el = document.documentElement;
  if (dataUrl) {
    el.style.setProperty('--bild', `url("${dataUrl}")`);
    el.style.setProperty('--bild-dunkel', String(dunkel));
    el.classList.add('mit-bild');
  } else {
    el.style.removeProperty('--bild');
    el.classList.remove('mit-bild');
  }
}

export const hintergrund = () => ({ bild: speicher.lies(BILD), dunkel: Number(speicher.lies(DUNKEL)) || 0.55, stand: speicher.lies(STAND), offen: speicher.lies(OFFEN) === '1' });
export const ladeHintergrund = () => { const h = hintergrund(); setzeHintergrund(h.bild, h.dunkel); };

/** Bild speichern (vom Nutzer gewählt → offen, oder vom Server geholt → mit Stand); false, wenn der Speicher voll ist. */
export function speichereHintergrund(dataUrl, dunkel, { stand = null, offen = true } = {}) {
  try {
    if (dataUrl) localStorage.setItem(BILD, dataUrl); else localStorage.removeItem(BILD);
    localStorage.setItem(DUNKEL, String(dunkel));
    if (offen) localStorage.setItem(OFFEN, '1'); else localStorage.removeItem(OFFEN);
    if (stand) localStorage.setItem(STAND, stand);
  } catch { return false; }
  setzeHintergrund(dataUrl, dunkel);
  return true;
}
/** Nur die Abdunklung ändern (kommt aus den Einstellungen, auch von einem anderen Gerät). */
export function setzeAbdunklung(dunkel) {
  const h = hintergrund();
  speicher.schreib(DUNKEL, String(dunkel));
  setzeHintergrund(h.bild, dunkel);
}

/**
 * Abgleich mit user_assets: offenes Bild hochladen, sonst bei neuerem Serverstand herunterladen.
 * dienste: { hochladen(bild) → stand, stand() → stand, laden() → { hintergrund, updated_at } }.
 */
export async function hintergrundAbgleichen(dienste) {
  const h = hintergrund();
  if (h.offen) {
    const stand = await dienste.hochladen(h.bild);
    speicher.schreib(STAND, stand);
    try { localStorage.removeItem(OFFEN); } catch { /* egal */ }
    return;
  }
  const stand = await dienste.stand();
  if (!stand || stand === h.stand) return;
  const r = await dienste.laden();
  speichereHintergrund(r?.hintergrund ?? null, h.dunkel, { stand: r?.updated_at ?? stand, offen: false });
}

/** Datei → verkleinertes JPEG als data-URL (längste Seite höchstens 1600 px). */
export async function bildVerkleinern(datei, max = 1600) {
  const url = URL.createObjectURL(datei);
  try {
    const img = await new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fehler(new Error('Das Bild lässt sich nicht lesen.')); i.src = url; });
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/** Profilbild: quadratischer Ausschnitt aus der Mitte, 256 × 256 px, JPEG (wenige KB, liegt im Profil). */
export async function profilbildAusDatei(datei, kante = 256) {
  const url = URL.createObjectURL(datei);
  try {
    const img = await new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fehler(new Error('Das Bild lässt sich nicht lesen.')); i.src = url; });
    const seite = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = kante;
    c.getContext('2d').drawImage(img, (img.naturalWidth - seite) / 2, (img.naturalHeight - seite) / 2, seite, seite, 0, 0, kante, kante);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
