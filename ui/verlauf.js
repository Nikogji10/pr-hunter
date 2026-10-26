// PR Hunter · Verlauf – Monatskalender (erledigt, geplant, Urlaub), Tag antippen zeigt das Training.
import { html, useState, fmt, I, Sheet, LIFT, liftVon, nameVon, datumLang, datumKurz, monatName, satzKurz, rpeKlein, satzExtras, tonnage, inAnzeige, minutenText } from './basis.js';
import { HEUTE, URLAUB, DEMO, trainingAm, trainingsTage, imUrlaub } from './stand.js';

const liftNamen = (t) => [...new Set(t.uebungen.filter((u) => u.lift !== 'andere').map((u) => LIFT[u.lift].name))].join(' · ') || 'Zubehör';
import { TagPlan } from './programme.js';
import { UebungSuche } from './suche.js';

const iso = (j, m, t) => `${j}-${String(m + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;

export function Verlauf({ planTage, erledigt, startenAm, zuUebung, bearbeiten = null, loeschen = null }) {
  const [monat, setMonat] = useState(() => ({ j: Number(HEUTE.slice(0, 4)), m: Number(HEUTE.slice(5, 7)) - 1 }));
  const [tag, setTag] = useState(null);
  const geplant = Object.fromEntries(planTage.map((t) => [t.datum, t]));
  const erster = new Date(Date.UTC(monat.j, monat.m, 1)), tageImMonat = new Date(Date.UTC(monat.j, monat.m + 1, 0)).getUTCDate();
  const leer = (erster.getUTCDay() + 6) % 7;
  const blaettern = (d) => setMonat(({ j, m }) => { const n = m + d; return { j: j + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }; });
  const zellen = [];
  for (let i = 0; i < leer; i++) zellen.push(html`<span key=${`x${i}`}></span>`);
  for (let t = 1; t <= tageImMonat; t++) {
    const d = iso(monat.j, monat.m, t);
    const vorbei = trainingsTage[d] ?? (erledigt.has(d) ? { lifts: liftsVon(geplant[d]) } : null);
    const plan = !vorbei && d >= HEUTE ? geplant[d] : null;
    const urlaub = imUrlaub(d);
    const lifts = vorbei?.lifts ?? (plan ? liftsVon(plan) : []);
    const klickbar = vorbei || plan;
    zellen.push(html`<button key=${d} class=${`d ${vorbei ? 'trained' : ''} ${plan ? 'geplant' : ''} ${d === HEUTE ? 'today' : ''} ${urlaub ? 'urlaub' : ''}`}
      disabled=${!klickbar} onClick=${() => setTag(d)} aria-label=${`${datumLang(d)}${vorbei ? ', trainiert' : plan ? ', geplant' : urlaub ? ', Urlaub' : ''}`}>
      ${t}<span class="dots">${lifts.map((l) => html`<i key=${l} style=${`background:${LIFT[l].farbe}`}></i>`)}</span></button>`);
  }
  const monatsTage = Object.keys(trainingsTage).filter((d) => d.startsWith(iso(monat.j, monat.m, 1).slice(0, 7)));
  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Trainings und Plan</div><h1 class="h1">Verlauf</h1></div>${DEMO ? html`<span class="proto">Beispieldaten</span>` : null}</header>
    <section class="card pad stack">
      <span class="viz-t">Übung ansehen</span>
      <${UebungSuche} id="verlauf-suche" platzhalter="Übung suchen, z. B. Kniebeuge" onWahl=${zuUebung}/>
    </section>
    <section class="card pad stack">
      <div class="monat">
        <button class="iconbtn" onClick=${() => blaettern(-1)} aria-label="Voriger Monat">${I.zurueck}</button>
        <div style="text-align:center"><div class="h2">${monatName(monat.j, monat.m)}</div>
          <div class="muted" style="font-size:12.5px">${monatsTage.length} Trainings${Object.keys(geplant).filter((d) => d.startsWith(iso(monat.j, monat.m, 1).slice(0, 7)) && d >= HEUTE).length ? ` · ${Object.keys(geplant).filter((d) => d.startsWith(iso(monat.j, monat.m, 1).slice(0, 7)) && d >= HEUTE).length} geplant` : ''}</div></div>
        <button class="iconbtn" onClick=${() => blaettern(1)} aria-label="Nächster Monat" style="transform:scaleX(-1)">${I.zurueck}</button>
      </div>
      <div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((h) => html`<span key=${h} class="h">${h}</span>`)}${zellen}</div>
      <div class="legend-row">${['squat', 'bench', 'dead'].map((l) => html`<span key=${l}><i class="dot" style=${`background:${LIFT[l].farbe}`}></i>${LIFT[l].name}</span>`)}
        <span><i class="dot" style="box-shadow:inset 0 0 0 1.5px var(--line)"></i>geplant</span>${URLAUB ? html`<span><i class="dot" style="background:repeating-linear-gradient(135deg,var(--line) 0 2px,transparent 2px 4px)"></i>${URLAUB.name}</span>` : null}</div>
    </section>
    <section class="card pad">
      <div class="row between" style="margin-bottom:4px"><span class="eyebrow">Letzte Trainings</span><span class="muted" style="font-size:13px">antippen für Details</span></div>
      <div class="liste">${Object.keys(trainingsTage).sort().reverse().slice(0, 5).map((d) => {
        const t = trainingAm(d);
        return html`<button key=${d} onClick=${() => setTag(d)}>
          <div class="datum-box"><b>${d.slice(8, 10)}</b><span>${datumLang(d).slice(0, 2)}</span></div>
          <div style="min-width:0"><div style="font-weight:700">${liftNamen(t)}</div>
            <div class="muted" style="font-size:13px">${t.uebungen.length} Übungen · ${tonnage(t.tonnage)}${t.sessionRpe != null ? ` · RPE ${fmt(t.sessionRpe)}` : ''}</div></div>
          <span class="muted" style="font-size:13px">${t.dauer ? minutenText(t.dauer) : datumKurz(d)}</span></button>`;
      })}${Object.keys(trainingsTage).length ? null : html`<p class="muted" style="margin:0;font-size:14px">Noch keine Trainings gespeichert.</p>`}</div>
    </section>
    ${tag ? html`<${TagSheet} d=${tag} plan=${geplant[tag]} erledigt=${erledigt.has(tag)} zu=${() => setTag(null)} startenAm=${startenAm}
      bearbeiten=${bearbeiten} loeschen=${loeschen} zuUebung=${zuUebung}/>` : null}
  </div>`;
}

