// PR Hunter · Zusammen trainieren (Wunsch 194). Wer trainiert, meldet den Stand (training_aktiv.stand, Update 30) knapp:
// [{ k: Übung, s: [[kg, wdh, erledigt 0/1], …] }]. Ein Freund tritt mit „Mitmachen“ bei (gleiche Übungen und Satzzahl,
// Gewichte aus der eigenen Form, training.mit = Partner). Beide sehen oben im Training die Partner-Leiste.
import { html, useState, Avatar, nameVon, gwE, deEn } from './basis.js';

/** Laufendes Training → knapper Stand für den Server. */
export function standVon(t) {
  return t.karten.filter((k) => k.key).map((k) => ({ k: k.key, s: k.gruppen.flatMap((g) => g.saetze).filter((s) => s.typ !== 'warmup')
    .map((s) => [s.kg ?? null, s.wdh ?? null, s.erledigt ? 1 : 0]) }));
}

/** Leiste oben im Training: wo der Partner gerade steht. */
export function PartnerLeiste({ p }) {
  const [auf, setAuf] = useState(false);
  const stand = p.stand ?? [];
  const alle = stand.flatMap((u) => u.s.map((s) => ({ key: u.k, s })));
  const fertig = alle.filter((x) => x.s[2]).length, gesamt = alle.length;
  const jetzt = stand.find((u) => u.s.some((s) => !s[2])) ?? stand.at(-1);
  const letzter = [...alle].reverse().find((x) => x.s[2]);
  const satzNr = jetzt ? Math.min(jetzt.s.length, jetzt.s.filter((s) => s[2]).length + 1) : 0;
  return html`<section class="card partner-leiste" onClick=${() => setAuf(!auf)} role="button" aria-expanded=${String(auf)}>
    <div class="pl-kopf"><span class="aktiv-avatar"><${Avatar} bild=${p.avatar} name=${p.name} groesse=${36}/><i></i></span>
      <div class="pl-text"><b>${p.name}</b>
        <small>${!jetzt ? deEn('startet gerade', 'just starting') : fertig >= gesamt ? deEn('fertig 💪', 'done 💪') : `${nameVon(jetzt.k)} · ${deEn('Satz', 'set')} ${satzNr}/${jetzt.s.length}`}</small>
        ${letzter ? html`<small class="muted">${`${deEn('zuletzt', 'last')} ${letzter.s[0] != null ? gwE(letzter.s[0]) : '–'} × ${letzter.s[1] ?? '–'} ✓`}</small>` : null}</div>
      <span class="pl-zahl">${`${fertig}/${gesamt}`}</span></div>
    <div class="pl-balken"><i style=${`width:${gesamt ? Math.round((fertig / gesamt) * 100) : 0}%`}></i></div>
    ${auf ? html`<ul class="pl-liste">${stand.map((u, i) => html`<li key=${i}><span>${nameVon(u.k)}</span>
      <span class="pl-saetze">${u.s.map((s, j) => html`<i key=${j} class=${s[2] ? 'ok' : ''}>${s[1] ?? '–'}</i>`)}</span></li>`)}</ul>` : null}
  </section>`;
}
