// PR Hunter · Satz-Video mit Hantelweg und Tempo (Wunsch 268). Video nur auf diesem Gerät (IndexedDB „prh-videos“),
// nie hochgeladen. Im Satz landen nur die Zahlen: extra.video (Kennung), extra.tempo { v: m/s je Wdh, vl: Verlust in % },
// extra.ms (schnellste Wdh, wie das Feld „Tempo (m/s)“). Rechnung in js/hantelweg.js.
import { html, useState, useEffect, useRef, Sheet, deEn, fmt, I } from './basis.js';
import { trainingsTage, trainingAm, kanon } from './stand.js';
import { grau, verfolger, wiederholungen, rpeAusTempo, rpeVergleich } from '../js/hantelweg.js';

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
export async function videoUebersicht() {
  const alle = await tx('readonly', (s) => s.getAll());
  return { anzahl: alle.length, bytes: alle.reduce((a, v) => a + (v.blob?.size ?? 0), 0) };
}
export const mb = (bytes) => `${fmt(bytes / 1048576, bytes < 10485760 ? 1 : 0)} MB`;

// #################################################################
// Bahn aus dem Video: Bild für Bild springen (seeked), verkleinert zeichnen, Scheibe verfolgen
// #################################################################
const ANALYSE_BREITE = 320, FPS = 20;
function springe(v, t) {
  return new Promise((ok) => {
    const fertig = () => { v.removeEventListener('seeked', fertig); clearTimeout(z); ok(); };
    const z = setTimeout(fertig, 1500);                    // manche Geräte melden „seeked“ nicht → nach 1,5 s weiter
    v.addEventListener('seeked', fertig);
    v.currentTime = t;
  });
}
/** Dauer des Videos; WebM ohne Dauer (Infinity, z. B. aus manchen Galerien) erst ans Ende springen lassen. */
function dauerErmitteln(v, fertig) {
  if (Number.isFinite(v.duration)) { fertig(v.duration); return; }
  const f = () => { if (!Number.isFinite(v.duration)) return; v.removeEventListener('durationchange', f); v.currentTime = 0; fertig(v.duration); };
  v.addEventListener('durationchange', f);
  v.currentTime = 1e101;
}
async function bahnAusVideo(v, { start, mitte, rand, durchmesserM, fortschritt, beiPunkt, abbruch }) {
  const b = ANALYSE_BREITE, h = Math.round((b * v.videoHeight) / v.videoWidth), k = b / v.videoWidth;
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const bild = () => { ctx.drawImage(v, 0, 0, b, h); return grau(ctx.getImageData(0, 0, b, h).data, b, h); };
  await springe(v, start);
  const radius = Math.hypot(rand.x - mitte.x, rand.y - mitte.y) * k;
  if (radius < 6) throw new Error(deEn('Die Scheibe ist im Bild zu klein – näher ran filmen.', 'The plate is too small in the frame – film closer.'));
  const verf = verfolger();
  if (!verf.start(bild(), b, h, mitte.x * k, mitte.y * k, radius)) throw new Error(deEn('Die Scheibe liegt zu nah am Bildrand.', 'The plate is too close to the edge of the frame.'));
  const punkte = [{ t: start, x: mitte.x * k, y: mitte.y * k }];
  let verloren = 0;
  const ende = v.duration - 0.02;
  for (let t = start + 1 / FPS; t <= ende && !abbruch.current; t += 1 / FPS) {
    await springe(v, t);
    const p = verf.schritt(bild());
    if (p) { punkte.push({ t, x: p.x, y: p.y }); verloren = 0; beiPunkt?.(punkte); } else if (++verloren > 8) break;
    fortschritt(Math.min(1, (t - start) / Math.max(0.1, ende - start)));
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
// Zeichnen: Bahn mit Glühen, konzentrisch grün, sonst Akzent; Markierung beim Antippen
// #################################################################
const farbe = (name, ersatz) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz; } catch { return ersatz; } };
function zeichne(canvas, { analyse = null, bis = Infinity, mitte = null, rand = null, videoBreite = 1, scan = null }) {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gruen = farbe('--ok', '#3ddc84'), akzent = farbe('--acc-hi', '#ff4d6d');
  const bahn = analyse ?? scan;
  if (bahn?.punkte?.length > 1) {
    const s = canvas.width / bahn.breite, p = bahn.punkte, wdh = analyse?.wdh ?? [];
    const konz = (t) => wdh.some((w) => t >= w.von && t <= w.bis);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ganze Bahn blass, gezeigter Teil leuchtend
    ctx.globalAlpha = 0.22; ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#fff';
    ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x * s, q.y * s) : ctx.moveTo(q.x * s, q.y * s))); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 3.2 * dpr; ctx.shadowBlur = 14 * dpr;
    // erst abwärts (Akzent), dann konzentrisch (grün) obendrauf – bei geradem Weg liegen beide übereinander
    for (const hoch of [false, true]) {
      const c = hoch ? gruen : akzent;
      ctx.strokeStyle = c; ctx.shadowColor = c; ctx.lineWidth = (hoch ? 3.6 : 2.6) * dpr;
      for (let i = 1; i < p.length && p[i].t <= bis; i++) {
        if (konz(p[i].t) !== hoch) continue;
        ctx.beginPath(); ctx.moveTo(p[i - 1].x * s, p[i - 1].y * s); ctx.lineTo(p[i].x * s, p[i].y * s); ctx.stroke();
      }
    }
    const jetzt = [...p].reverse().find((q) => q.t <= bis) ?? p[0];
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 18 * dpr; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(jetzt.x * s, jetzt.y * s, 5 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (mitte) {
    const s = canvas.width / videoBreite, x = mitte.x * s, y = mitte.y * s;
    ctx.strokeStyle = akzent; ctx.lineWidth = 2 * dpr; ctx.shadowColor = akzent; ctx.shadowBlur = 10 * dpr;
    ctx.beginPath(); ctx.moveTo(x - 12 * dpr, y); ctx.lineTo(x + 12 * dpr, y); ctx.moveTo(x, y - 12 * dpr); ctx.lineTo(x, y + 12 * dpr); ctx.stroke();
    if (rand) {
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath(); ctx.arc(x, y, Math.hypot(rand.x - mitte.x, rand.y - mitte.y) * s, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.shadowBlur = 0;
  }
}

const KAMERA = html`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l6-3v9l-6-3z"/></svg>`;
const ms = (v) => `${fmt(v, 2)}`;

/** Einstellungen → Training: Schalter, belegter Speicher, alle Videos löschen. */
export function VideoEinstellung({ einst, setEinst }) {
  const [stand, setStand] = useState(null);
  const [frage, setFrage] = useState(false);
  const lade = () => videoUebersicht().then(setStand).catch(() => setStand(null));
  useEffect(() => { lade(); }, []);
  return html`<label class="schalter" for="e-video"><span><b>${deEn('Satz-Video mit Hantelweg', 'Set video with bar path')}</b><br/>
      <span class="muted" style="font-size:12.5px">${deEn('Unter jedem abgehakten Satz eine Kamera: filmen, Hantelweg und Tempo je Wdh sehen, RPE mit dem Tempo abgleichen. Videos bleiben auf diesem Gerät.',
        'A camera under every completed set: film it, see the bar path and velocity per rep, check your RPE against the velocity. Videos stay on this device.')}</span>
      ${stand?.anzahl ? html`<span class="muted sv-speicher">${deEn(`${stand.anzahl} ${stand.anzahl === 1 ? 'Video' : 'Videos'} · ${mb(stand.bytes)} auf diesem Gerät`, `${stand.anzahl} ${stand.anzahl === 1 ? 'video' : 'videos'} · ${mb(stand.bytes)} on this device`)}
        ${frage ? html` · <button class="link-knopf gefahr" onClick=${(e) => { e.preventDefault(); alleVideosLoeschen().then(() => { setFrage(false); lade(); }); }}>${deEn('Wirklich alle löschen', 'Really delete all')}</button>`
          : html` · <button class="link-knopf" onClick=${(e) => { e.preventDefault(); setFrage(true); }}>${deEn('Alle löschen', 'Delete all')}</button>`}</span>` : null}</span>
    <input type="checkbox" id="e-video" checked=${einst.satzVideo !== false} onChange=${(e) => setEinst({ ...einst, satzVideo: e.currentTarget.checked })}/></label>`;
}

/** Knopf unter einem abgehakten Satz: Kamera, mit Ergebnis die schnellste Wdh in m/s. */
export function SatzVideoKnopf({ satz, oeffnen }) {
  const tempo = satz.extra?.tempo, da = !!satz.extra?.video || !!tempo;
  return html`<button class=${`sv-knopf ${da ? 'da' : ''}`} onClick=${oeffnen} aria-label=${deEn('Satz-Video', 'Set video')}>${KAMERA}
    ${da && satz.extra?.ms == null ? html`<span>${deEn('Video', 'Video')}</span>` : null}</button>`;   /* m/s steht schon in den Satzdetails */
}

/** Fenster für einen Satz. speichern(patch) setzt Felder in satz.extra (null entfernt sie). */
export function SatzVideo({ satz, uebungKey, uebungName, lift, zu, speichern }) {
  const [phase, setPhase] = useState('laden');            // laden | waehlen | markieren | analyse | ergebnis | fremd
  const [rec, setRec] = useState(null);
  const [url, setUrl] = useState(null);
  const [mitte, setMitte] = useState(null);
  const [rand, setRand] = useState(null);
  const [durchmesser, setDurchmesser] = useState(45);
  const [fortschritt, setFortschritt] = useState(0);
  const [fehler, setFehler] = useState(null);
  const [zeit, setZeit] = useState(0);
  const [dauer, setDauer] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const [langsam, setLangsam] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const videoRef = useRef(null), canvasRef = useRef(null), abbruch = useRef(false), scan = useRef(null);
  const dateiKamera = useRef(null), dateiGalerie = useRef(null);

  useEffect(() => {
    let weg = false;
    (async () => {
      const id = satz.extra?.video;
      const r = id ? await videoLaden(id).catch(() => null) : null;
      if (weg) return;
      if (r) { setRec(r); setPhase(r.analyse ? 'ergebnis' : 'markieren'); } else setPhase(satz.extra?.tempo ? 'fremd' : 'waehlen');
    })();
    return () => { weg = true; abbruch.current = true; };
  }, []);
  useEffect(() => { if (!rec?.blob) return undefined; const u = URL.createObjectURL(rec.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [rec?.blob]);
  // Überlagerung neu zeichnen, solange das Video läuft
  useEffect(() => {
    let id = 0;
    const male = () => {
      const v = videoRef.current;
      zeichne(canvasRef.current, { analyse: phase === 'ergebnis' ? rec?.analyse : null, scan: phase === 'analyse' ? scan.current : null,
        bis: phase === 'ergebnis' ? v?.currentTime ?? Infinity : Infinity, mitte: phase === 'markieren' ? mitte : null, rand, videoBreite: v?.videoWidth || 1 });
      if (spielt || phase === 'analyse') id = requestAnimationFrame(male);
    };
    male();
    return () => cancelAnimationFrame(id);
  }, [phase, spielt, mitte, rand, rec, zeit]);

  const datei = async (f) => {
    if (!f) return;
    setFehler(null);
    const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const r = { id, blob: f, typ: f.type, erstellt: new Date().toISOString(), key: uebungKey, kg: satz.kg, wdh: satz.wdh };
    try { await videoAblegen(r); navigator.storage?.persist?.().catch(() => {}); } catch {
      setFehler(deEn('Kein Platz für das Video auf diesem Gerät.', 'No space for the video on this device.')); return;
    }
    if (rec?.id) videoLoeschen(rec.id).catch(() => {});
    setRec(r); setMitte(null); setRand(null); setPhase('markieren');
    speichern({ video: id });
  };
  const tippen = (e) => {
    if (phase !== 'markieren') return;
    const v = videoRef.current, r = e.currentTarget.getBoundingClientRect();
    if (!v?.videoWidth) return;
    const p = { x: ((e.clientX - r.left) / r.width) * v.videoWidth, y: ((e.clientY - r.top) / r.height) * v.videoHeight };
    if (!mitte || rand) { setMitte(p); setRand(null); } else setRand(p);
  };
  const analysieren = async () => {
    const v = videoRef.current;
    if (!v || !mitte || !rand) return;
    setFehler(null); setPhase('analyse'); setFortschritt(0); abbruch.current = false; scan.current = null;
    try {
      v.pause();
      const erg = await bahnAusVideo(v, { start: v.currentTime, mitte, rand, durchmesserM: durchmesser / 100, fortschritt: setFortschritt, abbruch,
        beiPunkt: (punkte) => { scan.current = { punkte, breite: ANALYSE_BREITE }; } });
      if (abbruch.current) return;
      const auswertung = wiederholungen(erg.punkte, erg.mProPx);
      const analyse = { ...erg, ...auswertung, durchmesser };
      const neu = { ...rec, analyse };
      await videoAblegen(neu).catch(() => {});
      setRec(neu); setPhase('ergebnis');
      await springe(v, erg.punkte[0]?.t ?? 0); setZeit(v.currentTime);
      if (auswertung.wdh.length) {
        const v1 = auswertung.wdh.map((w) => w.mcv);
        speichern({ tempo: { v: v1, vl: auswertung.verlust }, ms: Math.max(...v1) });
      } else speichern({ tempo: null });
    } catch (e) { setFehler(e.message ?? String(e)); setPhase('markieren'); }
  };
  const abspielen = () => { const v = videoRef.current; if (!v) return; if (v.paused) { v.playbackRate = langsam ? 0.5 : 1; v.play().catch(() => {}); } else v.pause(); };
  const weg = async () => { if (rec?.id) await videoLoeschen(rec.id).catch(() => {}); speichern({ video: null }); setLoeschen(false); zu(); };

  const a = rec?.analyse, wdh = a?.wdh ?? [];
  const tempo = phase === 'fremd' ? satz.extra?.tempo : wdh.length ? { v: wdh.map((w) => w.mcv), vl: a.verlust } : null;
  const beste = tempo?.v?.length ? Math.max(...tempo.v) : null;
  const schnitt = tempo?.v?.length ? tempo.v.reduce((x, y) => x + y, 0) / tempo.v.length : null;
  const spitze = wdh.length ? Math.max(...wdh.map((w) => w.spitze)) : null;
  // RPE-Abgleich mit dem eigenen Profil (ohne diesen Satz: der steckt im Verlauf erst nach dem Speichern)
  const profil = tempo?.v?.length ? rpeAusTempo(tempo.v.at(-1), tempoPaare(uebungKey, lift)) : null;
  const vergleich = rpeVergleich(satz.rpe ?? null, profil?.rpe ?? null);
  const titel = `${uebungName} · ${fmt(satz.kg)} × ${satz.wdh}${satz.rpe != null ? ` @ ${fmt(satz.rpe)}` : ''}`;

  return html`<${Sheet} zu=${zu} label=${deEn('Satz-Video', 'Set video')} voll=${true}>
    <div class="sv">
      <div class="row between" style="align-items:flex-start"><div><div class="eyebrow">${deEn('Satz-Video', 'Set video')}</div><h2 class="h2 sv-titel">${titel}</h2></div>
        <button class="iconbtn" onClick=${zu} aria-label=${deEn('Schließen', 'Close')}>${I.zu}</button></div>
      <input ref=${dateiKamera} type="file" accept="video/*" capture="environment" hidden onChange=${(e) => datei(e.currentTarget.files?.[0])}/>
      <input ref=${dateiGalerie} type="file" accept="video/*" hidden onChange=${(e) => datei(e.currentTarget.files?.[0])}/>
      ${phase === 'laden' ? html`<div class="sv-leer"><span class="sv-lader"></span></div>` : null}
      ${phase === 'waehlen' || phase === 'fremd' ? html`<div class="sv-start">
        <div class="sv-start-bild" aria-hidden="true"><span class="sv-ring"></span><span class="sv-ring b"></span>${KAMERA}</div>
        ${phase === 'fremd' ? html`<p class="muted" style="margin:0;text-align:center">${deEn('Das Video liegt auf einem anderen Gerät – hier nur die Zahlen.', 'The video is on another device – only the numbers here.')}</p>`
          : html`<p class="muted" style="margin:0;text-align:center">${deEn('Von der Seite filmen, die ganze Scheibe im Bild, Handy ruhig.', 'Film from the side, whole plate in frame, phone steady.')}</p>`}
        <div class="sv-knoepfe"><button class="btn btn-chalk" onClick=${() => dateiKamera.current?.click()}>${KAMERA} ${deEn('Filmen', 'Record')}</button>
          <button class="btn btn-soft" onClick=${() => dateiGalerie.current?.click()}>${deEn('Aus der Galerie', 'From gallery')}</button></div>
        <span class="muted sv-privat">${I.check} ${deEn('Das Video bleibt auf diesem Handy und wird nie hochgeladen.', 'The video stays on this phone and is never uploaded.')}</span>
      </div>` : null}
      ${url && ['markieren', 'analyse', 'ergebnis'].includes(phase) ? html`
        <div class="sv-buehne" style=${rec?.analyse ? `aspect-ratio:${rec.analyse.breite} / ${rec.analyse.hoehe}` : videoRef.current?.videoWidth ? `aspect-ratio:${videoRef.current.videoWidth} / ${videoRef.current.videoHeight}` : ''}
          onClick=${tippen}>
          <video ref=${videoRef} src=${url} playsinline muted preload="auto" onLoadedMetadata=${(e) => dauerErmitteln(e.currentTarget, (d) => { setDauer(d); setZeit(0); })}
            onTimeUpdate=${(e) => setZeit(e.currentTarget.currentTime)} onPlay=${() => setSpielt(true)} onPause=${() => setSpielt(false)} onEnded=${() => setSpielt(false)}/>
          <canvas ref=${canvasRef} class="sv-ueber"></canvas>
          ${phase === 'analyse' ? html`<div class="sv-scan"><span class="sv-scanlinie"></span>
            <div class="sv-prozent"><b>${Math.round(fortschritt * 100)}</b><span>%</span></div><span class="sv-scantext">${deEn('Hantel wird verfolgt …', 'Tracking the bar …')}</span></div>` : null}
          ${phase === 'markieren' ? html`<div class="sv-anleitung">${!mitte || rand ? (mitte && rand ? deEn('Bereit – oder neu antippen', 'Ready – or tap again') : deEn('Zum Satzbeginn spulen, dann die Mitte der Scheibe antippen', 'Scrub to the start of the set, then tap the centre of the plate'))
            : deEn('Jetzt den äußeren Rand der Scheibe antippen', 'Now tap the outer edge of the plate')}</div>` : null}
        </div>
        ${phase !== 'analyse' ? html`<div class="sv-steuer">
          <button class="iconbtn sv-play" onClick=${abspielen} aria-label=${spielt ? deEn('Pause', 'Pause') : deEn('Abspielen', 'Play')}>${spielt ? html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>` : html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`}</button>
          <input type="range" class="sv-zeit" min="0" max=${dauer || 0} step="0.01" value=${zeit} aria-label=${deEn('Zeit', 'Time')}
            onInput=${(e) => { const v = videoRef.current; if (v) { v.currentTime = Number(e.currentTarget.value); setZeit(v.currentTime); } }}/>
          <button class=${`chip sv-tempo ${langsam ? 'an' : ''}`} aria-pressed=${String(langsam)} onClick=${() => { const n = !langsam; setLangsam(n); if (videoRef.current) videoRef.current.playbackRate = n ? 0.5 : 1; }}>0,5×</button>
        </div>` : html`<button class="btn btn-soft btn-block" onClick=${() => { abbruch.current = true; setPhase('markieren'); }}>${deEn('Abbrechen', 'Cancel')}</button>`}` : null}
      ${phase === 'markieren' ? html`<div class="stack" style="gap:10px">
        <div class="row between" style="align-items:center"><span class="muted" style="font-size:13px">${deEn('Scheibendurchmesser', 'Plate diameter')}</span>
          <div class="seg sv-seg" role="group">${[45, 35, 25].map((d) => html`<button key=${d} aria-pressed=${String(durchmesser === d)} onClick=${() => setDurchmesser(d)}>${d} cm</button>`)}</div></div>
        <button class="btn btn-chalk btn-block sv-los" disabled=${!mitte || !rand} onClick=${analysieren}>${deEn('Hantelweg berechnen', 'Track the bar path')}</button>
      </div>` : null}
      ${fehler ? html`<div class="hint immer">${I.warn}<span class="t">${deEn('Hat nicht geklappt', 'That didn\'t work')}</span><span></span><p>${fehler}</p></div>` : null}
      ${(phase === 'ergebnis' || phase === 'fremd') && tempo?.v?.length ? html`
        <div class="sv-held">
          <div class="sv-held-zahl"><span class="l">${deEn('Ø Tempo', 'Avg. velocity')}</span><div><b>${ms(schnitt)}</b><span>m/s</span></div></div>
          <div class="sv-held-neben">
            <div><span class="l">${deEn('Schnellste', 'Fastest')}</span><b>${ms(beste)}</b></div>
            ${tempo.vl != null ? html`<div><span class="l">${deEn('Verlust', 'Loss')}</span><b class=${tempo.vl >= 30 ? 'warn' : ''}>−${fmt(tempo.vl, 0)} %</b></div>` : null}
            ${spitze ? html`<div><span class="l">${deEn('Spitze', 'Peak')}</span><b>${ms(spitze)}</b></div>` : null}
          </div>
        </div>
        <div class="sv-wdh" role="list">${tempo.v.map((v, i) => html`<div key=${i} class="sv-wdh-s" role="listitem" style=${`--h:${Math.max(0.12, v / beste)};--d:${i * 60}ms`}>
          <span class="sv-wdh-w">${ms(v)}</span><i class=${v / beste < 0.7 ? 'lahm' : v / beste < 0.85 ? 'mittel' : ''}></i><span class="sv-wdh-n">${i + 1}</span></div>`)}</div>
        ${vergleich === 'schwerer' ? html`<div class="hint immer">${I.warn}<span class="t">${deEn(`Tempo wie sonst bei RPE ${fmt(profil.rpe)}`, `Velocity like RPE ${fmt(profil.rpe)} usually`)}</span><span></span>
            <p>${deEn(`Eingetragen ist RPE ${fmt(satz.rpe)}. Die letzte Wdh war so langsam wie sonst bei RPE ${fmt(profil.rpe)} – der Satz war vermutlich schwerer.`, `You entered RPE ${fmt(satz.rpe)}. The last rep was as slow as usually at RPE ${fmt(profil.rpe)} – the set was probably harder.`)}</p></div>`
          : vergleich === 'leichter' ? html`<div class="hint tipp immer">${I.statistik}<span class="t">${deEn(`Tempo wie sonst bei RPE ${fmt(profil.rpe)}`, `Velocity like RPE ${fmt(profil.rpe)} usually`)}</span><span></span>
            <p>${deEn(`Eingetragen ist RPE ${fmt(satz.rpe)}. Die letzte Wdh war so schnell wie sonst bei RPE ${fmt(profil.rpe)} – da war noch Luft.`, `You entered RPE ${fmt(satz.rpe)}. The last rep was as fast as usually at RPE ${fmt(profil.rpe)} – there was more in the tank.`)}</p></div>`
          : vergleich === 'passt' ? html`<div class="hint gut immer">${I.check}<span class="t">${deEn(`Tempo passt zu RPE ${fmt(satz.rpe)}`, `Velocity matches RPE ${fmt(satz.rpe)}`)}</span><span></span><p>${deEn('Deine RPE-Angabe und das Tempo der letzten Wdh stimmen überein.', 'Your RPE and the velocity of the last rep agree.')}</p></div>`
          : profil?.fehlen ? html`<span class="muted sv-fuss">${deEn(`RPE-Abgleich ab 4 eigenen Sätzen mit Video und RPE – noch ${profil.fehlen}.`, `RPE check from 4 of your own sets with video and RPE – ${profil.fehlen} to go.`)}</span>` : null}
        <span class="muted sv-fuss">${deEn('Richtwerte aus dem Video, kein Messgerät: von der Seite und ohne Zoom filmen, dann stimmen sie am besten.', 'Estimates from the video, not a measuring device: film from the side without zoom for the best results.')}</span>` : null}
      ${phase === 'ergebnis' && !wdh.length ? html`<div class="hint tipp immer">${I.statistik}<span class="t">${deEn('Keine Wiederholung erkannt', 'No rep detected')}</span><span></span>
        <p>${deEn('Die Bahn ist da, aber kein Hub über 10 cm. Ab dem Satzbeginn markieren oder den Scheibendurchmesser prüfen.', 'The path is there, but no lift over 10 cm. Mark from the start of the set or check the plate diameter.')}</p></div>` : null}
      ${phase === 'ergebnis' || (phase === 'markieren' && rec) ? html`<div class="sv-knoepfe">
        ${phase === 'ergebnis' ? html`<button class="btn btn-soft" onClick=${() => { setMitte(null); setRand(null); setPhase('markieren'); }}>${deEn('Neu markieren', 'Mark again')}</button>` : null}
        <button class="btn btn-soft" onClick=${() => dateiKamera.current?.click()}>${deEn('Neu filmen', 'Record again')}</button>
        <button class="btn btn-gefahr" onClick=${() => setLoeschen(true)}>${I.papierkorb}</button></div>
        ${rec?.blob ? html`<span class="muted sv-fuss">${deEn(`Nur auf diesem Gerät · ${mb(rec.blob.size)}`, `Only on this device · ${mb(rec.blob.size)}`)}</span>` : null}` : null}
      ${loeschen ? html`<div class="hint immer">${I.warn}<span class="t">${deEn('Video löschen?', 'Delete video?')}</span><span></span>
        <p>${deEn('Das Video wird von diesem Gerät gelöscht. Die Tempo-Werte im Satz bleiben.', 'The video is deleted from this device. The velocity values stay in the set.')}</p>
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn btn-gefahr btn-sm" onClick=${weg}>${deEn('Löschen', 'Delete')}</button>
          <button class="btn btn-soft btn-sm" onClick=${() => setLoeschen(false)}>${deEn('Behalten', 'Keep')}</button></div></div>` : null}
    </div>
  </${Sheet}>`;
}
