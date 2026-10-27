// PR Hunter · Abschlusskarte nach „Training beenden → Speichern“ (Wünsche 70, 97): Dauer, Volumen, Sätze, Übungen,
// Rekorde und das ganze Training – jede Übung mit ihren Sätzen (gleiche kg × Wdh hintereinander zusammengefasst).
// Sätze und Gewichte lassen sich ausblenden (gemerkt pro Gerät). „Teilen“ zeichnet dieselbe Karte als Bild (Canvas,
// 1080 × 1350) und gibt sie ans Teilen-Menü des Handys; ohne Teilen-Funktion wird das Bild heruntergeladen.
import { html, useState, I, deEn, datumLang, gw, gwE, einheit, tonnage, minutenText, nameVon } from './basis.js';

const MIT_SAETZEN = 'prh-abschluss-saetze';

/** Sätze in Reihenfolge, gleiche kg × Wdh hintereinander zusammengefasst: [{ kg, wdh, n }]. */
function folgeAus(saetze) {
  const f = [];
  for (const s of saetze) {
    const g = f.at(-1);
    if (g && g.kg === s.kg && g.wdh === s.wdh) g.n++; else f.push({ kg: s.kg ?? null, wdh: s.wdh ?? null, n: 1 });
  }
  return f;
}
const folgeText = (folge) => folge.map((g) => `${g.n > 1 ? `${g.n} × ` : ''}${g.kg != null ? gw(g.kg) : '–'} × ${g.wdh ?? '–'}`).join(' · ');

/** Zusammenfassung aus dem gerade beendeten Training (nur abgehakte Sätze). */
export function abschlussAus(t, ende = Date.now()) {
  const karten = t.karten.filter((k) => k.key && k.gruppen.some((g) => g.saetze.some((s) => s.erledigt)));
  const erledigt = (k) => k.gruppen.flatMap((g) => g.saetze.filter((s) => s.erledigt));
  const saetze = karten.flatMap(erledigt);
  return {
    titel: t.titel, datum: t.datum, minuten: Math.max(1, Math.round((ende - t.start) / 60000)),
    saetze: saetze.length, uebungen: karten.length, volumen: saetze.reduce((a, s) => a + (s.kg || 0) * (s.wdh || 0), 0),
    prs: karten.flatMap((k) => erledigt(k).filter((s) => s.pr).map((s) => ({ key: k.key, kg: s.kg, wdh: s.wdh, e1rm: s.e1rm }))),
    liste: karten.map((k) => ({ key: k.key, pr: erledigt(k).some((s) => s.pr), folge: folgeAus(erledigt(k)) })),
  };
}