const liftsVon = (planTag) => !planTag ? [] : [...new Set(planTag.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))];

/** Ein Tag: gespeichertes Training (Bearbeiten, Löschen) oder Plan (Starten, Vorziehen). Auch von „Heute“ aus geöffnet. */
export function TagSheet({ d, plan, erledigt, zu, startenAm, bearbeiten, loeschen, zuUebung = null }) {
  const t = trainingAm(d);
  const [frage, setFrage] = useState(null);              // id der Einheit, deren Löschen bestätigt werden soll
  const mehrere = (t?.einheiten.length ?? 0) > 1;
  return html`<${Sheet} zu=${zu} label="Training am Tag">
    <div><div class="eyebrow">${t ? 'Training' : erledigt ? 'Erledigt' : 'Geplant'}${plan ? ` · Woche ${plan.woche}` : ''}</div><h2 class="h2">${datumLang(d)}</h2></div>
    ${t ? html`
      <div class="kv"><div><span class="eyebrow">Dauer</span><b>${t.dauer ? minutenText(t.dauer) : '–'}</b></div><div><span class="eyebrow">Volumen</span><b>${tonnage(t.tonnage)}</b></div>
        <div><span class="eyebrow">Session-RPE</span><b>${t.sessionRpe != null ? fmt(t.sessionRpe) : '–'}</b></div></div>
      ${t.uebungen.map((u, k) => html`<div key=${`${u.key}-${k}`} class="stack" style="gap:8px">
        <div class="row"><span class="badge" style=${u.lift === 'andere' ? 'background:var(--raised);color:var(--ink);width:30px;height:30px;font-size:12px' : `background:${LIFT[u.lift].farbe};color:#0B0C0E;width:30px;height:30px;font-size:12px`}>${LIFT[u.lift].kurz}</span>
          ${zuUebung ? html`<button class="link-zeile" onClick=${() => { zu(); zuUebung(u.key); }}><b>${nameVon(u.key)}</b>${I.weiter}</button>` : html`<b>${nameVon(u.key)}</b>`}</div>
        <${SatzTabelle} u=${u}/>
        ${u.saetze.some((s) => satzExtras(s, { mitTyp: true }).length) ? html`<div class="muted" style="font-size:12.5px">${u.saetze.map((s, i) => [i, satzExtras(s, { mitTyp: true })])
          .filter(([, x]) => x.length).map(([i, x]) => `Satz ${i + 1}: ${x.join(', ')}`).join(' · ')}</div>` : null}
        ${u.notiz ? html`<div class="cue notiz">${u.notiz}</div>` : null}</div>`)}
      ${t.notizen?.length ? html`<div class="notizen">${t.notizen.map((n, i) => html`<p key=${i}><b>Notiz</b> ${n}</p>`)}</div>` : null}
      ${bearbeiten && !frage ? t.einheiten.map((id, i) => html`<div key=${id} class="row">
        <button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => { zu(); bearbeiten(id); }}>${mehrere ? `Einheit ${i + 1} bearbeiten` : 'Bearbeiten'}</button>
        <button class="btn btn-gefahr btn-sm" onClick=${() => setFrage(id)}>Löschen</button></div>`) : null}
      ${frage ? html`<div class="hint" role="alertdialog" aria-label="Löschen bestätigen">${I.warn}<span class="t">${mehrere ? `Einheit ${t.einheiten.indexOf(frage) + 1}` : 'Training'} löschen?</span><span></span>
        <p>Es verschwindet hier und beim nächsten Abgleich auch auf dem Server. Das nächtliche Backup behält den alten Stand.</p><span></span>
        <div class="row" style="margin-top:6px"><button class="btn btn-soft btn-sm" onClick=${() => setFrage(null)}>Abbrechen</button>
          <button class="btn btn-gefahr btn-sm" onClick=${() => { zu(); loeschen(frage); }}>Löschen</button></div></div>` : null}`
    : plan ? html`<${TagPlan} tag=${plan}/>
      ${d >= HEUTE && !erledigt && !plan.uebersprungen && startenAm ? html`<button class="btn btn-go btn-block" onClick=${() => { zu(); startenAm(d); }}>${d === HEUTE ? 'Training starten' : 'Vorziehen und starten'}</button>` : null}`
    : html`<p class="muted" style="margin:0">An diesem Tag war kein Training.</p>`}
  <//>`;
}

