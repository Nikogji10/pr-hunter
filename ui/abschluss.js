// PR Hunter · Abschlusskarte nach „Training beenden → Speichern“ (Wunsch 70): Dauer, Volumen, Sätze, Übungen, Rekorde
// und je Übung der beste Satz – schön genug für einen Screenshot. „Teilen“ zeichnet dieselbe Karte als Bild (Canvas,
// 1080 × 1350) und gibt sie ans Teilen-Menü des Handys; ohne Teilen-Funktion wird das Bild heruntergeladen.
import { html, useState, I, deEn, datumLang, gw, gwE, einheit, tonnage, minutenText, nameVon } from './basis.js';

/** Zusammenfassung aus dem gerade beendeten Training (nur abgehakte Sätze). */
export function abschlussAus(t, ende = Date.now()) {
  const karten = t.karten.filter((k) => k.key && k.gruppen.some((g) => g.saetze.some((s) => s.erledigt)));
  const erledigt = (k) => k.gruppen.flatMap((g) => g.saetze.filter((s) => s.erledigt));
  const saetze = karten.flatMap(erledigt);
  const besterSatz = (ss) => ss.reduce((m, s) => (!m || (s.e1rm ?? 0) > (m.e1rm ?? 0) || (s.e1rm == null && (s.kg ?? 0) > (m.kg ?? 0)) ? s : m), null);
  return {
    titel: t.titel, datum: t.datum, minuten: Math.max(1, Math.round((ende - t.start) / 60000)),
    saetze: saetze.length, uebungen: karten.length, volumen: saetze.reduce((a, s) => a + (s.kg || 0) * (s.wdh || 0), 0),
    prs: karten.flatMap((k) => erledigt(k).filter((s) => s.pr).map((s) => ({ key: k.key, kg: s.kg, wdh: s.wdh, e1rm: s.e1rm }))),
    besten: karten.map((k) => { const b = besterSatz(erledigt(k)); return { key: k.key, kg: b?.kg ?? null, wdh: b?.wdh ?? null, pr: erledigt(k).some((s) => s.pr) }; }),
  };
}

const satzText = (kg, wdh) => `${kg != null ? gw(kg) : '–'} × ${wdh ?? '–'}`;

export function Abschluss({ daten: a, zu }) {
  const [status, setStatus] = useState(null);
  const teilen = async () => {
    setStatus('…');
    try {
      const blob = await bildAus(a);
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
      <ul class="ak-liste">${a.besten.slice(0, 6).map((b, i) => html`<li key=${i}><span>${nameVon(b.key)}</span><b>${satzText(b.kg, b.wdh)}</b>${b.pr ? html`<span class="tag gold">PR</span>` : html`<span></span>`}</li>`)}</ul>
    </article>
    ${status ? html`<p class="muted" style="margin:0;text-align:center">${status}</p>` : null}
    <div class="row ak-knoepfe"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Fertig</button>
      <button class="btn btn-chalk" style="flex:1.4" onClick=${teilen}>${I.teilen ?? null} Teilen</button></div>
  </div>`;
}

/** Dieselbe Karte als PNG (Hochformat 4:5, passt in Story und Chat). Farben aus dem aktuellen Design. */
async function bildAus(a) {
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
  text('PR', 80, 130, { groesse: 52, gewicht: 900 }); x.font = `900 52px ${schrift}`;
  text('HUNTER', 80 + x.measureText('PR ').width, 130, { groesse: 52, gewicht: 900, f: acc });
  text(datumLang(a.datum), B - 80, 130, { groesse: 34, gewicht: 600, f: muted, align: 'right' });
  text(deEn('TRAINING GESCHAFFT', 'WORKOUT DONE'), 80, 250, { groesse: 34, gewicht: 800, f: acc });
  text(a.titel.toUpperCase(), 80, 330, { groesse: 72, gewicht: 900 });
  const kacheln = [[deEn('DAUER', 'DURATION'), minutenText(a.minuten)], [deEn('VOLUMEN', 'VOLUME'), tonnage(a.volumen)], [deEn('SÄTZE', 'SETS'), String(a.saetze)], [deEn('ÜBUNGEN', 'EXERCISES'), String(a.uebungen)]];
  kacheln.forEach(([k, v], i) => {
    const kx = 80 + (i % 2) * 470, ky = 400 + Math.floor(i / 2) * 190;
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.beginPath(); x.roundRect?.(kx, ky, 450, 170, 28); x.fill();
    text(k, kx + 34, ky + 60, { groesse: 28, gewicht: 700, f: muted });
    text(v, kx + 34, ky + 135, { groesse: 64, gewicht: 900 });
  });
  let y = 830;
  if (a.prs.length) {
    text(`★ ${a.prs.length === 1 ? deEn('1 NEUER REKORD', '1 NEW PR') : `${a.prs.length} ${deEn('NEUE REKORDE', 'NEW PRS')}`}`, 80, y, { groesse: 44, gewicht: 900, f: gold });
    y += 60;
  }
  for (const b of a.besten.slice(0, a.prs.length ? 5 : 6)) {
    x.font = `600 38px ${schrift}`;
    let name = nameVon(b.key); while (x.measureText(name).width > 640 && name.length > 4) name = name.slice(0, -2) + '…';
    text(name, 80, y, { groesse: 38, gewicht: 600, f: b.pr ? gold : ink });
    text(`${satzText(b.kg, b.wdh)} ${einheit()}`, B - 80, y, { groesse: 38, gewicht: 800, f: b.pr ? gold : ink, align: 'right' });
    y += 64;
  }
  text('PR HUNTER', B / 2, H - 60, { groesse: 26, gewicht: 600, f: muted, align: 'center' });
  return new Promise((ok, fehler) => c.toBlob((b) => (b ? ok(b) : fehler(new Error('Bild ging nicht'))), 'image/png'));
}
