// PR Hunter · Abschlusskarte nach „Training beenden → Speichern“ (Wünsche 70, 97): Dauer, Volumen, Sätze, Übungen,
// Rekorde und das ganze Training – jede Übung mit ihren Sätzen (gleiche kg × Wdh hintereinander zusammengefasst).
// Sätze und Gewichte lassen sich ausblenden (gemerkt pro Gerät). „Teilen“ zeichnet dieselbe Karte als Bild (Canvas,
// 1080 × 1350) und gibt sie ans Teilen-Menü des Handys; ohne Teilen-Funktion wird das Bild heruntergeladen.
import { html, useState, I, deEn, fmt, datumLang, gw, gwE, einheit, tonnage, minutenText, nameVon } from './basis.js';

const MIT_SAETZEN = 'prh-abschluss-saetze';

// Bewegtes Gewicht als Turm aus 25-kg-Scheiben neben einem Menschen (Wunsch 104): eine liegende Scheibe ≈ 6,5 cm, ein
// Mensch 1,80 m. Beide im selben Maßstab – je mehr Volumen, desto höher der Turm und desto kleiner wirkt der Mensch.
const SCHEIBE_CM = 6.5, MENSCH_CM = 180;
export function stapelMasse(volumenKg, hoehePx) {
  const n = Math.max(1, Math.round(volumenKg / 25)), cm = n * SCHEIBE_CM;
  const skala = (hoehePx * 0.92) / Math.max(cm, MENSCH_CM);
  return { n, cm, turm: cm * skala, mensch: MENSCH_CM * skala, scheibe: SCHEIBE_CM * skala, menschen: cm / MENSCH_CM };
}
const stapelText = (m) => deEn(`${m.n} × 25-kg-Scheiben übereinander: ${fmt(m.cm / 100, 1)} m – ${m.menschen >= 1 ? `so hoch wie ${fmt(m.menschen, 1)} Menschen` : 'noch kleiner als ein Mensch'}`,
  `${m.n} × 25 kg plates stacked: ${fmt(m.cm / 100, 1)} m – ${m.menschen >= 1 ? `as tall as ${fmt(m.menschen, 1)} people` : 'still shorter than a person'}`);
const MENSCH = html`<circle cx="20" cy="9" r="8"/><path d="M7 22 Q20 16 33 22 L35 57 L29 57 L28 100 L21.5 100 L20 64 L18.5 100 L12 100 L11 57 L5 57 Z"/>`;

function Stapel({ volumen }) {
  const H = 170, m = stapelMasse(volumen, H);
  // Der Mensch startet so groß wie die Szene und schrumpft auf seinen Maßstab, während der Turm wächst
  const start = Math.min(4, (H * 0.92) / m.mensch);
  return html`<div class="ak-stapel">
    <div class="st-szene" style=${`height:${H}px`}>
      <div class="st-turm" style=${`height:${m.turm}px;--scheibe:${Math.max(1.2, m.scheibe).toFixed(2)}px`}></div>
      <svg class="st-mensch" viewBox="0 0 40 100" style=${`height:${m.mensch}px;--start:${start.toFixed(3)}`}>${MENSCH}</svg>
    </div>
    <p class="st-text">${stapelText(m)}</p>
  </div>`;
}

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
      <${Stapel} volumen=${a.volumen}/>
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
  // Turm aus 25-kg-Scheiben neben einem Menschen, rechts der Text
  const m = stapelMasse(a.volumen, 200), boden = 730;
  const sx = 110, sb = 70;
  const sch = Math.max(1.5, m.scheibe);
  for (let h = 0; h < m.turm; h += sch) {
    x.fillStyle = '#D7263D'; x.fillRect(sx, boden - Math.min(m.turm, h + sch), sb, Math.min(sch, m.turm - h) - (sch > 4 ? 1.5 : 0));
  }
  x.save(); x.translate(sx + sb + 24, boden - m.mensch); x.scale(m.mensch / 100, m.mensch / 100);
  x.fillStyle = ink; x.beginPath(); x.arc(20, 9, 8, 0, Math.PI * 2); x.fill();
  x.fill(new Path2D('M7 22 Q20 16 33 22 L35 57 L29 57 L28 100 L21.5 100 L20 64 L18.5 100 L12 100 L11 57 L5 57 Z')); x.restore();
  x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(80, boden, B - 160, 3);
  x.font = `700 30px ${schrift}`;
  const zeilen = stapelText(m).split(': ');
  text(zeilen[0], 330, 610, { groesse: 30, gewicht: 800 });
  text(zeilen[1] ?? '', 330, 655, { groesse: 30, gewicht: 600, f: muted });
  let y = 800;
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
