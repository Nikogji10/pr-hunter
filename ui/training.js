// PR Hunter · Training (läuft im Hintergrund weiter), Satz-Sheets, Übung tauschen.
// Oben stehen immer Trainingszeit und Pause bis zum nächsten Satz.
import { html, useState, fmt, mmss, LIFT, liftVon, nameVon, pauseVon, stangeVon, incVon, uebung, koerperUebung, rollenText, rpeText,
  I, Sheet, Scheiben, Hantel, useTakt, PausenTimer, gw, gwE, einheit, inKg, inAnzeige, anpassung, stangeKg, scheibenKg, satzExtras, formel, tonnage as tonnageText } from './basis.js';
import { UebungsBild } from './basis.js';
import { e1rm, lastFuer, mround, rtsPct, aufwaermen, e1rmKoerper, zusatzFuer } from '../js/rechnen.js';
import { UebungSuche } from './suche.js';
import { BEST_E1RM, E1RM_AKTUELL, LETZTES } from './stand.js';

const e1rmFuer = (key) => E1RM_AKTUELL[key] ?? BEST_E1RM[key] ?? null;   // aktuelle Form, sonst Bestwert
const wdhText = (w) => !w ? '1' : w.amrap ? (w.ziel ? `max (Ziel ${w.ziel})` : 'max') : w.text ? w.text : w.plus ? `${w.min}+` : w.min !== w.max ? `${w.min}–${w.max}` : String(w.min);

/** Vorschlag aus e1RM und Ziel-RPE; bei Körpergewichtsübungen das Zusatzgewicht. */
function vorschlag(key, wdh, rpe, koerperKg) {
  const basis = e1rmFuer(key);
  if (!basis || !rpe) return null;
  return koerperUebung(key) ? zusatzFuer(basis, wdh, rpe, koerperKg) : lastFuer(basis, wdh, rpe, incVon(key));
}

/** e1RM eines Satzes; bei Körpergewichtsübungen über die Gesamtlast. */
export function satzE1rm(key, s, koerperKg) {
  if (!(s.wdh > 0)) return null;
  if (s.typ === 'warmup') return null;                   // Aufwärmsätze zählen nicht fürs e1RM
  return koerperUebung(key) ? e1rmKoerper(s.kg ?? 0, s.wdh, s.rpe, koerperKg, formel())?.gesamt ?? null : e1rm(s.kg, s.wdh, s.rpe, formel());
}

/** Trainingstag aus planeBlock in Karten mit Sätzen; gleiche Übung hintereinander = eine Karte (Top-Satz + Back-offs). */
export function baueTraining(tag, { leichter = false, koerperKg = 88 } = {}) {
  const karten = [];
  for (const u of tag.uebungen) {
    if (!u.gruppen.length) continue;                  // optionale Übung ohne Vorgabe (Candito-Kniebeugetage)
    const letzte = karten.at(-1);
    const gleich = letzte && u.key && letzte.key === u.key;
    const karte = gleich ? letzte : { id: karten.length, key: u.key, slot: !u.key && u.slot ? u.slot : null, gruppen: [] };
    if (!gleich) karten.push(karte);
    for (const g of u.gruppen) {
      const n = g.saetze?.min ?? 1;                 // Bereich „5-10“: mit 5 starten, weitere per „+ Satz“
      const wdh = g.wdh?.min ?? g.wdh?.ziel ?? 1;
      let kg = g.kg != null ? (leichter ? mround(g.kg * 0.95) : g.kg) : null;
      const kgBis = g.kgBis != null ? (leichter ? mround(g.kgBis * 0.95) : g.kgBis) : null;
      let ausE1rm = false;
      if (kg == null && u.key) { kg = vorschlag(u.key, wdh, g.rpe?.max, koerperKg); ausE1rm = kg != null; }
      karte.gruppen.push({
        rolle: g.rolle ?? u.rolle, wdhText: wdhText(g.wdh), rpe: g.rpe, notiz: g.notiz, vorschlag: ausE1rm, saetzeText: g.saetze?.text ?? null,
        gekuerzt: g.gekuerzt, kgBis,
        saetze: Array.from({ length: n }, () => ({ kg, kgPlan: kg, wdh, rpe: null, erledigt: false, e1rm: null, pr: false, geaendert: false })),
      });
    }
  }
  return karten;
}

export const alleSaetze = (t) => t.karten.flatMap((k) => k.gruppen.flatMap((g) => g.saetze));

