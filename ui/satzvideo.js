// PR Hunter · Satz-Video mit Hantelweg und Tempo (Wünsche 268, 270–281). Video nur auf diesem Gerät (IndexedDB „prh-videos“),
// nie hochgeladen. Im Satz landen nur die Zahlen: extra.video (Kennung), extra.tempo { v: m/s je Wdh, vl: Verlust in % },
// extra.ms (schnellste Wdh, wie das Feld „Tempo (m/s)“). Rechnung in js/hantelweg.js.
// VideoKern ist der gemeinsame Baustein für Training (SatzVideo im Fenster), Verlauf (nur ansehen) und Rechner (Werkzeug).
import { html, useState, useEffect, useRef, Sheet, Portal, deEn, fmt, fmt2, vz, I } from './basis.js';
import { trainingsTage, trainingAm, kanon, HEUTE } from './stand.js';
import { grau, verfolger, wiederholungen, rpeAusTempo, rpeVergleich, plausibel, begrenze, zoomeUm, inVideo, buehnenGroesse, tempoKurve } from '../js/hantelweg.js';
import { tempoSaetze, lastTempoProfil, satzVerluste, istTempoRekord, tagesform, MVT } from '../js/tempo.js';

// #################################################################
// 287/289/290: Vergleich mit früheren Sätzen derselben Übung (aus dem Verlauf, ohne den Tag selbst)
// #################################################################
let VERLAUF = null;
function frueher(key, datum) {
  if (VERLAUF?.tt !== trainingsTage) {
    VERLAUF = { tt: trainingsTage, alle: tempoSaetze(Object.keys(trainingsTage).sort().map((d) => trainingAm(d)).filter(Boolean)).map((s) => ({ ...s, key: kanon(s.key) })) };
  }
  const k = kanon(key);
  return VERLAUF.alle.filter((s) => s.key === k && s.datum !== datum);
}
const besteVon = (s) => (s.extra?.tempo?.v?.length ? Math.max(...s.extra.tempo.v) : s.extra?.ms > 0 ? s.extra.ms : null);
/** Übersicht für eine Übung an einem Tag: Verluste zwischen Sätzen, Tagesform, Profil. saetze: Sätze der Übung heute. */
export function tempoUebersicht(key, lift, saetze, datum = HEUTE) {
  const heute = saetze.map((s) => ({ kg: s.last ?? s.kg, beste: besteVon(s) })).filter((s) => s.beste > 0 && s.kg > 0);
  if (!heute.length) return null;
  const alt = frueher(key, datum), mvt = MVT[lift] ?? null, profil = lastTempoProfil(alt, mvt);
  return { heute, verluste: satzVerluste(heute), tf: profil.b != null ? tagesform(heute, profil, mvt) : null, profil, alt };
}

/** Zeile unter einer Übung im Training: Tempo je Satz, Verlust beim gleichen Gewicht, Tagesform. */
export function TempoZeile({ uebungKey, lift, saetze, datum = HEUTE }) {
  const u = tempoUebersicht(uebungKey, lift, saetze, datum);
  if (!u) return null;
  return html`<div class="tempo-zeile">${KAMERA}<span>${u.heute.map((s) => fmt2(s.beste)).join(' · ')} m/s</span>
    ${u.verluste.map((g) => html`<b key=${g.kg} class=${g.pct >= 20 ? 'warn' : ''}>${vz(-g.pct)} % ${deEn('bei', 'at')} ${fmt(g.kg)}</b>`)}
    ${u.tf ? html`<b class=${u.tf.pct >= 3 ? 'gut' : u.tf.pct <= -3 ? 'schlecht' : ''}>${deEn('Tagesform', 'Today')} ${vz(u.tf.pct)} %</b>` : null}</div>`;
}

/** 294: Tempo-Kurve unter dem Video, läuft mit; Tippen springt an die Stelle. */
function TempoKurve({ analyse, zeit, springen }) {
  const k = tempoKurve(analyse.punkte, analyse.mProPx);
  if (k.length < 3) return null;
  const W = 340, H = 96, L = 6, R = 6, T = 10, U = 14;
  const t0 = k[0].t, t1 = k.at(-1).t, vs = k.map((p) => p.v);
  const hi = Math.max(0.5, ...vs), lo = Math.min(-0.5, ...vs);
  const px = (t) => L + ((t - t0) * (W - L - R)) / Math.max(0.01, t1 - t0), py = (v) => T + ((hi - v) * (H - T - U)) / (hi - lo);
  const linie = (filter) => k.map((p, i) => (filter(p) ? `${i && filter(k[i - 1]) ? 'L' : 'M'}${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}` : '')).join(' ');
  const tippe = (e) => { const r = e.currentTarget.getBoundingClientRect(); springen(t0 + ((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * (t1 - t0)); };
  const z = Math.max(t0, Math.min(t1, zeit));
  const jetzt = k.reduce((b, p) => (Math.abs(p.t - z) < Math.abs(b.t - z) ? p : b), k[0]);
  return html`<div class="sv-kurve"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${deEn('Tempo über die Zeit', 'Velocity over time')} onPointerDown=${tippe}>
    ${(analyse.wdh ?? []).map((w, i) => html`<g key=${i}><rect x=${px(w.von)} width=${Math.max(1, px(w.bis) - px(w.von))} y=${T} height=${H - T - U} class="sv-kurve-wdh"/>
      <text x=${(px(w.von) + px(w.bis)) / 2} y=${H - 3} text-anchor="middle" class="sv-kurve-t">${i + 1}</text></g>`)}
    <line x1=${L} x2=${W - R} y1=${py(0)} y2=${py(0)} class="sv-kurve-null"/>
    <path d=${linie((p) => p.v >= 0)} class="sv-kurve-hoch" fill="none"/>
    <path d=${linie((p) => p.v < 0)} class="sv-kurve-runter" fill="none"/>
    <line x1=${px(z)} x2=${px(z)} y1=${T - 4} y2=${H - U} class="sv-kurve-kopf"/>
    <circle cx=${px(jetzt.t)} cy=${py(jetzt.v)} r="4" class="sv-kurve-punkt"/>
  </svg><span class="sv-kurve-wert">${fmt2(Math.abs(jetzt.v))} m/s ${jetzt.v >= 0.05 ? '↑' : jetzt.v <= -0.05 ? '↓' : ''}</span></div>`;
}

// #################################################################
// Ablage auf dem Gerät
// #################################################################
const DB = 'prh-videos', STORE = 'videos';
let dbOffen = null;
const db = () => (dbOffen ??= new Promise((ok, fehler) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => { dbOffen = null; fehler(r.error); };
}));
async function tx(modus, f) {
  const d = await db();
  return new Promise((ok, fehler) => {
    const t = d.transaction(STORE, modus), r = f(t.objectStore(STORE));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error);
  });
}
export const videoLaden = (id) => tx('readonly', (s) => s.get(id));
export const videoAblegen = (rec) => tx('readwrite', (s) => s.put(rec));
export const videoLoeschen = (id) => tx('readwrite', (s) => s.delete(id));
export const alleVideosLoeschen = () => tx('readwrite', (s) => s.clear());
/** Alle Videos ohne Datei (für Listen und Statistik). */
export async function alleVideoMeta() {
  const alle = await tx('readonly', (s) => s.getAll());
  return alle.map(({ blob, ...rest }) => ({ ...rest, bytes: blob?.size ?? 0 }));
}
export async function videoUebersicht() {
  const alle = await alleVideoMeta();
  return { anzahl: alle.length, bytes: alle.reduce((a, v) => a + v.bytes, 0) };
}
export const mb = (bytes) => `${fmt(bytes / 1048576, bytes < 10485760 ? 1 : 0)} MB`;
const neueId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const zeitText = (s) => { if (s == null || !Number.isFinite(s)) return '–'; const m = Math.floor(s / 60), r = Math.floor((s - m * 60) * 10) / 10; return `${m}:${r < 10 ? '0' : ''}${fmt(r, 1)}`; };