export function Abschluss({ daten: a, zu }) {
  const [status, setStatus] = useState(null);
  const [mitSaetzen, setMitSaetzen] = useState(() => { try { return localStorage.getItem(MIT_SAETZEN) !== '0'; } catch { return true; } });
  const umschalten = () => { const neu = !mitSaetzen; setMitSaetzen(neu); try { localStorage.setItem(MIT_SAETZEN, neu ? '1' : '0'); } catch { /* egal */ } };
  const teilen = async () => {
    setStatus('…');
    try {
      const blob = await bildAus(a, mitSaetzen);
      const datei = new File([blob], `pr-hunter-${a.datum}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [datei] })) { await navigator.share({ files: [datei], title: 'PR Hunter' }); setStatus(null); return; }
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: datei.name });
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('Bild gespeichert');
    } catch (e) { setStatus(e?.name === 'AbortError' ? null : 'Teilen ging nicht – mach einfach einen Screenshot.'); }
  };
  return html`<div class="abschluss" role="dialog" aria-modal="true" aria-label="Training geschafft">
    <article class=${`abschluss-karte ${a.prs.length ? 'mit-pr' : ''}`}>
      <div class="ak-kopf"><span class="ak-logo">PR <b>Hunter</b></span><span class="muted">${datumLang(a.datum)}</span></div>
      <div><div class="eyebrow ak-geschafft">Training geschafft</div><h2 class="ak-titel">${a.titel}</h2></div>
      <div class="ak-zahlen">
        <div><span class="eyebrow">Dauer</span><b>${minutenText(a.minuten)}</b></div>
        <div><span class="eyebrow">Volumen</span><b>${tonnage(a.volumen)}</b></div>
        <div><span class="eyebrow">Sätze</span><b>${a.saetze}</b></div>
        <div><span class="eyebrow">Übungen</span><b>${a.uebungen}</b></div>
      </div>
      ${a.prs.length ? html`<div class="ak-prs"><span class="medaille">PR</span><div><b>${a.prs.length === 1 ? '1 neuer Rekord' : `${a.prs.length} neue Rekorde`}</b>
        <div class="ak-pr-liste">${a.prs.map((p, i) => html`<span key=${i}>${nameVon(p.key)} · ${gwE(p.kg)} × ${p.wdh}</span>`)}</div></div></div>` : null}
      <div class="row between"><span class="eyebrow">Training</span>
        <button class="chip ak-schalter" aria-pressed=${String(mitSaetzen)} onClick=${umschalten}>${mitSaetzen ? 'Sätze ausblenden' : 'Sätze zeigen'}</button></div>
      <ul class=${`ak-liste ${mitSaetzen ? 'mit-saetzen' : ''}`}>${a.liste.map((u, i) => html`<li key=${i}>
        <span class="ak-name">${nameVon(u.key)}${u.pr ? html` <span class="tag gold">PR</span>` : null}</span>
        ${mitSaetzen ? html`<span class="ak-saetze">${folgeText(u.folge)}</span>` : html`<span class="muted ak-anzahl">${u.folge.reduce((n, g) => n + g.n, 0)} ×</span>`}</li>`)}</ul>
    </article>
    ${status ? html`<p class="muted" style="margin:0;text-align:center">${status}</p>` : null}
    <div class="row ak-knoepfe"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Fertig</button>
      <button class="btn btn-chalk" style="flex:1.4" onClick=${teilen}>${I.teilen} Teilen</button></div>
  </div>`;
}

/** Dieselbe Karte als PNG (Hochformat 4:5, passt in Story und Chat). Farben aus dem aktuellen Design. */
async function bildAus(a, mitSaetzen) {
  const B = 1080, H = 1350, c = Object.assign(document.createElement('canvas'), { width: B, height: H });
  const x = c.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const farbe = (n, ersatz) => css.getPropertyValue(n).trim() || ersatz;
  const acc = farbe('--acc', '#D7263D'), ink = farbe('--ink', '#F4F2EE'), muted = farbe('--muted', '#9AA1AB'), gold = farbe('--gold', '#F2C14E');
  const schrift = farbe('--f', 'sans-serif');
  try { await document.fonts?.ready; } catch { /* egal */ }
  x.fillStyle = '#0B0B0F'; x.fillRect(0, 0, B, H);
  const glanz = x.createRadialGradient(B * 0.2, 0, 0, B * 0.2, 0, B * 1.1);
  glanz.addColorStop(0, acc); glanz.addColorStop(1, 'transparent');
  x.globalAlpha = 0.55; x.fillStyle = glanz; x.fillRect(0, 0, B, H); x.globalAlpha = 1;
  const text = (t, px, py, { groesse = 40, gewicht = 800, f = ink, align = 'left' } = {}) => {
    x.font = `${gewicht} ${groesse}px ${schrift}`; x.fillStyle = f; x.textAlign = align; x.fillText(t, px, py);
  };
  const kuerze = (t, breite) => { let s = t; while (x.measureText(s).width > breite && s.length > 4) s = s.slice(0, -2) + '…'; return s; };
  text('PR', 80, 120, { groesse: 50, gewicht: 900 }); x.font = `900 50px ${schrift}`;
  text('HUNTER', 80 + x.measureText('PR ').width, 120, { groesse: 50, gewicht: 900, f: acc });
  text(datumLang(a.datum), B - 80, 120, { groesse: 32, gewicht: 600, f: muted, align: 'right' });
  text(deEn('TRAINING GESCHAFFT', 'WORKOUT DONE'), 80, 215, { groesse: 32, gewicht: 800, f: acc });
  x.font = `900 66px ${schrift}`;
  text(kuerze(a.titel.toUpperCase(), B - 160), 80, 290, { groesse: 66, gewicht: 900 });
  const kacheln = [[deEn('DAUER', 'DURATION'), minutenText(a.minuten)], [deEn('VOLUMEN', 'VOLUME'), tonnage(a.volumen)], [deEn('SÄTZE', 'SETS'), String(a.saetze)], [deEn('ÜBUNGEN', 'EXERCISES'), String(a.uebungen)]];
  kacheln.forEach(([k, v], i) => {
    const kx = 80 + i * 235, ky = 340;
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.beginPath(); x.roundRect?.(kx, ky, 215, 150, 26); x.fill();
    text(k, kx + 24, ky + 50, { groesse: 24, gewicht: 700, f: muted });
    x.font = `900 50px ${schrift}`;
    text(kuerze(v, 175), kx + 24, ky + 118, { groesse: 50, gewicht: 900 });
  });
  let y = 570;
  if (a.prs.length) {
    text(`★ ${a.prs.length === 1 ? deEn('1 NEUER REKORD', '1 NEW PR') : `${a.prs.length} ${deEn('NEUE REKORDE', 'NEW PRS')}`}`, 80, y, { groesse: 40, gewicht: 900, f: gold });
    y += 70;
  }
  // Übungen: mit Sätzen zwei Zeilen je Übung, sonst eine; was nicht passt, als „+ n weitere“
  const zeile = mitSaetzen ? 96 : 62, platz = H - 130 - y, passt = Math.max(1, Math.floor(platz / zeile));
  const zeigen = a.liste.length > passt ? a.liste.slice(0, passt - 1) : a.liste;
  for (const u of zeigen) {
    x.font = `700 38px ${schrift}`;
    text(kuerze(nameVon(u.key), mitSaetzen ? B - 160 : 700), 80, y, { groesse: 38, gewicht: 700, f: u.pr ? gold : ink });
    if (mitSaetzen) {
      x.font = `600 32px ${schrift}`;
      text(kuerze(`${folgeText(u.folge)} ${einheit()}`, B - 160), 80, y + 42, { groesse: 32, gewicht: 600, f: u.pr ? gold : muted });
    } else {
      text(`${u.folge.reduce((n, g) => n + g.n, 0)} ${deEn('Sätze', 'sets')}`, B - 80, y, { groesse: 34, gewicht: 700, f: muted, align: 'right' });
    }
    y += zeile;
  }
  if (zeigen.length < a.liste.length) text(`+ ${a.liste.length - zeigen.length} ${deEn('weitere', 'more')}`, 80, y, { groesse: 32, gewicht: 700, f: muted });
  text('PR HUNTER', B / 2, H - 60, { groesse: 26, gewicht: 600, f: muted, align: 'center' });
  return new Promise((ok, fehler) => c.toBlob((b) => (b ? ok(b) : fehler(new Error('Bild ging nicht'))), 'image/png'));
}