/** Übung außerhalb des Plans: 3 × 8, Gewicht aus der aktuellen Form für RPE 8 (ohne e1RM leer). */
function neueKarte(key, karten, koerperKg) {
  const kg = vorschlag(key, 8, 8, koerperKg);
  return { id: Math.max(-1, ...karten.map((k) => k.id)) + 1, key, slot: null, gruppen: [{
    rolle: null, wdhText: '8', rpe: null, notiz: null, vorschlag: kg != null, saetzeText: null,
    saetze: Array.from({ length: 3 }, () => ({ kg, wdh: 8, rpe: null, erledigt: false, e1rm: null, pr: false, geaendert: false })),
  }] };
}

function setzeUebung(karte, key, koerperKg) {
  karte.key = key; karte.slot = null;
  for (const g of karte.gruppen) {
    const kg = vorschlag(key, g.saetze[0].wdh, g.rpe?.max ?? 8, koerperKg);
    g.vorschlag = kg != null;
    for (const s of g.saetze) if (!s.erledigt) { s.kg = kg; s.geaendert = false; }   // ohne e1RM leer lassen statt 0 kg
  }
}

export function Training({ t, setT, timer, setTimer, einst, toast, lichter, minimieren, beenden, zuVerlauf }) {
  const [sheet, setSheet] = useState(null);
  useTakt(true, 1000);
  const aktuell = (() => {
    for (const [ki, k] of t.karten.entries()) if (k.key) for (const [gi, g] of k.gruppen.entries()) for (const [si, x] of g.saetze.entries()) if (!x.erledigt) return [ki, gi, si];
    return null;
  })();
  const dauer = (Date.now() - t.start) / 1000;
  const kg = einst.koerpergewicht;
  const aendere = (f) => setT((alt) => { const karten = structuredClone(alt.karten); f(karten); return { ...alt, karten }; });
  const satz = (ki, gi, si, f) => aendere((ks) => f(ks[ki].gruppen[gi].saetze[si], ks[ki].gruppen[gi], ks[ki]));

  const abhaken = (ki, gi, si) => {
    const k = t.karten[ki], g = k.gruppen[gi], s = g.saetze[si];
    if (s.erledigt) { satz(ki, gi, si, (x) => { x.erledigt = false; x.pr = false; x.e1rm = null; }); return; }
    const wert = satzE1rm(k.key, s, kg);
    const heute = t.karten.filter((kk) => kk.key === k.key).flatMap((kk) => kk.gruppen.flatMap((gg) => gg.saetze)).filter((x) => x.erledigt && x.e1rm).map((x) => x.e1rm);
    const bisher = Math.max(BEST_E1RM[k.key] ?? Infinity, ...heute);
    const pr = wert != null && (s.kg > 0 || koerperUebung(k.key)) && wert > bisher;
    satz(ki, gi, si, (x) => { x.erledigt = true; x.e1rm = wert; x.pr = pr; x.zeit = new Date().toISOString(); });
    if (pr) lichter({ gold: true, titel: 'Neuer Rekord', text: `${nameVon(k.key)} · e1RM ${gwE(wert, 1)}` });
    else if (['top', 'test'].includes(g.rolle) && s.wdh > 0) lichter({ gold: false, titel: 'Good Lift', text: `${gwE(s.kg)} × ${s.wdh}` });
    // Supersatz: ohne Pause zur nächsten Übung der Gruppe; die Pause läuft erst nach der letzten Übung der Runde
    if (k.supersatz) {
      const gruppe = t.karten.map((kk, i) => [kk, i]).filter(([kk]) => kk.supersatz === k.supersatz);
      const weiter = gruppe.filter(([, i]) => i > ki).map(([kk]) => kk).find((kk) => kk.gruppen.some((gg) => gg.saetze.some((x) => !x.erledigt)));
      if (weiter) { setTimer(null); toast({ titel: 'Supersatz', text: `Weiter mit ${nameVon(weiter.key)}` }); return; }
    }
    const naechster = g.saetze[si + 1] ?? k.gruppen[gi + 1]?.saetze[0] ?? t.karten[ki + 1]?.gruppen[0]?.saetze[0];
    const pause = pauseVon(k.key, g.rolle, einst.pausen);
    setTimer({ ende: Date.now() + pause * 1000, dauer: pause, fertig: false,
      naechster: naechster ? `${gwE(naechster.kg)} × ${naechster.wdh}` : 'letzter Satz geschafft' });
  };

  const gesamt = alleSaetze(t);
  return html`<div class="screen">
    <header class="topbar kopf-training">
      <div class="row" style="width:100%">
        <button class="iconbtn" onClick=${minimieren} aria-label="Training im Hintergrund weiterlaufen lassen">${I.runter}</button>
        <div style="flex:1;min-width:0"><div class="eyebrow">${t.titel}${einst.cut ? ' · Cut' : ''}</div>
          ${t.bearbeiten ? html`<div class="muted" style="font-size:13px">Gespeichertes Training ändern</div>`
            : html`<div class="row" style="gap:8px;align-items:baseline"><span class="clock">${mmss(dauer)}</span><span class="muted" style="font-size:12px">Trainingszeit</span></div>`}</div>
        <button class="btn btn-chalk btn-sm" onClick=${() => setSheet({ art: 'ende' })}>${t.bearbeiten ? 'Fertig' : 'Beenden'}</button>
      </div>
      ${timer ? html`<div style="width:100%"><${PausenTimer} timer=${timer} setTimer=${setTimer} kopf=${true}/></div>` : null}
      <div class="fortschritt" style="width:100%" role="progressbar" aria-valuemin="0" aria-valuemax=${gesamt.length} aria-valuenow=${gesamt.filter((s) => s.erledigt).length}
        aria-label="Erledigte Sätze">${t.karten.map((k) => {
          const s = k.gruppen.flatMap((g) => g.saetze);
          return html`<div key=${k.id} style=${`flex:${s.length}`}><i style=${`width:${(s.filter((x) => x.erledigt).length / s.length) * 100}%`}></i></div>`;
        })}</div>
    </header>

    ${t.karten.map((k, ki) => k.slot ? html`<section class="card ex" key=${k.id}>
        <div class="ex-head"><div class="badge" style="background:var(--raised);color:var(--muted)">+</div>
          <div style="min-width:0"><p class="ex-title">${k.slot.label}</p>
            <div class="ex-meta">${k.gruppen[0].saetze.length} × ${k.gruppen[0].wdhText}${k.gruppen[0].rpe ? ` · ${rpeText(k.gruppen[0].rpe)}` : ''} · Übung wählen</div></div></div>
        <div class="slot"><${UebungSuche} id=${`slot-${ki}`} familien=${k.slot.families?.length ? k.slot.families : null} onWahl=${(key) => aendere((ks) => setzeUebung(ks[ki], key, kg))}/></div>
      </section>`
      : html`<${Karte} key=${k.id} k=${k} ki=${ki} karten=${t.karten} abhaken=${abhaken} aendere=${aendere} setSheet=${setSheet} einst=${einst} zuVerlauf=${zuVerlauf} bearbeiten=${!!t.bearbeiten} aktuell=${aktuell}/>`)}

    <section class="card pad stack">
      <span class="viz-t">${t.karten.length ? 'Weitere Übung' : 'Erste Übung wählen'}</span>
      <${UebungSuche} id="neue-uebung" platzhalter="Übung suchen, z. B. Rudern" onWahl=${(key) => {
        aendere((ks) => ks.push(neueKarte(key, ks, kg)));
        toast({ titel: 'Übung hinzugefügt', text: nameVon(key) });
      }}/>
    </section>

    ${sheet?.art === 'kg' && html`<${KgSheet} t=${t} s=${sheet} zu=${() => setSheet(null)} satz=${satz} koerperKg=${kg}/>`}
    ${sheet?.art === 'wdh' && html`<${WdhSheet} t=${t} s=${sheet} zu=${() => setSheet(null)} satz=${satz}/>`}
    ${sheet?.art === 'rpe' && html`<${SatzSheet} t=${t} s=${sheet} zu=${() => setSheet(null)} satz=${satz} aendere=${aendere} koerperKg=${kg}/>`}
    ${sheet?.art === 'unotiz' && html`<${UebungNotizSheet} t=${t} ki=${sheet.ki} zu=${() => setSheet(null)} aendere=${aendere}/>`}
    ${sheet?.art === 'tausch' && html`<${Sheet} zu=${() => setSheet(null)} label="Übung tauschen">
      <div><div class="eyebrow">Übung tauschen</div><h2 class="h2">${nameVon(t.karten[sheet.ki].key)}</h2></div>
      <${UebungSuche} id="tausch" autofokus=${true} familien=${[uebung(t.karten[sheet.ki].key)?.f].filter(Boolean)}
        onWahl=${(key) => { aendere((ks) => setzeUebung(ks[sheet.ki], key, kg)); setSheet(null); toast({ titel: 'Übung getauscht', text: nameVon(key) }); }}/>
    <//>`}
    ${sheet?.art === 'ende' && html`<${EndeSheet} t=${t} zu=${() => setSheet(null)} beenden=${beenden}/>`}
  </div>`;
}

function Karte({ k, ki, karten, abhaken, aendere, setSheet, einst, zuVerlauf, bearbeiten = false, aktuell = null }) {
  const lift = liftVon(k.key), letzte = LETZTES[k.key], g0 = k.gruppen[0], koerper = koerperUebung(k.key), a = anpassung(k.key);
  const aufw = !bearbeiten && stangeVon(k.key) && g0.saetze[0].kg > 40 ? aufwaermen(g0.saetze[0].kg, { stange: stangeKg(), inventar: scheibenKg() }) : [];
  const naechste = karten[ki + 1];
  const supersatz = (an) => aendere((ks) => {
    if (an) { const gruppe = ks[ki].supersatz ?? ks[ki + 1]?.supersatz ?? Math.max(0, ...ks.map((x) => x.supersatz ?? 0)) + 1; ks[ki].supersatz = gruppe; ks[ki + 1].supersatz = gruppe; }
    else { const gruppe = ks[ki].supersatz; for (const x of ks) if (x.supersatz === gruppe) x.supersatz = undefined; }
  });
  return html`<section class=${`card ex ${k.supersatz ? 'supersatz' : ''}`}>
    ${k.supersatz ? html`<div class="ss-marke">Supersatz ${String.fromCharCode(64 + k.supersatz)}</div>` : null}
    <div class="ex-head">
      <button class="bild-knopf" onClick=${() => zuVerlauf(k.key)} aria-label="Verlauf und Chart dieser Übung" style=${lift === 'andere' ? '' : `--c:${LIFT[lift].farbe}`}><${UebungsBild} schluessel=${k.key} groesse=${48}/></button>
      <div style="min-width:0;flex:1"><p class="ex-title">${nameVon(k.key)}</p>
        <div class="ex-meta">${letzte ? html`Letztes Mal <b>${letzte[0]}</b> · ${letzte[1]}` : 'Noch kein Eintrag'}</div>
        ${a?.cues || a?.rack ? html`<div class="cue">${a.cues ? html`<span>${a.cues}</span>` : null}${a.rack ? html`<span class="rack">Rack ${a.rack}</span>` : null}</div>` : null}
        ${k.notiz ? html`<div class="cue notiz">${k.notiz}</div>` : null}</div>
      <div class="ex-akt">
        <button class="mini akzent" onClick=${() => zuVerlauf(k.key)} aria-label="Verlauf und Chart dieser Übung">${I.statistik}</button>
        <button class="mini" onClick=${() => setSheet({ art: 'tausch', ki })} aria-label="Übung tauschen">${I.tausch}</button>
      </div>
    </div>
    ${k.gruppen.map((g, gi) => html`<div key=${gi}>
      <div class="group-h">
        <span class=${`tag ${['top', 'test'].includes(g.rolle) ? 'top' : ''}`}>${rollenText[g.rolle] ?? (g.saetzeText ?? 'Arbeitssätze')}</span>
        <span class="target">${g.wdhText ? `${g.saetze.length} × ${g.wdhText}` : `${g.saetze.length} ${g.saetze.length === 1 ? 'Satz' : 'Sätze'}`}${g.rpe ? ` · ${rpeText(g.rpe)}` : ''}${g.vorschlag ? ' · kg aus e1RM' : ''}${g.gekuerzt ? ' · Cut −1' : ''}</span>
      </div>
      ${g.kgBis && g.saetze.some((s) => !s.erledigt) ? html`<div class="spanne">
        <span>Spielraum <b>${gw(g.saetze[0].kgPlan ?? g.saetze[0].kg)}–${gw(g.kgBis)} ${einheit()}</b> – nach Tagesform wählen</span>
        <button class="chip" onClick=${() => aendere((ks) => { for (const s of ks[ki].gruppen[gi].saetze) if (!s.erledigt) { s.kg = g.kgBis; s.geaendert = true; } })}>auf ${gw(g.kgBis)}</button>
      </div>` : null}
      ${gi === 0 && aufw.length ? html`<details class="warm">
        <summary><span>Aufwärmen</span><span class="muted" style="font-size:13px">${aufw.length} Sätze bis ${gwE(aufw.at(-1).kg)}</span></summary>
        <ol>${aufw.map((w, i) => html`<li key=${i}><span class="zahl">${gwE(w.kg)}</span><span class="muted">× ${w.wdh}</span><${Scheiben} kg=${w.kg}/></li>`)}</ol>
      </details>` : null}
      ${g.saetze.map((s, si) => {
        const extras = satzExtras(s);
        const jetzt = aktuell && aktuell[0] === ki && aktuell[1] === gi && aktuell[2] === si;
        return html`<div key=${si} class=${`set ${s.erledigt ? 'done' : ''} ${jetzt ? 'jetzt' : ''} ${s.pr ? 'pr' : ''} ${s.typ === 'warmup' ? 'aufw' : ''}`}>
        <span class="n" title=${SATZTYP.find(([id]) => id === s.typ)?.[1] ?? null}>${SATZTYP_KURZ[s.typ] ?? si + 1}</span>
        <button class=${`cell ${s.geaendert || s.erledigt ? '' : 'plan'}`} onClick=${() => setSheet({ art: 'kg', ki, gi, si })} aria-label="Gewicht ändern">
          <span class="v">${koerper && s.kg > 0 ? '+' : ''}${gw(s.kg)}</span><span class="u">${koerper ? `${einheit()} Zusatz` : einheit()}</span></button>
        <button class=${`cell ${s.geaendert || s.erledigt ? '' : 'plan'}`} onClick=${() => setSheet({ art: 'wdh', ki, gi, si })} aria-label=${`${s.wdh} Wiederholungen ändern`}>
          <span class="v">${s.wdh}</span><span class="u">Wdh</span></button>
        <button class="cell" onClick=${() => setSheet({ art: 'rpe', ki, gi, si })} aria-label="RPE und Satzdetails">
          <span class="v">${s.rpe != null ? fmt(s.rpe) : html`<span class="muted">–</span>`}</span><span class="u">RPE${extras.length ? ' ·' : ''}</span></button>
        <button class="check" onClick=${() => abhaken(ki, gi, si)} aria-label=${s.erledigt ? 'Satz zurücknehmen' : 'Satz abhaken'}>${I.check}</button>
        ${(s.erledigt && s.e1rm) || extras.length ? html`<div class="setinfo">
          ${s.erledigt && s.e1rm ? html`<span>e1RM ${gwE(s.e1rm, 1)}${koerper ? ` gesamt (Zusatz ${gw(s.e1rm - einst.koerpergewicht, 1)})` : ''}</span>` : null}
          ${extras.length ? html`<span class="extras">${extras.join(' · ')}</span>` : null}${s.pr ? html`<span class="prb">Rekord</span>` : null}</div>` : null}
      </div>`;
      })}
      ${g.notiz ? html`<p class="muted" style="font-size:13px;margin:6px 16px 4px">${g.notiz}</p>` : null}
    </div>`)}
    <div class="ex-foot">
      <button class="link" onClick=${() => aendere((ks) => { const g = ks[ki].gruppen.at(-1); const s = g.saetze.at(-1); g.saetze.push({ ...s, id: undefined, erledigt: false, e1rm: null, pr: false, rpe: null, zeit: null, notiz: undefined }); })}>+ Satz</button>
      <button class="link" onClick=${() => setSheet({ art: 'unotiz', ki })}>${k.notiz ? 'Notiz ändern' : 'Notiz'}</button>
      ${k.supersatz ? html`<button class="link" onClick=${() => supersatz(false)}>Supersatz lösen</button>`
        : naechste && !naechste.slot ? html`<button class="link" onClick=${() => supersatz(true)}>Supersatz mit nächster</button>` : null}
      <span class="link">Pause ${mmss(pauseVon(k.key, g0.rolle, einst.pausen))}</span>
    </div>
  </section>`;
}

function KgSheet({ t, s: z, zu, satz, koerperKg }) {
  const k = t.karten[z.ki], g = k.gruppen[z.gi], s = g.saetze[z.si], inc = incVon(k.key), koerper = koerperUebung(k.key);
  const [kg, setKg] = useState(s.kg ?? 0);
  const [alle, setAlle] = useState(true);
  const best = BEST_E1RM[k.key];
  const ok = () => {
    for (let i = z.si; i < (alle ? g.saetze.length : z.si + 1); i++) {
      satz(z.ki, z.gi, i, (x) => { if (i === z.si || !x.erledigt) { x.kg = kg; x.geaendert = true; } });
    }
    zu();
  };
  return html`<${Sheet} zu=${zu} label="Gewicht">
    <div><div class="eyebrow">${koerper ? 'Zusatzgewicht' : 'Gewicht'} · Satz ${z.si + 1}</div><h2 class="h2">${nameVon(k.key)}</h2></div>
    <div class="big">${koerper && kg > 0 ? '+' : ''}${gw(kg)}<small>${einheit()}</small></div>
    <div class="stepper">${[-2 * inc, -inc, inc, 2 * inc].map((d) => html`<button key=${d} onClick=${() => setKg(koerper ? +(kg + d).toFixed(4) : Math.max(0, +(kg + d).toFixed(4)))}>${d > 0 ? '+' : '−'}${gw(Math.abs(d))}</button>`)}</div>
    ${koerper ? html`<p class="muted" style="margin:0;font-size:13.5px">Gesamtlast ${koerperKg ? gwE(koerperKg + kg) : '–'} (Körpergewicht ${koerperKg ? gwE(koerperKg) : 'fehlt – in den Einstellungen eintragen'}). Negativ = Unterstützung.</p>` : null}
    ${stangeVon(k.key) ? html`<div class="stack" style="gap:8px"><${Hantel} kg=${kg}/><div class="row between"><span class="eyebrow">Pro Seite</span><${Scheiben} kg=${kg}/></div></div>` : null}
    ${best && !koerper && lastFuer(best, s.wdh, 9) ? html`<p class="muted" style="margin:0;font-size:13.5px">Bestes e1RM ${gwE(best, 1)}. Das entspricht etwa <b style="color:var(--ink)">${gwE(lastFuer(best, s.wdh, 9, inc))} × ${s.wdh} @ RPE 9</b>, darüber wird es ein Rekord.</p>` : null}
    ${g.saetze.length > z.si + 1 ? html`<label class="schalter" for="kg-alle"><span>Auch für die folgenden Sätze</span>
      <input type="checkbox" id="kg-alle" checked=${alle} onChange=${(e) => setAlle(e.currentTarget.checked)}/></label>` : null}
    <button class="btn btn-chalk btn-block" onClick=${ok}>Übernehmen</button>
  <//>`;
}

