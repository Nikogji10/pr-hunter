// PR Hunter · Geschlecht und Zyklus (Wunsch 220). Geschlecht fragt „Heute“ einmal ab (bekannte Namen werden automatisch
// gesetzt), änderbar in Einstellungen → Konto. Zyklus nur bei Frauen: Periodenbeginne eintragen, Phase und Zyklustag,
// Leistung je Phase. Daten bleiben privat (App-Einstellungen des Kontos), nichts davon ist für Freunde sichtbar.
import { html, useState, deEn, datumKurz, sprache, fmt } from './basis.js';
import { HEUTE } from './stand.js';
import { PHASEN, phaseAm, zyklusLaenge, leistungJePhase } from '../js/zyklus.js';
import { normiere } from '../js/insights.js';

const BEKANNT = [['nozomi', 'w'], ['antonia', 'w'], ['liridon', 'm'], ['darius', 'm'], ['niko', 'm']];
/** Geschlecht aus Vor- oder Anzeigename, falls bekannt (sonst null → fragen). */
export const geschlechtAusName = (...namen) => { const n = namen.filter(Boolean).join(' ').toLowerCase(); return BEKANNT.find(([k]) => n.includes(k))?.[1] ?? null; };
export const zyklusAktiv = (einst) => einst.geschlecht === 'w' && einst.zyklusAn !== false;
const phaseName = (id) => { const p = PHASEN.find(([k]) => k === id); return p ? `${p[3]} ${sprache() === 'en' ? p[2] : p[1]}` : id; };

export function GeschlechtKarte({ setzen }) {
  return html`<section class="card pad stack vorname-karte">
    <b>${deEn('Kurze Frage', 'Quick question')}</b>
    <span class="muted" style="font-size:13px">${deEn('Damit die App passende Funktionen zeigt (z. B. Zyklus-Tracking). Später in Einstellungen → Konto änderbar.', 'So the app can show fitting features (e.g. cycle tracking). Changeable later in Settings → Account.')}</span>
    <div class="seg">${[['w', deEn('Frau', 'Woman')], ['m', deEn('Mann', 'Man')], ['x', deEn('Keine Angabe', 'Prefer not to say')]].map(([k, n]) => html`<button key=${k} onClick=${() => setzen(k)}>${n}</button>`)}</div>
  </section>`;
}

/** Kleiner Hinweis auf „Heute“: Zyklustag und Phase. */
export function ZyklusChip({ einst }) {
  const p = zyklusAktiv(einst) ? phaseAm(HEUTE, einst.zyklus?.starts ?? []) : null;
  return p ? html`<div class="zyklus-chip">${`${deEn('Zyklustag', 'Cycle day')} ${p.tag} · ${phaseName(p.phase)}`}</div>` : null;
}

/** Statistik → Körper: Periodenbeginn eintragen, Stand, Leistung je Phase. */
export function ZyklusKarte({ einst, setEinst, trainings }) {
  const [datum, setDatum] = useState(HEUTE);
  if (!zyklusAktiv(einst) || !setEinst) return null;
  const starts = [...(einst.zyklus?.starts ?? [])].sort();
  const p = phaseAm(HEUTE, starts), laenge = zyklusLaenge(starts);
  const l = starts.length ? leistungJePhase(normiere(trainings), starts) : {};
  const setStarts = (s) => setEinst({ ...einst, zyklus: { ...(einst.zyklus ?? {}), starts: [...new Set(s)].sort().slice(-24) } });
  return html`<section class="card pad stack zyklus-karte">
    <div class="row between"><div><span class="viz-t">${deEn('Zyklus', 'Cycle')}</span><div class="viz-u">${deEn('Privat – nur für dich sichtbar', 'Private – only visible to you')}</div></div>
      ${p ? html`<div class="zyklus-stand"><b>${`${deEn('Tag', 'Day')} ${p.tag}`}</b><span>${phaseName(p.phase)}</span></div>` : null}</div>
    ${p ? html`<div class="zyklus-balken" aria-hidden="true">${Array.from({ length: p.laenge }, (_, i) => { const ph = phaseAm(new Date(Date.parse(`${starts.at(-1)}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10), starts)?.phase;
      return html`<i key=${i} class=${`zp-${ph} ${i + 1 === p.tag ? 'heute' : ''}`}></i>`; })}</div>
      <span class="muted" style="font-size:12.5px">${deEn(`Ø ${laenge} Tage · nächste Periode etwa ${datumKurz(p.naechste)}`, `Avg ${laenge} days · next period around ${datumKurz(p.naechste)}`)}</span>` : html`<span class="muted" style="font-size:13px">${deEn('Trag den ersten Tag deiner letzten Periode ein – dann zeigt die App Zyklustag, Phase und wie deine Leistung je Phase aussieht.', 'Enter the first day of your last period – the app then shows cycle day, phase and your performance per phase.')}</span>`}
    <div class="row" style="gap:8px;align-items:flex-end"><label class="field" style="flex:1" for="zyklus-datum"><span class="label">${deEn('Periode begonnen am', 'Period started on')}</span>
      <input id="zyklus-datum" class="text" type="date" max=${HEUTE} value=${datum} onInput=${(e) => setDatum(e.currentTarget.value)}/></label>
      <button class="btn btn-chalk btn-sm" style="height:46px" disabled=${!datum || starts.includes(datum)} onClick=${() => setStarts([...starts, datum])}>${deEn('Eintragen', 'Add')}</button></div>
    ${starts.length ? html`<div class="chips-zeile" style="flex-wrap:wrap">${starts.slice(-6).reverse().map((s) => html`<button key=${s} class="chip" onClick=${() => setStarts(starts.filter((x) => x !== s))} aria-label=${deEn(`${s} entfernen`, `Remove ${s}`)}>${`${datumKurz(s)} ✕`}</button>`)}</div>` : null}
    ${Object.keys(l).length >= 2 ? html`<div class="stack" style="gap:6px"><span class="eyebrow">${deEn('Leistung je Phase', 'Performance per phase')}</span>
      ${PHASEN.filter(([k]) => l[k]).map(([k]) => { const w = (l[k].wert - 1) * 100; return html`<div key=${k} class="zyklus-zeile"><span>${phaseName(k)}</span>
        <b class=${w >= 0 ? 'auf' : 'ab'}>${`${w >= 0 ? '+' : ''}${fmt(w, 1)} %`}</b><small class="muted">${`${l[k].n}×`}</small></div>`; })}
      <span class="muted" style="font-size:12px">${deEn('Bestes e1RM des Tages im Vergleich zum Bestwert der 90 Tage davor – je mehr Trainings, desto aussagekräftiger.', 'Best e1RM of the day compared with the best of the 90 days before – the more workouts, the more meaningful.')}</span></div>` : null}
  </section>`;
}
