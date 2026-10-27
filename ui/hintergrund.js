// PR Hunter · Eigenes Hintergrundbild: verkleinert auf höchstens 1600 px (JPEG), darüber eine Abdunklung in der Farbe des
// Designs; Karten werden dann zu Glas. Auf dem Gerät im Browser-Speicher (sofort beim Start da), in der Datenbank in
// user_assets (Update 11) – „offen“ heißt: noch nicht hochgeladen. Die Abdunklung liegt in den App-Einstellungen.
import { speicher } from './basis.js';

const BILD = 'prh-hintergrund', DUNKEL = 'prh-hintergrund-dunkel', STAND = 'prh-hintergrund-stand', OFFEN = 'prh-hintergrund-offen';

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
export const ladeHintergrund = () => { const h = hintergrund(); setzeHintergrund(h.bild, h.dunkel); setzeNeigung(neigungAn()); };

// Neigung: das Bild folgt ganz leicht der Handyneigung (nur dieses Gerät, Standard an, aus bei „Bewegung reduzieren“).
// Ausgangslage ist, wie das Handy gehalten wird; sie wandert langsam mit, damit das Bild nach dem Hinlegen wieder mittig steht.
const NEIGUNG = 'prh-neigung', STAERKE = 'prh-neigung-staerke', WEG_MAX = 30;   // Stärke 0–100 % → bis 30 px
let neigungAktiv = false, rahmen = 0, lage = null, x = 0, y = 0;
export const neigungAn = () => speicher.lies(NEIGUNG) !== '0';
export const neigungStaerke = () => { const s = Number(speicher.lies(STAERKE)); return Number.isFinite(s) && speicher.lies(STAERKE) != null ? s : 40; };
let weg = (neigungStaerke() / 100) * WEG_MAX;
/** Stärke in Prozent setzen und merken (nur dieses Gerät). */
export function setzeNeigungStaerke(prozent) {
  speicher.schreib(STAERKE, String(prozent));
  weg = (prozent / 100) * WEG_MAX;
  document.documentElement.style.setProperty('--neigung-rand', `${Math.ceil(weg) + 2}px`);
}
const bewegung = (e) => {
  if (e.beta == null || e.gamma == null) return;
  if (!lage) lage = { b: e.beta, g: e.gamma };
  lage.b += (e.beta - lage.b) * 0.01; lage.g += (e.gamma - lage.g) * 0.01;
  x = Math.max(-1, Math.min(1, (e.gamma - lage.g) / 25)); y = Math.max(-1, Math.min(1, (e.beta - lage.b) / 25));
  if (rahmen) return;
  rahmen = requestAnimationFrame(() => {
    rahmen = 0;
    const s = document.documentElement.style;
    s.setProperty('--px', `${(-x * weg).toFixed(1)}px`); s.setProperty('--py', `${(-y * weg).toFixed(1)}px`);
  });
};
export function setzeNeigung(an) {
  const el = document.documentElement;
  const darf = an && 'DeviceOrientationEvent' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (darf && !neigungAktiv) { addEventListener('deviceorientation', bewegung); neigungAktiv = true; }
  if (!darf && neigungAktiv) {
    removeEventListener('deviceorientation', bewegung); neigungAktiv = false; lage = null;
    el.style.removeProperty('--px'); el.style.removeProperty('--py');
  }
  el.classList.toggle('neigung', darf);
  el.style.setProperty('--neigung-rand', `${Math.ceil(weg) + 2}px`);
}
/** Schalter in den Einstellungen; das iPhone fragt nach der Erlaubnis (geht nur direkt nach einem Tippen). */
export async function schalteNeigung(an) {
  speicher.schreib(NEIGUNG, an ? '1' : '0');
  const frage = window.DeviceOrientationEvent?.requestPermission;
  if (an && typeof frage === 'function') {
    try { if (await frage.call(window.DeviceOrientationEvent) !== 'granted') { setzeNeigung(false); return false; } } catch { setzeNeigung(false); return false; }
  }
  setzeNeigung(an);
  return true;
}

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