// #################################################################
// Video-Hilfen: Dauer (auch WebM ohne Dauer), Springen, Neu kodieren (Kürzen + Komprimieren)
// #################################################################
function dauerErmitteln(v, fertig) {
  if (Number.isFinite(v.duration)) { fertig(v.duration); return; }
  const f = () => { if (!Number.isFinite(v.duration)) return; v.removeEventListener('durationchange', f); v.currentTime = 0; fertig(v.duration); };
  v.addEventListener('durationchange', f);
  v.currentTime = 1e101;
}
function springe(v, t) {
  return new Promise((ok) => {
    const fertig = () => { v.removeEventListener('seeked', fertig); clearTimeout(z); ok(); };
    const z = setTimeout(fertig, 1500);                    // manche Geräte melden „seeked“ nicht → nach 1,5 s weiter
    v.addEventListener('seeked', fertig);
    v.currentTime = t;
  });
}
export const GROESSEN = [['original', 'Original', null, 8e6], ['1080', '1080p', 1080, 5e6], ['720', '720p', 720, 2.5e6], ['480', '480p', 480, 1.2e6]];
/** Spielt den Ausschnitt einmal ab und nimmt ihn verkleinert neu auf (MediaRecorder). Ton entfällt. */
async function neuKodieren(blob, { von, bis, kante, bitrate, fortschritt, abbruch, ausschnitt = null }) {
  const typ = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((t) => globalThis.MediaRecorder?.isTypeSupported?.(t));
  if (!typ || !HTMLCanvasElement.prototype.captureStream) throw new Error(deEn('Dieses Gerät kann Videos nicht neu speichern.', 'This device cannot re-encode videos.'));
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((ok, f) => { v.onloadedmetadata = ok; v.onerror = () => f(new Error(deEn('Video lässt sich nicht lesen.', 'Cannot read the video.'))); });
    const dauer = await new Promise((ok) => dauerErmitteln(v, ok));
    const ende = Math.min(bis ?? dauer, dauer), start = Math.max(0, von ?? 0);
    // 301: Ausschnitt (gezoomte Ansicht) in Video-Pixeln; ohne Ausschnitt das ganze Bild
    const q = ausschnitt ?? { sx: 0, sy: 0, sw: v.videoWidth, sh: v.videoHeight };
    const s = kante ? Math.min(1, kante / Math.min(q.sw, q.sh)) : 1;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round((q.sw * s) / 2) * 2); c.height = Math.max(2, Math.round((q.sh * s) / 2) * 2);
    const ctx0 = c.getContext('2d');
    const ctx = { drawImage: (quelle) => ctx0.drawImage(quelle, q.sx, q.sy, q.sw, q.sh, 0, 0, c.width, c.height) };
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: typ, videoBitsPerSecond: bitrate });
    const teile = [];
    rec.ondataavailable = (e) => e.data.size && teile.push(e.data);
    const gestoppt = new Promise((ok) => { rec.onstop = ok; });
    await springe(v, start);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    rec.start(250);
    await v.play();
    await new Promise((ok) => {
      // Ende über drei Wege: Bild-Rückruf, „ended“ (kommt kein Bild mehr, ruft rVFC nie wieder) und Zeitgrenze
      let fertig = false;
      const schluss = () => { if (fertig) return; fertig = true; v.pause(); clearTimeout(grenze); ok(); };
      const grenze = setTimeout(schluss, ((ende - start) / Math.max(0.1, v.playbackRate || 1)) * 1500 + 4000);
      v.addEventListener('ended', schluss, { once: true });
      const bild = () => {
        if (fertig) return;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        fortschritt?.(Math.min(1, (v.currentTime - start) / Math.max(0.1, ende - start)));
        if (abbruch?.current || v.ended || v.currentTime >= ende) { schluss(); return; }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(bild); else requestAnimationFrame(bild);
      };
      bild();
    });
    rec.stop(); await gestoppt;
    if (abbruch?.current) return null;
    return { blob: new Blob(teile, { type: typ.split(';')[0] }), versatz: start };
  } finally { URL.revokeObjectURL(url); }
}
// #################################################################
// 300: fester Ablageort für gespeicherte Videos – je Gerät (localStorage), beim ersten Speichern gefragt.
// Eine Web-App kann nicht direkt in die Galerie schreiben: Downloads (Android-Galerie: Album „Download“),
// eigener Ordner (nur wo der Browser Ordner freigibt) oder Teilen-Dialog (iPhone: „Video sichern“ → Fotos).
// #################################################################
const ABLAGE = 'prh-video-ablage', ORDNER_NAME = 'prh-video-ordner';
const lokal = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privat */ } return null; };
export const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const kannOrdner = () => typeof globalThis.showDirectoryPicker === 'function';
const ablageDb = () => new Promise((ok, f) => { const r = indexedDB.open('prh-ablage', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = () => f(r.error); });
async function ordnerHandle(neu) {
  const d = await ablageDb();
  return new Promise((ok, f) => {
    const t = d.transaction('h', neu === undefined ? 'readonly' : 'readwrite'), s = t.objectStore('h');
    const r = neu === undefined ? s.get('ordner') : neu ? s.put(neu, 'ordner') : s.delete('ordner');
    t.oncomplete = () => ok(neu === undefined ? r.result : null); t.onerror = () => f(t.error);
  });
}
/** Gewählter Ablageort: 'download' | 'ordner' | 'teilen' | null (noch nie gefragt). */
export const ablageModus = () => lokal(ABLAGE);
function ablageText(m) {
  if (m === 'ordner') return deEn(`Ordner „${lokal(ORDNER_NAME) ?? '…'}“`, `Folder “${lokal(ORDNER_NAME) ?? '…'}”`);
  if (m === 'download') return IOS ? deEn('Dateien-App · Downloads', 'Files app · Downloads') : deEn('Downloads · Galerie-Album „Download“', 'Downloads · gallery album “Download”');
  if (m === 'teilen') return IOS ? deEn('Fotos (über Teilen)', 'Photos (via Share)') : deEn('Jedes Mal wählen', 'Choose each time');
  return deEn('Noch nicht gewählt', 'Not chosen yet');
}
/** Auswahl des Ablageorts (erstes Speichern und Einstellungen). gewaehlt(modus) nach erfolgreicher Wahl. */
export function AblageWahl({ gewaehlt, abbrechen = null }) {
  const [fehler, setFehler] = useState(null);
  const jetzt = ablageModus();
  const waehle = async (m) => {
    setFehler(null);
    if (m === 'ordner') {
      try {
        const h = await globalThis.showDirectoryPicker({ id: 'prh-videos', mode: 'readwrite', startIn: 'videos' });
        await ordnerHandle(h); lokal(ORDNER_NAME, h.name);
      } catch (e) { if (e?.name !== 'AbortError') setFehler(e.message ?? String(e)); return; }
    }
    lokal(ABLAGE, m); gewaehlt(m);
  };
  const wahl = [
    ['download', IOS ? deEn('Dateien-App', 'Files app') : deEn('Downloads → Galerie', 'Downloads → gallery'),
      IOS ? deEn('Ohne Rückfrage in „Downloads“ der Dateien-App.', 'Straight into “Downloads” in the Files app.') : deEn('Ohne Rückfrage. In der Galerie im Album „Download“.', 'No questions asked. In your gallery under the “Download” album.')],
    kannOrdner() && ['ordner', deEn('Eigener Ordner', 'Own folder'), deEn('Einmal wählen, z. B. „Lifting“ – alle Videos landen dort.', 'Pick once, e.g. “Lifting” – every video goes there.')],
    navigator.share && ['teilen', IOS ? deEn('Fotos-App', 'Photos app') : deEn('Jedes Mal wählen', 'Choose each time'),
      IOS ? deEn('Im Teilen-Dialog „Video sichern“ tippen.', 'Tap “Save video” in the share dialog.') : deEn('Teilen-Dialog, z. B. Google Fotos oder Dateien.', 'Share dialog, e.g. Google Photos or Files.')],
  ].filter(Boolean);
  return html`<div class="sv-ablage" role="group" aria-label=${deEn('Videos speichern in', 'Save videos to')}>
    ${wahl.map(([k, t, u]) => html`<button key=${k} class=${`sv-ablage-o ${jetzt === k ? 'an' : ''}`} aria-pressed=${String(jetzt === k)} onClick=${(e) => { e.preventDefault(); waehle(k); }}>
      <b>${t}${k === 'ordner' && jetzt === 'ordner' ? html` · ${lokal(ORDNER_NAME)}` : ''}</b><span>${u}</span></button>`)}
    ${fehler ? html`<span class="muted sv-fuss">${fehler}</span>` : null}
    ${abbrechen ? html`<button class="link-knopf" style="align-self:flex-start" onClick=${abbrechen}>${deEn('Abbrechen', 'Cancel')}</button>` : null}
  </div>`;
}
/** 281/300: Datei am gewählten Ort ablegen. Rückgabe { art: 'ordner'|'geteilt'|'geladen'|'abbruch', ort }. */
async function alsDateiSpeichern(rec, name, modus = ablageModus()) {
  const endung = (rec.blob.type || '').includes('mp4') ? 'mp4' : (rec.blob.type || '').includes('quicktime') ? 'mov' : 'webm';
  const datei = new File([rec.blob], `${name}.${endung}`, { type: rec.blob.type || 'video/mp4' });
  if (modus === 'ordner') {
    const h = await ordnerHandle().catch(() => null);
    if (h) {
      const recht = (await h.queryPermission?.({ mode: 'readwrite' })) === 'granted' || (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted';
      if (!recht) throw new Error(deEn('Kein Zugriff auf den Ordner – in den Einstellungen neu wählen.', 'No access to the folder – choose it again in the settings.'));
      const w = await (await h.getFileHandle(datei.name, { create: true })).createWritable();
      await w.write(datei); await w.close();
      return { art: 'ordner', ort: h.name };
    }
  }
  if (modus === 'teilen' && navigator.canShare?.({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: name }); return { art: 'geteilt' }; } catch (e) { if (e?.name === 'AbortError') return { art: 'abbruch' }; }
  }
  const a = document.createElement('a'), u = URL.createObjectURL(datei);
  a.href = u; a.download = datei.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  return { art: 'geladen', webm: endung === 'webm' };
}

// #################################################################
// Bahn aus dem Video: Bild für Bild springen (seeked), verkleinert zeichnen, Scheibe verfolgen
// #################################################################
const ANALYSE_BREITE = 320, FPS = 20;
async function bahnAusVideo(v, { start, ende, mitte, rand, durchmesserM, fortschritt, beiPunkt, abbruch }) {
  const b = ANALYSE_BREITE, h = Math.round((b * v.videoHeight) / v.videoWidth), k = b / v.videoWidth;
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const bild = () => { ctx.drawImage(v, 0, 0, b, h); return grau(ctx.getImageData(0, 0, b, h).data, b, h); };
  await springe(v, start);
  const radius = Math.hypot(rand.x - mitte.x, rand.y - mitte.y) * k;
  if (radius < 6) throw new Error(deEn('Die Scheibe ist im Bild zu klein – näher ran filmen oder den Rand neu setzen.', 'The plate is too small in the frame – film closer or set the edge again.'));
  const verf = verfolger();
  if (!verf.start(bild(), b, h, mitte.x * k, mitte.y * k, radius)) throw new Error(deEn('Die Scheibe liegt zu nah am Bildrand.', 'The plate is too close to the edge of the frame.'));
  const punkte = [{ t: start, x: mitte.x * k, y: mitte.y * k, guete: 1 }];
  let verloren = 0;
  const bis = Math.min(ende ?? v.duration, v.duration) - 0.02;
  for (let t = start + 1 / FPS; t <= bis && !abbruch.current; t += 1 / FPS) {
    await springe(v, t);
    const p = verf.schritt(bild());
    if (p) { punkte.push({ t, x: p.x, y: p.y, guete: p.guete }); verloren = 0; beiPunkt?.(punkte); } else if (++verloren > 8) break;
    fortschritt(Math.min(1, (t - start) / Math.max(0.1, bis - start)));
  }
  return { punkte, breite: b, hoehe: h, mProPx: durchmesserM / (2 * radius) };
}

// #################################################################
// Tempo-Profil: eigene Sätze mit Tempo und RPE derselben Lift-Familie (Zubehör: derselben Übung)
// #################################################################
function tempoPaare(key, lift) {
  const paare = [], k = kanon(key);
  for (const d of Object.keys(trainingsTage)) {
    const t = trainingAm(d);
    for (const u of t?.uebungen ?? []) {
      if (lift !== 'andere' ? u.lift !== lift : kanon(u.key) !== k) continue;
      for (const s of u.saetze ?? []) {
        const v = s.extra?.tempo?.v?.at(-1) ?? (s.wdh === 1 ? s.extra?.ms : null);
        if (v > 0 && s.rpe != null) paare.push({ v, rpe: s.rpe });
      }
    }
  }
  return paare;
}

// #################################################################
// Zeichnen (Inhaltsebene, wird mitgezoomt): Bahn mit Glühen, konzentrisch grün obenauf; Markierungen beim Setzen
// #################################################################
const farbe = (name, ersatz) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz; } catch { return ersatz; } };
function zeichne(canvas, { analyse = null, scan = null, bis = Infinity, mitte = null, rand = null, vorschauRand = null, vb = 1, z = 1, b, h }) {
  if (!canvas || !b) return;
  const dpr = Math.min(2, devicePixelRatio || 1), k = Math.min(3, z), W = Math.round(b * dpr * k), H = Math.round(h * dpr * k);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d'), lw = (dpr * k) / z;          // 1 Bildschirm-Pixel in Leinwand-Pixeln
  ctx.clearRect(0, 0, W, H);
  const gruen = farbe('--ok', '#3ddc84'), akzent = farbe('--acc-hi', '#ff4d6d');
  const bahn = analyse ?? scan;
  if (bahn?.punkte?.length > 1) {
    const s = W / bahn.breite, p = bahn.punkte, wdh = analyse?.wdh ?? [];
    const konz = (t) => wdh.some((w) => t >= w.von && t <= w.bis);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.3; ctx.lineWidth = 2.5 * lw; ctx.strokeStyle = '#fff';
    ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x * s, q.y * s) : ctx.moveTo(q.x * s, q.y * s))); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 16 * lw;
    for (const hoch of [false, true]) {
      const c = hoch ? gruen : akzent;
      ctx.strokeStyle = c; ctx.shadowColor = c; ctx.lineWidth = (hoch ? 5 : 3.6) * lw;
      for (let i = 1; i < p.length && p[i].t <= bis; i++) {
        if (konz(p[i].t) !== hoch) continue;
        ctx.beginPath(); ctx.moveTo(p[i - 1].x * s, p[i - 1].y * s); ctx.lineTo(p[i].x * s, p[i].y * s); ctx.stroke();
      }
    }
    const jetzt = [...p].reverse().find((q) => q.t <= bis) ?? p[0];
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 20 * lw; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(jetzt.x * s, jetzt.y * s, 7 * lw, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (mitte) {
    const s = W / vb, x = mitte.x * s, y = mitte.y * s;
    ctx.strokeStyle = akzent; ctx.fillStyle = akzent; ctx.lineWidth = 2.5 * lw; ctx.shadowColor = akzent; ctx.shadowBlur = 10 * lw;
    ctx.beginPath(); ctx.moveTo(x - 16 * lw, y); ctx.lineTo(x - 5 * lw, y); ctx.moveTo(x + 5 * lw, y); ctx.lineTo(x + 16 * lw, y);
    ctx.moveTo(x, y - 16 * lw); ctx.lineTo(x, y - 5 * lw); ctx.moveTo(x, y + 5 * lw); ctx.lineTo(x, y + 16 * lw); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5 * lw, 0, Math.PI * 2); ctx.fill();
    const r = rand ?? vorschauRand;
    if (r) {
      const rad = Math.hypot(r.x - mitte.x, r.y - mitte.y) * s;
      ctx.setLineDash([7 * lw, 6 * lw]);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(r.x * s, r.y * s, 5 * lw, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

export const KAMERA = html`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l6-3v9l-6-3z"/></svg>`;
const SCHLOSS = (zu) => html`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <rect x="5" y="11" width="14" height="9.5" rx="2"/><path d=${zu ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'}/></svg>`;
const SCHERE = html`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.2 8.4L20 17M8.2 15.6L20 7"/></svg>`;
const ms = (v) => fmt2(v);

/** Einstellungen → Training: Schalter, belegter Speicher, alle Videos löschen. */
export function VideoEinstellung({ einst, setEinst }) {
  const [stand, setStand] = useState(null);
  const [frage, setFrage] = useState(false);
  const [ort, setOrt] = useState(false);
  const lade =() => videoUebersicht().then(setStand).catch(() => setStand(null));
  useEffect(() => { lade(); }, []);
  return html`<label class="schalter" for="e-video"><span><b>${deEn('Satz-Video mit Hantelweg', 'Set video with bar path')}</b><br/>
      <span class="muted" style="font-size:12.5px">${deEn('Unter jedem abgehakten Satz eine Kamera: filmen, Hantelweg und Tempo je Wdh sehen, RPE mit dem Tempo abgleichen. Videos bleiben auf diesem Gerät.',
        'A camera under every completed set: film it, see the bar path and velocity per rep, check your RPE against the velocity. Videos stay on this device.')}</span>
      ${stand?.anzahl ? html`<span class="muted sv-speicher">${deEn(`${stand.anzahl} ${stand.anzahl === 1 ? 'Video' : 'Videos'} · ${mb(stand.bytes)} auf diesem Gerät`, `${stand.anzahl} ${stand.anzahl === 1 ? 'video' : 'videos'} · ${mb(stand.bytes)} on this device`)}
        ${frage ? html` · <button class="link-knopf gefahr" onClick=${(e) => { e.preventDefault(); alleVideosLoeschen().then(() => { setFrage(false); lade(); }); }}>${deEn('Wirklich alle löschen', 'Really delete all')}</button>`
          : html` · <button class="link-knopf" onClick=${(e) => { e.preventDefault(); setFrage(true); }}>${deEn('Alle löschen', 'Delete all')}</button>`}</span>` : null}</span>
    <input type="checkbox" id="e-video" checked=${einst.satzVideo !== false} onChange=${(e) => setEinst({ ...einst, satzVideo: e.currentTarget.checked })}/></label>
    ${einst.satzVideo !== false ? html`<div class="sv-ablage-einst">
      <div class="row between" style="align-items:center;gap:10px"><span><b>${deEn('Videos speichern in', 'Save videos to')}</b><br/><span class="muted" style="font-size:12.5px">${ablageText(ablageModus())}</span></span>
        <button class="chip" onClick=${() => setOrt(!ort)} aria-expanded=${String(ort)}>${ort ? deEn('Fertig', 'Done') : deEn('Ändern', 'Change')}</button></div>
      ${ort ? html`<${AblageWahl} gewaehlt=${() => setOrt(false)}/>` : null}</div>` : null}`;
}

/** Knopf unter einem abgehakten Satz: Kamera (grün, wenn es Video oder Tempo gibt). */
export function SatzVideoKnopf({ satz, oeffnen }) {
  const da = !!satz.extra?.video || !!satz.extra?.tempo;
  return html`<button class=${`sv-knopf ${da ? 'da' : ''}`} onClick=${oeffnen} aria-label=${deEn('Satz-Video', 'Set video')}>${KAMERA}
    ${da && satz.extra?.ms == null ? html`<span>${deEn('Video', 'Video')}</span>` : null}</button>`;   /* m/s steht schon in den Satzdetails */
}

/** Fenster für einen Satz (Training). speichern(patch) setzt Felder in satz.extra (null entfernt sie); ohne speichern nur ansehen (Verlauf). */
export function SatzVideo({ zu, ...rest }) {
  // Portal: im Verlauf liegt das Fenster sonst im Tages-Fenster (transform) und öffnet nur halb
  return html`<${Portal}><${Sheet} zu=${zu} label=${deEn('Satz-Video', 'Set video')} voll=${true}><${VideoKern} zu=${zu} ...${rest}/></${Sheet}><//>`;
}

const DATEI_NAME = (titel) => `PRHunter_${new Date().toISOString().slice(0, 10)}_${titel.replace(/[^\p{L}\p{N}.,×x@ -]/gu, '').replace(/\s+/g, '_')}`;

/**
 * Kern: Aufnahme, Markieren (Lupe), Analyse, Ergebnis, Bearbeiten (Kürzen, Komprimieren, Speichern), Löschen.
 * satz { kg, wdh, rpe, extra }; meta: zusätzliche Felder fürs Video (Werkzeug: Übung/Gewicht ohne Training).
 */
export function VideoKern({ satz, uebungKey, uebungName, lift, zu = null, speichern = null, meta = null, eingebettet = false, beiNeu = null, geschwister = null, datum = HEUTE }) {
  const [phase, setPhase] = useState('laden');            // laden | waehlen | markieren | analyse | ergebnis | fremd | arbeit
  const [rec, setRec] = useState(null);
  const [url, setUrl] = useState(null);
  const [mass, setMass] = useState(null);                 // { w, h } des Videos
  const [platz, setPlatz] = useState(340);                // verfügbare Breite
  const [ansicht, setAnsicht] = useState({ z: 1, tx: 0, ty: 0 });
  const [fest, setFest] = useState(false);
  const [schritt, setSchritt] = useState('mitte');        // mitte | rand | fertig
  const [mitte, setMitte] = useState(null);
  const [rand, setRand] = useState(null);
  const [lupe, setLupe] = useState(null);                 // { x, y } in Bühnen-Pixeln, solange gedrückt
  const [durchmesser, setDurchmesser] = useState(45);
  const [fortschritt, setFortschritt] = useState(0);
  const [fehler, setFehler] = useState(null);
  const [info, setInfo] = useState(null);
  const [zeit, setZeit] = useState(0);
  const [dauer, setDauer] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const [langsam, setLangsam] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [bearb, setBearb] = useState(false);
  const [groesse, setGroesse] = useState('720');
  const [unplausibel, setUnplausibel] = useState(null);   // Gründe, wenn die Analyse nicht nach Hantel aussieht
  const [nurAusschnitt, setNurAusschnitt] = useState(true); // 301: beim Übernehmen den gezoomten Ausschnitt speichern
  const [ablageFrage, setAblageFrage] = useState(false);  // 300: erstes Speichern → Ort wählen
  const videoRef = useRef(null), canvasRef = useRef(null), lupeRef = useRef(null), buehneRef = useRef(null), rahmenRef = useRef(null);
  const abbruch = useRef(false), scan = useRef(null), zeiger = useRef(new Map()), geste = useRef(null);
  const dateiKamera = useRef(null), dateiGalerie = useRef(null);
  const kannSpeichern = !!speichern || !!meta;

  useEffect(() => {
    let weg = false;
    (async () => {
      const id = satz.extra?.video;
      const r = id ? await videoLaden(id).catch(() => null) : null;
      if (weg) return;
      if (r?.blob) { setRec(r); setPhase(r.analyse ? 'ergebnis' : 'markieren'); }
      else if (r) { setRec(r); setPhase('fremd'); }                   // Werkzeug-Eintrag ohne Datei: nur die Zahlen
      else setPhase(satz.extra?.tempo ? 'fremd' : 'waehlen');
    })();
    return () => { weg = true; abbruch.current = true; };
  }, []);
  useEffect(() => { if (!rec?.blob) return undefined; const u = URL.createObjectURL(rec.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [rec?.blob]);
  // verfügbare Breite messen (Bühne hat genau das Seitenverhältnis des Videos → kein Rand, kein Versatz; 270)
  useEffect(() => {
    const el = rahmenRef.current;
    if (!el) return undefined;
    const miss = () => setPlatz(Math.max(200, el.clientWidth));
    miss();
    const ro = globalThis.ResizeObserver ? new ResizeObserver(miss) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [url]);
  // Handy quer gehalten: Video fast über die ganze Höhe; Querformat-Video nutzt die volle Breite (sv-rahmen.quer)
  const quer = !!mass && mass.w > mass.h * 1.05, hoehe = globalThis.innerHeight || 700, liegend = (globalThis.innerWidth || 0) > hoehe;
  const { b, h } = buehnenGroesse(mass?.w, mass?.h, platz, Math.round(hoehe * (liegend ? 0.86 : 0.6)));
  const schnitt = rec?.schnitt ?? null;
  const bereich = () => [schnitt?.von ?? 0, Math.min(schnitt?.bis ?? dauer, dauer || Infinity)];
  const lupenPunkt = lupe && mass ? inVideo(lupe.x, lupe.y, ansicht, b, h, mass.w, mass.h) : null;
  const randZieht = !!lupe && geste.current?.art === 'rand';

  // Überlagerung neu zeichnen (Video läuft, Analyse, Zoom, Markieren)
  useEffect(() => {
    let id = 0;
    const male = () => {
      const v = videoRef.current;
      zeichne(canvasRef.current, { analyse: phase === 'ergebnis' ? rec?.analyse : null, scan: phase === 'analyse' ? scan.current : null,
        bis: phase === 'ergebnis' ? v?.currentTime ?? Infinity : Infinity, mitte: phase === 'markieren' ? mitte : null,
        rand: phase === 'markieren' && !randZieht ? rand : null, vorschauRand: phase === 'markieren' && (schritt === 'rand' || randZieht) ? lupenPunkt : null, vb: mass?.w || 1, z: ansicht.z, b, h });
      if (spielt || phase === 'analyse') id = requestAnimationFrame(male);
    };
    male();
    return () => cancelAnimationFrame(id);
  }, [phase, spielt, mitte, rand, rec, zeit, ansicht, b, h, lupe, schritt]);
  // Lupe: dreifach vergrößerter Ausschnitt um den Finger, mit Fadenkreuz (272)
  useEffect(() => {
    const c = lupeRef.current, v = videoRef.current;
    if (!c || !v || !lupenPunkt || !mass) return;
    const dpr = Math.min(2, devicePixelRatio || 1), G = 132 * dpr;
    if (c.width !== G) { c.width = G; c.height = G; }
    const ctx = c.getContext('2d'), quelle = 132 / (3 * ((b * ansicht.z) / mass.w));
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G, G);
    try { ctx.drawImage(v, lupenPunkt.x - quelle / 2, lupenPunkt.y - quelle / 2, quelle, quelle, 0, 0, G, G); } catch { /* Bild noch nicht bereit */ }
    const akzent = farbe('--acc-hi', '#ff4d6d'), m = G / 2;
    ctx.strokeStyle = akzent; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(m - 22 * dpr, m); ctx.lineTo(m - 6 * dpr, m); ctx.moveTo(m + 6 * dpr, m); ctx.lineTo(m + 22 * dpr, m);
    ctx.moveTo(m, m - 22 * dpr); ctx.lineTo(m, m - 6 * dpr); ctx.moveTo(m, m + 6 * dpr); ctx.lineTo(m, m + 22 * dpr); ctx.stroke();
    if ((schritt === 'rand' || geste.current?.art === 'rand') && mitte) {
      const k = G / quelle, cx = m + (mitte.x - lupenPunkt.x) * k, cy = m + (mitte.y - lupenPunkt.y) * k;
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath(); ctx.arc(cx, cy, Math.hypot(mitte.x - lupenPunkt.x, mitte.y - lupenPunkt.y) * k, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [lupe, ansicht, schritt, mitte]);

  const meldeNeu = (r) => { beiNeu?.(r); };
  const datei = async (f) => {
    if (!f) return;
    setFehler(null); setInfo(null); setUnplausibel(null);
    const id = neueId();
    const r = { id, blob: f, typ: f.type, erstellt: new Date().toISOString(), key: uebungKey, lift, kg: satz.kg, wdh: satz.wdh, rpe: satz.rpe ?? null, ...(meta ?? {}) };
    try { await videoAblegen(r); navigator.storage?.persist?.().catch(() => {}); } catch {
      setFehler(deEn('Kein Platz für das Video auf diesem Gerät.', 'No space for the video on this device.')); return;
    }
    if (rec?.id) videoLoeschen(rec.id).catch(() => {});
    setRec(r); setMass(null); setAnsicht({ z: 1, tx: 0, ty: 0 }); setMitte(null); setRand(null); setSchritt('mitte'); setPhase('markieren');
    speichern?.({ video: id });
    meldeNeu(r);
  };
  const markiere = (p) => {
    if (!mass) return;
    const vp = inVideo(p.x, p.y, ansicht, b, h, mass.w, mass.h);
    if (schritt === 'rand' && mitte) { setRand(vp); setSchritt('fertig'); } else { setMitte(vp); setRand(null); setSchritt('rand'); }
  };
  const abspielen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused && !v.ended) { v.pause(); return; }
    const [a, e] = bereich();
    if (v.ended || v.currentTime >= e - 0.05 || v.currentTime < a - 0.01) v.currentTime = a;     // 280: am Ende wieder von vorn
    v.playbackRate = langsam ? 0.5 : 1;
    v.play()?.catch?.(() => setFehler(deEn('Das Video lässt sich gerade nicht abspielen – einmal neu öffnen.', 'The video cannot be played right now – open it again.')));
  };
  // Gesten auf der Bühne: zwei Finger zoomen/verschieben; ein Finger markiert (Lupe) bzw. verschiebt, Tippen = Play/Pause
  // 285: über das Verhältnis zur gemessenen Bühne rechnen – mit Textgröße (html { zoom }) liegen Finger und Rechteck in einem
  // anderen Maßstab als das Layout (b × h), die Markierung saß sonst versetzt
  const lage = (e) => { const r = buehneRef.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / (r.width || 1)) * b, y: ((e.clientY - r.top) / (r.height || 1)) * h }; };
  const runter = (e) => {
    if (phase === 'analyse' || phase === 'arbeit') return;
    try { buehneRef.current?.setPointerCapture?.(e.pointerId); } catch { /* Zeiger schon weg */ }
    zeiger.current.set(e.pointerId, lage(e));
    if (zeiger.current.size === 2) {
      setLupe(null);
      const [p1, p2] = [...zeiger.current.values()];
      geste.current = { art: 'zwei', p1, p2, a: ansicht };
    } else if (zeiger.current.size === 1) {
      const p = lage(e);
      if (phase === 'markieren' && schritt === 'fertig' && mitte && rand && mass) {
        // 286: Kreis anpassen statt neu anfangen – innen ziehen verschiebt den Kreis, am Rand ziehen ändert die Größe
        const vp = inVideo(p.x, p.y, ansicht, b, h, mass.w, mass.h), r = Math.hypot(rand.x - mitte.x, rand.y - mitte.y), d = Math.hypot(vp.x - mitte.x, vp.y - mitte.y);
        if (d < r * 0.6) { geste.current = { art: 'kreis', start: vp, m0: mitte, r0: rand }; setLupe(p); return; }
        if (Math.abs(d - r) < Math.max(r * 0.45, 12)) { geste.current = { art: 'rand' }; setLupe(p); return; }
        geste.current = { art: 'ziehen', start: p, a: ansicht, bewegt: false };
        return;
      }
      geste.current = phase === 'markieren' ? { art: 'mark' } : { art: 'ziehen', start: p, a: ansicht, bewegt: false };
      if (phase === 'markieren') setLupe(p);
    }
  };
  const bewegen = (e) => {
    if (!zeiger.current.has(e.pointerId)) return;
    zeiger.current.set(e.pointerId, lage(e));
    const g = geste.current;
    if (!g) return;
    if (g.art === 'zwei' && zeiger.current.size === 2) {
      if (fest) return;
      const [q1, q2] = [...zeiger.current.values()];
      const d0 = Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y) || 1, d1 = Math.hypot(q2.x - q1.x, q2.y - q1.y);
      const m0 = { x: (g.p1.x + g.p2.x) / 2, y: (g.p1.y + g.p2.y) / 2 }, m1 = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };
      const a = zoomeUm(g.a, d1 / d0, m0.x, m0.y, b, h);
      setAnsicht(begrenze({ ...a, tx: a.tx + m1.x - m0.x, ty: a.ty + m1.y - m0.y }, b, h));
    } else if (g.art === 'mark' || g.art === 'rand') setLupe(lage(e));
    else if (g.art === 'kreis' && mass) {
      const p = lage(e), vp = inVideo(p.x, p.y, ansicht, b, h, mass.w, mass.h), dx = vp.x - g.start.x, dy = vp.y - g.start.y;
      setMitte({ x: g.m0.x + dx, y: g.m0.y + dy }); setRand({ x: g.r0.x + dx, y: g.r0.y + dy }); setLupe(p);
    }
    else if (g.art === 'ziehen') {
      const p = lage(e), dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) > 6) g.bewegt = true;
      if (!fest && g.a.z > 1) setAnsicht(begrenze({ ...g.a, tx: g.a.tx + dx, ty: g.a.ty + dy }, b, h));
    }
  };
  const hoch = (e) => {
    const g = geste.current;
    const p = zeiger.current.get(e.pointerId) ?? lage(e);
    zeiger.current.delete(e.pointerId);
    if (g?.art === 'mark' && zeiger.current.size === 0) { markiere(p); setLupe(null); }
    if (g?.art === 'rand' && zeiger.current.size === 0 && mass) { setRand(inVideo(p.x, p.y, ansicht, b, h, mass.w, mass.h)); setLupe(null); }
    if (g?.art === 'kreis') setLupe(null);
    if (g?.art === 'ziehen' && !g.bewegt && e.type === 'pointerup') abspielen();
    if (zeiger.current.size === 0) geste.current = null; else if (g?.art === 'zwei') geste.current = { art: 'nichts' };
  };
  const rad = (e) => { if (fest) return; e.preventDefault(); const p = lage(e); setAnsicht(zoomeUm(ansicht, e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y, b, h)); };

  const zahlenWeg = () => speichern?.({ tempo: null, ms: satz.extra?.tempo ? null : satz.extra?.ms ?? null });
  const ergebnisSpeichern = async (analyse) => {
    if (!analyse.wdh.length) { zahlenWeg(); return; }
    const v1 = analyse.wdh.map((w) => w.mcv);
    speichern?.({ tempo: { v: v1, vl: analyse.verlust }, ms: Math.max(...v1) });
  };
  const analysieren = async () => {
    const v = videoRef.current;
    if (!v || !mitte || !rand) return;
    setFehler(null); setInfo(null); setUnplausibel(null); setPhase('analyse'); setFortschritt(0); abbruch.current = false; scan.current = null;
    try {
      v.pause();
      const [, ende] = bereich();
      const erg = await bahnAusVideo(v, { start: Math.max(v.currentTime, schnitt?.von ?? 0), ende, mitte, rand, durchmesserM: durchmesser / 100, fortschritt: setFortschritt, abbruch,
        beiPunkt: (punkte) => { scan.current = { punkte, breite: ANALYSE_BREITE }; } });
      if (abbruch.current) return;
      const auswertung = wiederholungen(erg.punkte, erg.mProPx);
      const analyse = { ...erg, ...auswertung, durchmesser };
      const gruende = plausibel(analyse);
      const neu = { ...rec, analyse, ungeprueft: gruende.length ? gruende : undefined };
      await videoAblegen(neu).catch(() => {});
      setRec(neu); setPhase('ergebnis'); meldeNeu(neu);
      await springe(v, erg.punkte[0]?.t ?? 0); setZeit(v.currentTime);
      if (gruende.length) { setUnplausibel(gruende); zahlenWeg(); } else ergebnisSpeichern(analyse);
    } catch (e) { setFehler(e.message ?? String(e)); setPhase('markieren'); }
  };
  const trotzdem = () => { setUnplausibel(null); const neu = { ...rec, ungeprueft: undefined }; videoAblegen(neu).catch(() => {}); setRec(neu); ergebnisSpeichern(rec.analyse); };
  const weg = async (mitZahlen) => {
    // Werkzeug (meta): die Zahlen hängen am Video-Eintrag – „nur Video“ behält ihn ohne Datei, „mit Zahlen“ löscht ihn ganz
    const ohneDatei = meta && !mitZahlen && rec ? { ...rec, blob: null } : null;
    if (rec?.id) await (ohneDatei ? videoAblegen(ohneDatei) : videoLoeschen(rec.id)).catch(() => {});
    speichern?.({ video: null, ...(mitZahlen ? { tempo: null, ms: satz.extra?.tempo ? null : satz.extra?.ms ?? null } : {}) });
    setLoeschen(false); meldeNeu(ohneDatei);
    if (ohneDatei) { setRec(ohneDatei); setUrl(null); setBearb(false); setPhase('fremd'); return; }
    if (zu) zu(); else { setRec(null); setUrl(null); setPhase('waehlen'); }
  };
  const setzeSchnitt = (neu) => { const r = { ...rec, schnitt: neu }; setRec(r); videoAblegen(r).catch(() => {}); };
  const uebernehmen = async () => {
    const [von, bis] = bereich(), g = GROESSEN.find(([k]) => k === groesse);
    setFehler(null); setInfo(null); setPhase('arbeit'); setFortschritt(0); abbruch.current = false;
    const vorher = rec.blob.size;
    // 301: gezoomt → nur den sichtbaren Ausschnitt speichern (in Video-Pixeln)
    const z = ansicht.z, aus = zugeschnitten && mass ? { sx: (-ansicht.tx / z) * (mass.w / b), sy: (-ansicht.ty / z) * (mass.h / h), sw: mass.w / z, sh: mass.h / z } : null;
    try {
      const erg = await neuKodieren(rec.blob, { von, bis, kante: g[2], bitrate: g[3], fortschritt: setFortschritt, abbruch, ausschnitt: aus });
      if (!erg) { setPhase(rec.analyse ? 'ergebnis' : 'markieren'); return; }
      // Analyse an den Schnitt anpassen: Zeiten verschieben, Punkte außerhalb weg (Pixel sind auf 320 px normiert, Größe egal);
      // beim Ausschnitt die Punkte mitverschieben und vergrößern – Meter je Pixel werden entsprechend kleiner
      const a = rec.analyse, k = a && aus ? a.breite / mass.w : 0;
      const ort = (p) => (aus ? { x: (p.x - aus.sx * k) * z, y: (p.y - aus.sy * k) * z } : {});
      const analyse = a ? { ...a, ...(aus ? { mProPx: a.mProPx / z } : {}), punkte: a.punkte.filter((p) => p.t >= erg.versatz && p.t <= bis).map((p) => ({ ...p, ...ort(p), t: p.t - erg.versatz })),
        wdh: a.wdh.filter((w) => w.von >= erg.versatz && w.bis <= bis).map((w) => ({ ...w, von: w.von - erg.versatz, bis: w.bis - erg.versatz })) } : undefined;
      const neu = { ...rec, blob: erg.blob, typ: erg.blob.type, schnitt: undefined, analyse, bearbeitet: new Date().toISOString() };
      await videoAblegen(neu);
      setRec(neu); setMass(null); setAnsicht({ z: 1, tx: 0, ty: 0 }); setFest(false); setMitte(null); setRand(null); setSchritt('mitte');
      setBearb(false); setPhase(analyse ? 'ergebnis' : 'markieren'); meldeNeu(neu);
      setInfo(deEn(`Übernommen: ${mb(vorher)} → ${mb(erg.blob.size)}.`, `Applied: ${mb(vorher)} → ${mb(erg.blob.size)}.`));
    } catch (e) { setFehler(e.message ?? String(e)); setPhase(rec.analyse ? 'ergebnis' : 'markieren'); }
  };
  const ablegen = async (modus = ablageModus()) => {
    if (!modus) { setAblageFrage(true); return; }                        // 300: beim ersten Mal den Ort wählen
    setAblageFrage(false); setFehler(null); setInfo(null);
    let r;
    try { r = await alsDateiSpeichern(rec, DATEI_NAME(titel), modus); } catch (e) { setFehler(e.message ?? String(e)); return; }
    const webm = r.webm ? deEn(' WebM-Videos zeigt nicht jede Galerie an – dann über die Dateien-App öffnen.', ' Not every gallery shows WebM videos – open it via the Files app then.') : '';
    if (r.art === 'ordner') setInfo(deEn(`Gespeichert im Ordner „${r.ort}“.`, `Saved to the folder “${r.ort}”.`));
    if (r.art === 'geladen') setInfo((IOS ? deEn('Gespeichert in der Dateien-App unter „Downloads“.', 'Saved in the Files app under “Downloads”.')
      : deEn('Gespeichert in „Downloads“ – in der Galerie im Album „Download“.', 'Saved to “Downloads” – in your gallery under the “Download” album.')) + webm);
  };
  const zugeschnitten = nurAusschnitt && ansicht.z > 1.01;

  const a = rec?.analyse, wdh = a?.wdh ?? [];
  const tempo = phase === 'fremd' ? satz.extra?.tempo ?? (wdh.length && !rec?.ungeprueft ? { v: wdh.map((w) => w.mcv), vl: a.verlust } : null)
    : wdh.length && !unplausibel ? { v: wdh.map((w) => w.mcv), vl: a.verlust } : null;
  const beste = tempo?.v?.length ? Math.max(...tempo.v) : null;
  const schnittV = tempo?.v?.length ? tempo.v.reduce((x, y) => x + y, 0) / tempo.v.length : null;
  const spitze = wdh.length && !unplausibel ? Math.max(...wdh.map((w) => w.spitze)) : null;
  const profil = tempo?.v?.length ? rpeAusTempo(tempo.v.at(-1), tempoPaare(uebungKey, lift)) : null;
  const vergleich = rpeVergleich(satz.rpe ?? null, profil?.rpe ?? null);
  // 287/289/290: dieser Satz mit seinem (neuen) Tempo unter den Sätzen der Übung heute
  const heuteSaetze = (geschwister?.length ? geschwister : [satz]).map((s) => (s === satz && tempo?.v?.length ? { ...s, extra: { ...(s.extra ?? {}), tempo } } : s));
  const ueber = tempo?.v?.length && satz.kg > 0 ? tempoUebersicht(uebungKey, lift, heuteSaetze, datum) : null;
  const rekord = ueber && beste ? istTempoRekord(beste, satz.kg, ueber.alt) : null;
  const gruppe = ueber?.verluste.find((g) => Math.abs(g.kg - satz.kg) <= 1.25) ?? null;
  const titel = `${uebungName}${satz.kg != null ? ` · ${fmt(satz.kg)} × ${satz.wdh}` : ''}${satz.rpe != null ? ` @ ${fmt(satz.rpe)}` : ''}`;
  const [von, bis] = bereich();
  const mitVideo = url && ['markieren', 'analyse', 'ergebnis', 'arbeit'].includes(phase);
  const GRUND = { kurz: deEn('die Bahn ist zu kurz', 'the path is too short'), unsicher: deEn('die Scheibe war kaum zu erkennen', 'the plate was hard to recognise'),
    keineWdh: deEn('keine Wiederholung über 10 cm', 'no rep over 10 cm'), unrealistisch: deEn('die Werte sind für eine Hantel unrealistisch', 'the values are unrealistic for a barbell') };

  return html`<div class="sv">
    ${eingebettet ? null : html`<div class="row between" style="align-items:flex-start"><div><div class="eyebrow">${deEn('Satz-Video', 'Set video')}</div><h2 class="h2 sv-titel">${titel}</h2></div>
      ${zu ? html`<button class="iconbtn" onClick=${zu} aria-label=${deEn('Schließen', 'Close')}>${I.zu}</button>` : null}</div>`}
    <input ref=${dateiKamera} type="file" accept="video/*" capture="environment" hidden onChange=${(e) => { datei(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }}/>
    <input ref=${dateiGalerie} type="file" accept="video/*" hidden onChange=${(e) => { datei(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }}/>
    ${phase === 'laden' ? html`<div class="sv-leer"><span class="sv-lader"></span></div>` : null}
    ${phase === 'waehlen' || phase === 'fremd' ? html`<div class="sv-start">
      <div class="sv-start-bild" aria-hidden="true"><span class="sv-ring"></span><span class="sv-ring b"></span>${KAMERA}</div>
      ${phase === 'fremd' ? html`<p class="muted" style="margin:0;text-align:center">${rec && !rec.blob ? deEn('Video gelöscht – hier nur die Zahlen.', 'Video deleted – only the numbers here.') : deEn('Das Video ist nicht auf diesem Gerät – hier nur die Zahlen.', 'The video is not on this device – only the numbers here.')}</p>`
        : html`<p class="muted" style="margin:0;text-align:center">${deEn('Von der Seite filmen, die ganze Scheibe im Bild, Handy ruhig.', 'Film from the side, whole plate in frame, phone steady.')}</p>`}
      ${kannSpeichern ? html`<div class="sv-knoepfe"><button class="btn btn-chalk" onClick=${() => dateiKamera.current?.click()}>${KAMERA} ${deEn('Filmen', 'Record')}</button>
        <button class="btn btn-soft" onClick=${() => dateiGalerie.current?.click()}>${deEn('Aus der Galerie', 'From gallery')}</button></div>
      <span class="muted sv-privat">${I.check} ${deEn('Das Video bleibt auf diesem Handy und wird nie hochgeladen.', 'The video stays on this phone and is never uploaded.')}</span>` : null}
    </div>` : null}
    ${phase === 'markieren' ? html`<div class=${`sv-hilfe ${schritt}`}>
      <svg class="sv-hilfe-bild" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="p1"/><circle cx="32" cy="32" r="21" class="p2"/><circle cx="32" cy="32" r="5" class="p3"/>
        <circle class="ziel" cx=${schritt === 'rand' ? 59 : 32} cy="32" r="5"/><circle class="ziel puls" cx=${schritt === 'rand' ? 59 : 32} cy="32" r="5"/></svg>
      <div><b>${schritt === 'rand' ? deEn('2/2 · Äußerer Rand der Scheibe', '2/2 · Outer edge of the plate') : schritt === 'fertig' ? deEn('Markiert', 'Marked') : deEn('1/2 · Mitte der Scheibe', '1/2 · Centre of the plate')}</b>
        <span>${schritt === 'fertig' ? deEn('Kreis passt? Dann berechnen. Innen ziehen verschiebt ihn, am Rand ziehen ändert die Größe.', 'Circle fits? Then track. Drag inside to move it, drag the edge to resize it.')
          : deEn('Gedrückt halten, mit der Lupe zielen, loslassen. Zwei Finger zoomen. Vorher zum Satzbeginn spulen.', 'Press and hold, aim with the magnifier, release. Two fingers zoom. Scrub to the start of the set first.')}</span></div>
    </div>` : null}
    ${mitVideo ? html`<div class=${`sv-rahmen ${quer ? 'quer' : ''}`} ref=${rahmenRef}>
      <div class=${`sv-buehne ${fest ? 'fest' : ''} ${phase !== 'markieren' && (fest || ansicht.z <= 1.01) ? 'scrollt' : ''}`} ref=${buehneRef} style=${`width:${b}px;height:${h}px`}
        onPointerDown=${runter} onPointerMove=${bewegen} onPointerUp=${hoch} onPointerCancel=${hoch} onWheel=${rad} onContextMenu=${(e) => e.preventDefault()}>
        <div class="sv-inhalt" style=${`width:${b}px;height:${h}px;transform:translate(${ansicht.tx}px,${ansicht.ty}px) scale(${ansicht.z})`}>
          <video ref=${videoRef} src=${url} playsinline muted preload="auto" disablepictureinpicture controlslist="nodownload noplaybackrate nofullscreen"
            onContextMenu=${(e) => e.preventDefault()}
            onLoadedMetadata=${(e) => { const v = e.currentTarget; setMass({ w: v.videoWidth, h: v.videoHeight }); dauerErmitteln(v, (d) => { setDauer(d); v.currentTime = schnitt?.von ?? 0; setZeit(v.currentTime); }); }}
            onDurationChange=${(e) => Number.isFinite(e.currentTarget.duration) && setDauer(e.currentTarget.duration)}
            onTimeUpdate=${(e) => { const v = e.currentTarget; setZeit(v.currentTime); if (!v.paused && schnitt?.bis && v.currentTime >= schnitt.bis) { v.pause(); } }}
            onPlay=${() => setSpielt(true)} onPlaying=${() => setSpielt(true)} onPause=${() => setSpielt(false)} onEnded=${() => setSpielt(false)}/>
          <canvas ref=${canvasRef} class="sv-ueber"></canvas>
        </div>
        ${lupe && phase === 'markieren' ? html`<canvas ref=${lupeRef} class="sv-lupe" style=${`left:${Math.min(b - 70, Math.max(-62, lupe.x - 66))}px;top:${lupe.y > 160 ? lupe.y - 160 : lupe.y + 34}px`}></canvas>` : null}
        ${ansicht.z > 1.01 ? html`<span class="sv-zoomwert">${fmt(ansicht.z, 1)}×</span>` : null}
        ${phase === 'analyse' || phase === 'arbeit' ? html`<div class="sv-scan"><span class="sv-scanlinie"></span>
          <div class="sv-prozent"><b>${Math.round(fortschritt * 100)}</b><span>%</span></div>
          <span class="sv-scantext">${phase === 'arbeit' ? deEn('Video wird neu gespeichert …', 'Saving the video …') : deEn('Hantel wird verfolgt …', 'Tracking the bar …')}</span></div>` : null}
      </div></div>
      ${phase === 'ergebnis' && rec?.analyse && !unplausibel ? html`<${TempoKurve} analyse=${rec.analyse} zeit=${zeit}
        springen=${(t) => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, t); setZeit(v.currentTime); } }}/>` : null}
      ${phase === 'analyse' || phase === 'arbeit' ? html`<button class="btn btn-soft btn-block" onClick=${() => { abbruch.current = true; setPhase(rec?.analyse ? 'ergebnis' : 'markieren'); }}>${deEn('Abbrechen', 'Cancel')}</button>`
      : html`<div class="sv-steuer">
        <button class="iconbtn sv-play" onClick=${abspielen} aria-label=${spielt ? deEn('Pause', 'Pause') : deEn('Abspielen', 'Play')}>${spielt ? html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>` : html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`}</button>
        <div class="sv-zeitleiste" style=${dauer ? `--von:${(von / dauer) * 100}%;--bis:${(bis / dauer) * 100}%` : ''}>
          <input type="range" class="sv-zeit" min="0" max=${dauer || 0} step="0.01" value=${zeit} aria-label=${deEn('Zeit', 'Time')}
            onInput=${(e) => { const v = videoRef.current; if (v) { v.currentTime = Number(e.currentTarget.value); setZeit(v.currentTime); } }}/></div>
        <button class=${`chip sv-tempo ${langsam ? 'an' : ''}`} aria-pressed=${String(langsam)} onClick=${() => { const n = !langsam; setLangsam(n); if (videoRef.current) videoRef.current.playbackRate = n ? 0.5 : 1; }}>0,5×</button>
      </div>
      <div class="sv-werkzeuge">
        <span class="sv-uhr">${zeitText(zeit)}${dauer ? ` / ${zeitText(dauer)}` : ''}</span>
        <button class=${`chip ${fest ? 'an' : ''}`} aria-pressed=${String(fest)} onClick=${() => setFest(!fest)} aria-label=${fest ? deEn('Ansicht lösen', 'Unlock view') : deEn('Ansicht feststellen', 'Lock view')}>${SCHLOSS(fest)}</button>
        ${ansicht.z > 1.01 ? html`<button class="chip" onClick=${() => setAnsicht({ z: 1, tx: 0, ty: 0 })}>1×</button>` : null}
        ${kannSpeichern ? html`<button class=${`chip ${bearb ? 'an' : ''}`} aria-pressed=${String(bearb)} onClick=${() => setBearb(!bearb)}>${SCHERE} ${deEn('Bearbeiten', 'Edit')}</button>` : null}
      </div>`}` : null}
    ${bearb && mitVideo && phase !== 'arbeit' ? html`<div class="sv-bearb">
      <span class="eyebrow">${deEn('Kürzen', 'Trim')}</span>
      <div class="sv-schnitt"><button class="btn btn-soft btn-sm" onClick=${() => setzeSchnitt({ von: Math.min(zeit, bis - 0.3), bis: schnitt?.bis ?? null })}>⟦ ${deEn('Start hier', 'Start here')}</button>
        <span class="sv-schnitt-wert">${zeitText(von)} – ${zeitText(bis)}<small>${fmt(Math.max(0, bis - von), 1)} s</small></span>
        <button class="btn btn-soft btn-sm" onClick=${() => setzeSchnitt({ von: schnitt?.von ?? 0, bis: Math.max(zeit, von + 0.3) })}>${deEn('Ende hier', 'End here')} ⟧</button></div>
      ${schnitt ? html`<button class="link-knopf" style="align-self:flex-start" onClick=${() => setzeSchnitt(undefined)}>${deEn('Schnitt zurücksetzen', 'Reset trim')}</button>` : null}
      <span class="eyebrow">${deEn('Größe', 'Size')} · ${mb(rec?.blob?.size ?? 0)}</span>
      <div class="seg sv-seg" role="group">${GROESSEN.map(([k, t, , rate]) => html`<button key=${k} aria-pressed=${String(groesse === k)} onClick=${() => setGroesse(k)}>${t}<small>≈ ${mb((rate * Math.max(0.5, bis - von)) / 8)}</small></button>`)}</div>
      ${ansicht.z > 1.01 ? html`<label class="sv-ausschnitt"><input type="checkbox" checked=${nurAusschnitt} onChange=${(e) => setNurAusschnitt(e.currentTarget.checked)}/>
        <span><b>${deEn(`Nur den gezoomten Ausschnitt (${fmt(ansicht.z, 1)}×)`, `Only the zoomed section (${fmt(ansicht.z, 1)}×)`)}</b><br/>
        <span class="muted">${deEn('So wie gerade zu sehen – der Rand wird abgeschnitten.', 'Exactly as you see it now – the edges are cut off.')}</span></span></label>` : null}
      <button class="btn btn-chalk btn-block" onClick=${uebernehmen}>${deEn('Übernehmen', 'Apply')}</button>
      <button class="btn btn-soft btn-block" onClick=${() => ablegen()}>${deEn('Als Datei speichern …', 'Save as file …')}</button>
      ${ablageFrage ? html`<div class="sv-ablage-frage"><b>${deEn('Wo sollen deine Videos hin?', 'Where should your videos go?')}</b>
        <span class="muted sv-fuss">${deEn('Einmal wählen – gilt ab jetzt für jedes Video. Ändern in den Einstellungen.', 'Choose once – used for every video from now on. Change it in the settings.')}</span>
        <${AblageWahl} gewaehlt=${(m) => ablegen(m)} abbrechen=${() => setAblageFrage(false)}/></div>` : null}
      ${ablageModus() ? html`<span class="muted sv-fuss">${deEn('Speicherort', 'Location')}: ${ablageText(ablageModus())}</span>` : null}
      <span class="muted sv-fuss">${deEn('„Übernehmen“ ersetzt das Video in der App (Ton entfällt). Das Original in der Galerie bleibt. „Als Datei speichern“ legt die aktuelle Fassung als neue Datei am gewählten Ort ab.',
        '“Apply” replaces the video in the app (sound is dropped). The original in your gallery stays. “Save as file” stores the current version as a new file at your chosen location.')}</span>
    </div>` : null}
    ${phase === 'markieren' ? html`<div class="stack" style="gap:10px">
      <div class="row between" style="align-items:center"><span class="muted" style="font-size:13px">${deEn('Scheibendurchmesser', 'Plate diameter')}</span>
        <div class="seg sv-seg" role="group">${[45, 35, 25].map((d) => html`<button key=${d} aria-pressed=${String(durchmesser === d)} onClick=${() => setDurchmesser(d)}>${d} cm</button>`)}</div></div>
      ${mitte ? html`<div class="row" style="gap:8px">
        <button class="chip" onClick=${() => { setMitte(null); setRand(null); setSchritt('mitte'); }}>${deEn('Mitte neu', 'Centre again')}</button>
        ${rand ? html`<button class="chip" onClick=${() => { setRand(null); setSchritt('rand'); }}>${deEn('Rand neu', 'Edge again')}</button>` : null}</div>` : null}
      <button class="btn btn-chalk btn-block sv-los" disabled=${!mitte || !rand} onClick=${analysieren}>${deEn('Hantelweg berechnen', 'Track the bar path')}</button>
    </div>` : null}
    ${fehler ? html`<div class="hint immer">${I.warn}<span class="t">${deEn('Hat nicht geklappt', 'That didn\'t work')}</span><span></span><p>${fehler}</p></div>` : null}
    ${info ? html`<div class="hint gut immer">${I.check}<span class="t">${deEn('Erledigt', 'Done')}</span><span></span><p>${info}</p></div>` : null}
    ${unplausibel && phase === 'ergebnis' ? html`<div class="hint immer">${I.warn}<span class="t">${deEn('Sieht nicht nach Hantel aus', 'Doesn\'t look like a barbell')}</span><span></span>
      <p>${deEn(`Zahlen nicht übernommen: ${unplausibel.map((g) => GRUND[g]).join(', ')}. Mitte und Rand genauer setzen oder ab dem Satzbeginn markieren.`, `Numbers not saved: ${unplausibel.map((g) => GRUND[g]).join(', ')}. Set centre and edge more precisely or mark from the start of the set.`)}</p>
      ${wdh.length && kannSpeichern ? html`<div class="row" style="gap:8px;margin-top:8px"><button class="btn btn-soft btn-sm" onClick=${trotzdem}>${deEn('Trotzdem übernehmen', 'Save anyway')}</button>
        <button class="btn btn-soft btn-sm" onClick=${() => { setMitte(null); setRand(null); setSchritt('mitte'); setUnplausibel(null); setPhase('markieren'); }}>${deEn('Neu markieren', 'Mark again')}</button></div>` : null}</div>` : null}
    ${(phase === 'ergebnis' || phase === 'fremd') && tempo?.v?.length ? html`
      <div class="sv-held">
        <div class="sv-held-zahl"><span class="l">${deEn('Ø Tempo', 'Avg. velocity')}</span><div><b>${ms(schnittV)}</b><span>m/s</span></div></div>
        <div class="sv-held-neben">
          <div><span class="l">${deEn('Schnellste', 'Fastest')}</span><b>${ms(beste)}</b></div>
          ${tempo.vl != null ? html`<div><span class="l">${deEn('Verlust', 'Loss')}</span><b class=${tempo.vl >= 30 ? 'warn' : ''}>−${fmt(tempo.vl, 0)} %</b></div>` : null}
          ${spitze ? html`<div><span class="l">${deEn('Spitze', 'Peak')}</span><b>${ms(spitze)}</b></div>` : null}
        </div>
      </div>
      <div class="sv-wdh" role="list">${tempo.v.map((v, i) => html`<div key=${i} class="sv-wdh-s" role="listitem" style=${`--h:${Math.max(0.12, v / beste)};--d:${i * 60}ms`}>
        <span class="sv-wdh-w">${ms(v)}</span><i class=${v / beste < 0.7 ? 'lahm' : v / beste < 0.85 ? 'mittel' : ''}></i><span class="sv-wdh-n">${i + 1}</span></div>`)}</div>
      ${rekord?.rekord ? html`<div class="sv-rekord"><span class="sv-rekord-blitz" aria-hidden="true">⚡</span>
        <div><b>${deEn(`Tempo-Rekord bei ${fmt(satz.kg)} kg`, `Velocity record at ${fmt(satz.kg)} kg`)}</b>
        <span>${deEn(`${ms(beste)} m/s – bisher ${ms(rekord.vorher)}`, `${ms(beste)} m/s – before ${ms(rekord.vorher)}`)}</span></div></div>` : null}
      ${gruppe ? html`<div class="sv-info"><span class="l">${deEn(`Zwischen den Sätzen · ${fmt(gruppe.kg)} kg`, `Between sets · ${fmt(gruppe.kg)} kg`)}</span>
        <div class="sv-kette">${gruppe.werte.map((v, i) => html`<span key=${i} class=${Math.abs(v - beste) < 0.001 ? 'dieser' : ''}>${ms(v)}</span>`)}</div>
        <b class=${gruppe.pct >= 20 ? 'warn' : gruppe.pct <= 0 ? 'gut' : ''}>${vz(-gruppe.pct)} %</b>
        <small>${deEn('letzter gegen ersten Satz mit diesem Gewicht', 'last vs. first set at this weight')}</small></div>` : null}
      ${ueber?.tf ? html`<div class=${`sv-info form ${ueber.tf.pct >= 3 ? 'gut' : ueber.tf.pct <= -3 ? 'schlecht' : ''}`}>
        <span class="l">${deEn('Tagesform', 'Form today')}</span>
        <div class="sv-kette"><span>${ueber.tf.pct >= 3 ? deEn('schneller als üblich', 'faster than usual') : ueber.tf.pct <= -3 ? deEn('langsamer als üblich', 'slower than usual') : deEn('wie üblich', 'as usual')}</span></div>
        <b>${vz(ueber.tf.pct)} %</b>
        <small>${ueber.tf.e1rm ? deEn(`e1RM heute ≈ ${fmt(ueber.tf.e1rm)} kg${ueber.profil.e1rm ? ` (sonst ${fmt(ueber.profil.e1rm)})` : ''} · aus ${ueber.tf.n} ${ueber.tf.n === 1 ? 'Satz' : 'Sätzen'} heute gegen dein Gewicht-Tempo-Profil`,
          `e1RM today ≈ ${fmt(ueber.tf.e1rm)} kg${ueber.profil.e1rm ? ` (usually ${fmt(ueber.profil.e1rm)})` : ''} · from ${ueber.tf.n} ${ueber.tf.n === 1 ? 'set' : 'sets'} today vs. your load-velocity profile`)
          : deEn('gegen dein Gewicht-Tempo-Profil', 'vs. your load-velocity profile')}</small></div>`
        : ueber && ueber.profil.fehlt ? html`<span class="muted sv-fuss">${deEn('Tagesform ab 3 früheren Sätzen mit Tempo bei verschiedenen Gewichten – Aufwärmsätze filmen hilft.', 'Form today from 3 earlier sets with velocity at different weights – filming warm-ups helps.')}</span>` : null}
      ${vergleich === 'schwerer' ? html`<div class="hint immer">${I.warn}<span class="t">${deEn(`Tempo wie sonst bei RPE ${fmt(profil.rpe)}`, `Velocity like RPE ${fmt(profil.rpe)} usually`)}</span><span></span>
          <p>${deEn(`Eingetragen ist RPE ${fmt(satz.rpe)}. Die letzte Wdh war so langsam wie sonst bei RPE ${fmt(profil.rpe)} – der Satz war vermutlich schwerer.`, `You entered RPE ${fmt(satz.rpe)}. The last rep was as slow as usually at RPE ${fmt(profil.rpe)} – the set was probably harder.`)}</p></div>`
        : vergleich === 'leichter' ? html`<div class="hint tipp immer">${I.statistik}<span class="t">${deEn(`Tempo wie sonst bei RPE ${fmt(profil.rpe)}`, `Velocity like RPE ${fmt(profil.rpe)} usually`)}</span><span></span>
          <p>${deEn(`Eingetragen ist RPE ${fmt(satz.rpe)}. Die letzte Wdh war so schnell wie sonst bei RPE ${fmt(profil.rpe)} – da war noch Luft.`, `You entered RPE ${fmt(satz.rpe)}. The last rep was as fast as usually at RPE ${fmt(profil.rpe)} – there was more in the tank.`)}</p></div>`
        : vergleich === 'passt' ? html`<div class="hint gut immer">${I.check}<span class="t">${deEn(`Tempo passt zu RPE ${fmt(satz.rpe)}`, `Velocity matches RPE ${fmt(satz.rpe)}`)}</span><span></span><p>${deEn('Deine RPE-Angabe und das Tempo der letzten Wdh stimmen überein.', 'Your RPE and the velocity of the last rep agree.')}</p></div>`
        : profil?.fehlen ? html`<span class="muted sv-fuss">${deEn(`RPE-Abgleich ab 4 eigenen Sätzen mit Video und RPE – noch ${profil.fehlen}.`, `RPE check from 4 of your own sets with video and RPE – ${profil.fehlen} to go.`)}</span>` : null}
      <span class="muted sv-fuss">${deEn('Richtwerte aus dem Video, kein Messgerät: von der Seite und ohne Zoom filmen, dann stimmen sie am besten.', 'Estimates from the video, not a measuring device: film from the side without zoom for the best results.')}</span>` : null}
    ${phase === 'ergebnis' && !wdh.length && !unplausibel ? html`<div class="hint tipp immer">${I.statistik}<span class="t">${deEn('Keine Wiederholung erkannt', 'No rep detected')}</span><span></span>
      <p>${deEn('Die Bahn ist da, aber kein Hub über 10 cm. Ab dem Satzbeginn markieren oder den Scheibendurchmesser prüfen.', 'The path is there, but no lift over 10 cm. Mark from the start of the set or check the plate diameter.')}</p></div>` : null}
    ${kannSpeichern && (phase === 'ergebnis' || (phase === 'markieren' && rec)) ? html`<div class="sv-knoepfe">
      ${phase === 'ergebnis' ? html`<button class="btn btn-soft" onClick=${() => { setMitte(null); setRand(null); setSchritt('mitte'); setUnplausibel(null); setPhase('markieren'); }}>${deEn('Neu markieren', 'Mark again')}</button>` : null}
      <button class="btn btn-soft" onClick=${() => dateiKamera.current?.click()}>${deEn('Neu filmen', 'Record again')}</button>
      <button class="btn btn-gefahr" onClick=${() => setLoeschen(true)} aria-label=${deEn('Löschen', 'Delete')}>${I.papierkorb}</button></div>
      ${rec?.blob ? html`<span class="muted sv-fuss">${deEn(`Nur auf diesem Gerät · ${mb(rec.blob.size)}`, `Only on this device · ${mb(rec.blob.size)}`)}</span>` : null}` : null}
    ${phase === 'fremd' && (speichern || (meta && rec)) ? html`<button class="btn btn-gefahr btn-block" onClick=${async () => {
      if (meta && rec?.id) { await videoLoeschen(rec.id).catch(() => {}); meldeNeu(null); setRec(null); setPhase('waehlen'); return; }
      zahlenWeg(); speichern({ video: null }); zu?.(); }}>${I.papierkorb} ${deEn('Zahlen löschen', 'Delete numbers')}</button>` : null}
    ${!kannSpeichern && phase !== 'laden' ? html`<span class="muted sv-fuss">${deEn('Nur ansehen – ändern und löschen über „Bearbeiten“ beim Training.', 'View only – change or delete via “Edit” on the workout.')}</span>` : null}
    ${loeschen ? html`<div class="sv-frage" role="alertdialog" aria-label=${deEn('Löschen', 'Delete')}>
      <b>${deEn('Was löschen?', 'Delete what?')}</b>
      <button class="btn btn-gefahr btn-block" onClick=${() => weg(false)}>${deEn('Nur das Video', 'Only the video')}<small>${meta ? deEn('Tempo-Werte bleiben in Liste und Statistik', 'Velocity values stay in the list and stats') : deEn('Tempo-Werte im Satz bleiben', 'Velocity values stay in the set')}</small></button>
      ${speichern || meta ? html`<button class="btn btn-gefahr btn-block" onClick=${() => weg(true)}>${deEn('Video und Zahlen', 'Video and numbers')}<small>${meta ? deEn('auch aus Liste und Statistik', 'also from the list and stats') : deEn('auch Tempo und m/s im Satz', 'also velocity and m/s in the set')}</small></button>` : null}
      <button class="btn btn-soft btn-block" onClick=${() => setLoeschen(false)}>${deEn('Abbrechen', 'Cancel')}</button></div>` : null}
  </div>`;
}
