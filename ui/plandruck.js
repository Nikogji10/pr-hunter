// PR Hunter · Plan als PDF (Wunsch 217): schön gesetztes Druckbild (A4) – Titelblock, je Woche eine Seite mit den Tagen als
// Karten (Übung, Sätze × Wdh, Gewicht bzw. RPE, Notizen), Farbcode der Hauptlifts. Gedruckt über ein unsichtbares Fenster;
// „Als PDF speichern“ im Druckdialog des Handys/Browsers erzeugt die Datei.
import { nameVon, liftVon, LIFT, datumKurz, datumLang, deEn } from './basis.js';
import { zeile } from './plan.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// feste Farben (helles Thema): die CSS-Variablen der App gibt es im Druckfenster nicht
const DRUCKFARBE = { squat: '#D95926', bench: '#3987E5', dead: '#199E70', andere: '#9AA0A6' };

export function planDruckHtml({ titel, untertitel = '', tage, quelle = '' }) {
  const wochen = [...new Set(tage.map((t) => t.woche))];
  const farbe = (key) => { const l = liftVon(key); return DRUCKFARBE[l] ?? DRUCKFARBE.andere; };
  const seiten = wochen.map((w) => {
    const tw = tage.filter((t) => t.woche === w), wt = tw[0]?.wochenTitel ?? `${deEn('Woche', 'Week')} ${w}`;
    return `<section class="woche"><header class="wkopf"><span class="wnr">${deEn('Woche', 'Week')} ${w}</span><h2>${esc(wt)}</h2></header>
      <div class="tage">${tw.map((t) => `<article class="tag"><div class="tkopf"><b>${t.datum ? esc(datumLang(t.datum).split(',')[0]) : esc(t.label ?? '')}</b><span>${t.datum ? esc(datumKurz(t.datum)) : ''}</span></div>
        <table>${t.uebungen.filter((u) => u.gruppen.length).map((u) => u.gruppen.map((g, j) => { const [sw, last] = zeile(u, g);
          return `<tr><td class="ue">${j === 0 ? `<i style="background:${farbe(u.key)}"></i>${esc(u.key ? nameVon(u.key, u.name) : u.slot?.label ?? u.name)}` : ''}</td><td class="sw">${esc(sw)}</td><td class="kg">${esc(last)}</td></tr>`; }).join('')).join('')}</table>
        ${t.notizen?.length ? `<p class="notiz">${t.notizen.map(esc).join(' · ')}</p>` : ''}</article>`).join('')}</div></section>`;
  }).join('');
  return `<!DOCTYPE html><html lang="${document.documentElement.lang || 'de'}"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font: 10.5pt/1.35 "Archivo", "Helvetica Neue", Arial, sans-serif; color: #15171a; }
    .deckblatt { display: flex; justify-content: space-between; align-items: flex-end; padding: 0 0 10px; margin-bottom: 14px; border-bottom: 3px solid #E0182D; }
    .marke { font: 900 13pt/1 "Archivo", Arial, sans-serif; letter-spacing: .04em; } .marke b { color: #E0182D; }
    h1 { margin: 6px 0 2px; font: 900 24pt/1.05 "Archivo", Arial, sans-serif; text-transform: uppercase; letter-spacing: -.01em; }
    .unter { color: #5f6368; font-size: 10pt; }
    .legende { display: flex; gap: 10px; font-size: 8.5pt; color: #5f6368; } .legende i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .woche { break-inside: avoid-page; margin-bottom: 14px; } .woche + .woche { break-before: page; }
    .wkopf { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
    .wnr { background: #15171a; color: #fff; font-weight: 800; font-size: 8.5pt; padding: 3px 8px; border-radius: 99px; letter-spacing: .06em; text-transform: uppercase; }
    h2 { margin: 0; font: 800 14pt/1.1 "Archivo", Arial, sans-serif; }
    .tage { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media screen and (max-width: 640px) { .tage { grid-template-columns: 1fr; } }
    .tag { break-inside: avoid; border: 1px solid #dadce0; border-radius: 10px; padding: 8px 10px; background: #fafafa; }
    .tkopf { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e8eaed; padding-bottom: 4px; margin-bottom: 4px; }
    .tkopf b { font-size: 11pt; } .tkopf span { color: #5f6368; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; } td { padding: 2.5px 0; vertical-align: top; }
    td.ue { font-weight: 700; width: 52%; } td.ue i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
    td.sw { color: #3c4043; white-space: nowrap; } td.kg { text-align: right; font-weight: 800; white-space: nowrap; }
    tr + tr td { border-top: 1px dotted #e8eaed; }
    .notiz { margin: 4px 0 0; font-size: 8.5pt; color: #5f6368; }
    .fuss { margin-top: 10px; font-size: 8pt; color: #9aa0a6; text-align: center; }
  </style></head><body>
    <div class="deckblatt"><div><div class="marke">PR <b>HUNTER</b></div><h1>${esc(titel)}</h1><div class="unter">${esc(untertitel)}</div></div>
      <div class="legende">${['squat', 'bench', 'dead'].map((l) => `<span><i style="background:${DRUCKFARBE[l]}"></i>${esc(deEn(LIFT[l].name, { squat: 'Squat', bench: 'Bench', dead: 'Deadlift' }[l]))}</span>`).join('')}</div></div>
    ${seiten}
    <div class="fuss">${esc(quelle)}${quelle ? ' · ' : ''}${deEn('Erstellt mit PR Hunter', 'Made with PR Hunter')} · ${esc(datumKurz(new Date().toISOString().slice(0, 10)))}</div>
  </body></html>`;
}

/** Druckt über ein unsichtbares Fenster (Dialog → „Als PDF speichern“). */
export function planDrucken(daten) {
  const f = document.createElement('iframe');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  f.setAttribute('aria-hidden', 'true');
  document.body.append(f);
  f.srcdoc = planDruckHtml(daten);
  f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* Druck gesperrt */ } setTimeout(() => f.remove(), 60000); }, 250); };
}