function WdhSheet({ t, s: z, zu, satz }) {
  const s = t.karten[z.ki].gruppen[z.gi].saetze[z.si];
  const [wdh, setWdh] = useState(s.wdh);
  return html`<${Sheet} zu=${zu} label="Wiederholungen">
    <div class="eyebrow">Wiederholungen · Satz ${z.si + 1}</div>
    <div class="big">${wdh}<small>Wdh</small></div>
    <div class="stepper">${[-2, -1, 1, 2].map((d) => html`<button key=${d} onClick=${() => setWdh(Math.max(0, wdh + d))}>${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`)}</div>
    ${wdh === 0 ? html`<p class="muted" style="margin:0">0 Wdh zählt als Fehlversuch: gespeichert, aber nicht für e1RM und Volumen gewertet.</p>` : null}
    <button class="btn btn-chalk btn-block" onClick=${() => { satz(z.ki, z.gi, z.si, (x) => { x.wdh = wdh; x.geaendert = true; }); zu(); }}>Übernehmen</button>
  <//>`;
}

// Satztypen: „normal“ behält die Rolle aus dem Plan (Top-Satz, Back-off, Test, Arbeitssatz)
export const SATZTYP = [['', 'Normal'], ['warmup', 'Aufwärmen'], ['drop', 'Drop-Satz'], ['failure', 'Bis Versagen'], ['amrap', 'AMRAP']];
export const SATZTYP_KURZ = { warmup: 'A', drop: 'D', failure: 'V', amrap: '+' };
export const AUSRUESTUNG = [['guertel', 'Gürtel'], ['knie', 'Kniebandagen'], ['handgelenk', 'Handgelenk'], ['ellbogen', 'Ellbogen']];
const SONDERTYP = new Set(['warmup', 'drop', 'failure', 'amrap']);

/** Satzdetails: RPE, Satztyp, Ausrüstung, Bänder/Ketten, Geschwindigkeit, Notiz; Satz entfernen. */
function SatzSheet({ t, s: z, zu, satz, aendere, koerperKg }) {
  const k = t.karten[z.ki], g = k.gruppen[z.gi], s = g.saetze[z.si];
  const [rpe, setRpe] = useState(s.rpe);
  const [typ, setTyp] = useState(SONDERTYP.has(s.typ) ? s.typ : '');
  const [extra, setExtra] = useState({ gear: [], ...(s.extra ?? {}) });
  const [notiz, setNotiz] = useState(s.notiz ?? '');
  const [mehr, setMehr] = useState(!!(s.extra?.baender || s.extra?.ketten || s.extra?.ms));
  // Zahlenfelder als Text halten (sonst springt „12,“ beim Tippen zurück), erst beim Übernehmen umrechnen
  const [kettenText, setKettenText] = useState(s.extra?.ketten != null ? String(inAnzeige(s.extra.ketten)) : '');
  const [msText, setMsText] = useState(s.extra?.ms != null ? String(s.extra.ms) : '');
  const wert = rpe != null ? satzE1rm(k.key, { ...s, rpe }, koerperKg) : null;
  const gear = (id) => setExtra((x) => ({ ...x, gear: x.gear.includes(id) ? x.gear.filter((y) => y !== id) : [...x.gear, id] }));
  const zahl = (v) => (String(v).trim() === '' || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
  const nimm = () => {
    const alle = { ...extra, ketten: zahl(kettenText) != null ? inKg(zahl(kettenText)) : null, ms: zahl(msText) };
    const sauber = Object.fromEntries(Object.entries(alle).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));
    satz(z.ki, z.gi, z.si, (x) => {
      x.rpe = rpe;
      x.typBasis ??= SONDERTYP.has(x.typ) ? null : x.typ ?? null;      // Plan-Rolle merken, damit „Normal“ sie zurückholt
      x.typ = typ || x.typBasis || undefined;
      x.extra = Object.keys(sauber).length ? sauber : undefined;
      x.notiz = notiz.trim() || undefined;
      if (x.erledigt) x.e1rm = satzE1rm(k.key, x, koerperKg);
    });
    zu();
  };
  const entfernen = () => {
    aendere((ks) => {
      const gr = ks[z.ki].gruppen[z.gi];
      gr.saetze.splice(z.si, 1);
      if (!gr.saetze.length) ks[z.ki].gruppen.splice(z.gi, 1);
      if (!ks[z.ki].gruppen.length) ks.splice(z.ki, 1);
    });
    zu();
  };
  return html`<${Sheet} zu=${zu} label="Satzdetails">
    <div class="row between"><div><div class="eyebrow">Satz ${z.si + 1} · ${gw(s.kg)} ${einheit()} × ${s.wdh}</div><h2 class="h2">Wie schwer war's?</h2></div>${g.rpe ? html`<span class="tag">Ziel ${rpeText(g.rpe)}</span>` : null}</div>
    <div class="rpe-grid">
      ${[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => html`<button key=${r} aria-pressed=${String(rpe === r)} onClick=${() => setRpe(r)}>
        <b>${fmt(r)}</b><span>${r === 10 ? 'Limit' : `noch ${fmt(10 - r)}`}</span></button>`)}
      <button aria-pressed=${String(rpe == null)} onClick=${() => setRpe(null)}><b>–</b><span>ohne</span></button>
    </div>
    <div class="kv">
      <div><span class="eyebrow">e1RM${koerperUebung(k.key) ? ' ges.' : ''}</span><b>${wert ? gw(wert, 1) : '–'}</b></div>
      <div><span class="eyebrow">% 1RM</span><b>${rpe != null && rtsPct(s.wdh, rpe) ? fmt(rtsPct(s.wdh, rpe) * 100, 1) : '–'}</b></div>
      <div><span class="eyebrow">Bestwert</span><b>${gw(BEST_E1RM[k.key] ?? null, 1)}</b></div>
    </div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Satztyp</span>
      <div class="row wrap" style="gap:6px">${SATZTYP.map(([id, text]) => html`<button key=${id} class="chip" aria-pressed=${String(typ === id)} onClick=${() => setTyp(id)}>${text}</button>`)}</div>
      ${typ === 'warmup' ? html`<span class="muted" style="font-size:12.5px">Aufwärmsätze zählen nicht ins Volumen und nicht fürs e1RM.</span>` : null}</div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Ausrüstung</span>
      <div class="row wrap" style="gap:6px">${AUSRUESTUNG.map(([id, text]) => html`<button key=${id} class="chip" aria-pressed=${String(extra.gear.includes(id))} onClick=${() => gear(id)}>${text}</button>`)}</div></div>
    ${mehr ? html`<div class="filter-zeile">
      <label class="field" for="x-baender"><span class="label">Bänder</span><input id="x-baender" class="text" type="text" placeholder="z. B. mini" value=${extra.baender ?? ''} onInput=${(e) => { const v = e.currentTarget.value; setExtra((x) => ({ ...x, baender: v })); }}/></label>
      <label class="field" for="x-ketten"><span class="label">Ketten (${einheit()})</span><input id="x-ketten" type="text" inputmode="decimal" value=${kettenText} onInput=${(e) => setKettenText(e.currentTarget.value)}/></label>
      <label class="field" for="x-ms"><span class="label">Tempo (m/s)</span><input id="x-ms" type="text" inputmode="decimal" value=${msText} onInput=${(e) => setMsText(e.currentTarget.value)}/></label>
    </div>` : html`<button class="link" style="justify-self:start" onClick=${() => setMehr(true)}>Bänder, Ketten, Geschwindigkeit …</button>`}
    <label class="field" for="x-notiz"><span class="label">Notiz zum Satz</span>
      <input id="x-notiz" class="text" type="text" placeholder="z. B. Knie nach innen" value=${notiz} onInput=${(e) => setNotiz(e.currentTarget.value)}/></label>
    <div class="row"><button class="btn btn-gefahr" onClick=${entfernen}>Satz entfernen</button><button class="btn btn-chalk" style="flex:1" onClick=${nimm}>Übernehmen</button></div>
  <//>`;
}

function UebungNotizSheet({ t, ki, zu, aendere }) {
  const k = t.karten[ki];
  const [notiz, setNotiz] = useState(k.notiz ?? '');
  return html`<${Sheet} zu=${zu} label="Notiz zur Übung">
    <div><div class="eyebrow">Notiz zur Übung</div><h2 class="h2">${nameVon(k.key)}</h2></div>
    <textarea id="u-notiz" rows="3" placeholder="z. B. Griff eine Fingerbreite enger" value=${notiz} onInput=${(e) => setNotiz(e.currentTarget.value)}></textarea>
    <button class="btn btn-chalk btn-block" onClick=${() => { aendere((ks) => { ks[ki].notiz = notiz.trim() || null; }); zu(); }}>Übernehmen</button>
  <//>`;
}

function EndeSheet({ t, zu, beenden }) {
  const [gefuehl, setGefuehl] = useState(t.sessionRpe ?? null);       // beim Bearbeiten: bisherige Angaben vorbelegt
  const [notiz, setNotiz] = useState(t.notiz ?? '');
  const saetze = alleSaetze(t).filter((s) => s.erledigt);
  const tonnage = saetze.reduce((a, s) => a + (s.kg || 0) * (s.wdh || 0), 0);
  const prs = saetze.filter((s) => s.pr).length;
  const ende = t.bearbeiten && t.ende ? Date.parse(t.ende) : Date.now();
  return html`<${Sheet} zu=${zu} label=${t.bearbeiten ? 'Änderungen speichern' : 'Training beenden'}>
    <div><div class="eyebrow">${t.titel}</div><h2 class="h2">${t.bearbeiten ? 'Änderungen speichern' : 'Training beenden'}</h2></div>
    <div class="kv">
      <div><span class="eyebrow">Dauer</span><b>${Math.max(1, Math.round((ende - t.start) / 60000))} min</b></div>
      <div><span class="eyebrow">Sätze</span><b>${saetze.length}</b></div>
      <div><span class="eyebrow">Volumen</span><b>${tonnageText(tonnage)}</b></div>
    </div>
    ${prs ? html`<div class="row" style="background:var(--gold-soft);border-radius:14px;padding:12px"><span class="medaille">PR</span>
      <div><b>${prs} ${prs === 1 ? 'neuer Rekord' : 'neue Rekorde'}</b><div class="muted" style="font-size:13px">Landet in Rekordtafel und Statistik.</div></div></div>` : null}
    <div class="stack" style="gap:8px"><span class="eyebrow">Wie anstrengend war das Training? (Session-RPE 1–10)</span>
      <div class="feel">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => html`<button key=${n} aria-pressed=${String(gefuehl === n)} onClick=${() => setGefuehl(n)}>${n}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">Daraus rechnet die Statistik die Trainingsbelastung (Session-RPE × Minuten).</span></div>
    <label class="stack" style="gap:8px" for="ende-notiz"><span class="eyebrow">Notiz</span>
      <textarea id="ende-notiz" placeholder="z. B. Knie heute gut, Bank schnell" value=${notiz} onInput=${(e) => setNotiz(e.currentTarget.value)}></textarea></label>
    <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Weiter</button>
      <button class=${`btn ${saetze.length ? 'btn-chalk' : 'btn-gefahr'}`} style="flex:1.4" onClick=${() => beenden({ sessionRpe: gefuehl, notiz: notiz.trim() || null })}>${saetze.length ? 'Speichern' : 'Verwerfen'}</button></div>
    <p class="muted" style="margin:0;font-size:12.5px">${!saetze.length ? (t.bearbeiten ? 'Kein Satz abgehakt – die Änderungen werden verworfen, das gespeicherte Training bleibt.' : 'Kein Satz abgehakt – das Training wird nicht gespeichert.')
      : t.bearbeiten ? 'Ersetzt das gespeicherte Training, auf dem Handy sofort und auf dem Server beim nächsten Abgleich.'
      : 'Das Training wird sofort auf dem Handy gesichert und hochgeladen, sobald Netz da ist.'}</p>
  <//>`;
}