/** Sätze einer Übung als Tabelle wie die Jefit-History: Aufwärmsätze als W, bester Satz (e1RM) hervorgehoben. */
export function SatzTabelle({ u }) {
  const alle = [...(u.aufwaermen ?? []).map((s) => [s, 'W']), ...u.saetze.map((s, i) => [s, i + 1])];
  const mitRpe = alle.some(([s]) => s.rpe != null);
  const beste = u.saetze.reduce((m, s, j) => (s.e1rm != null && (m < 0 || s.e1rm > u.saetze[m].e1rm) ? j : m), -1);
  return html`<table class="saetze"><thead><tr><th>Satz</th><th>Gewicht × Wdh</th>${mitRpe ? html`<th>RPE</th>` : null}<th>e1RM</th></tr></thead>
    <tbody>${alle.map(([s, nr], i) => html`<tr key=${i} class=${nr !== 'W' && nr - 1 === beste ? 'beste' : ''}>
      <td class=${`satz-nr ${nr === 'W' ? 'w' : ''}`}>${nr}</td><td class="k">${satzKurz(s).replace('×', ' × ')}</td>
      ${mitRpe ? html`<td class="muted">${s.rpe != null ? `@${fmt(s.rpe)}` : ''}</td>` : null}<td>${s.e1rm != null ? fmt(inAnzeige(s.e1rm), 0) : '–'}</td></tr>`)}</tbody></table>`;
}
