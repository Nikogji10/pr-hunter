// PR Hunter · Training (läuft im Hintergrund weiter), Satz-Sheets, Übung tauschen.
// Oben stehen immer Trainingszeit und Pause bis zum nächsten Satz.
import { html, useState, useRef, fmt, mmss, uhr, LIFT, liftVon, nameVon, pauseVon, stangeVon, incVon, uebung, koerperUebung, rollenText, rpeText,
  I, Sheet, Scheiben, Hantel, useTakt, PausenTimer, gw, gwE, einheit, inKg, inAnzeige, anpassung, stangeKg, scheibenKg, satzExtras, formel, tonnage as tonnageText } from './basis.js';
import { UebungsBild, useEffect, leseZahl } from './basis.js';
import { e1rm, lastFuer, lastFuerWeit, e1rmWeit, mround, rtsPct, aufwaermen, e1rmKoerper, zusatzFuer } from '../js/rechnen.js';
import { UebungSuche } from './suche.js';
import { programmText } from './programmtexte.js';
import { BEST_E1RM, E1RM_AKTUELL, LETZTES } from './stand.js';

const e1rmFuer = (key) => E1RM_AKTUELL[key] ?? BEST_E1RM[key] ?? null;   // aktuelle Form, sonst Bestwert
const wdhText = (w) => !w ? '1' : w.amrap ? (w.ziel ? `max (Ziel ${w.ziel})` : 'max') : w.text ? w.text : w.plus ? `${w.min}+` : w.min !== w.max ? `${w.min}–${w.max}` : String(w.min);

/** Vorschlag aus e1RM und Ziel-RPE; bei Körpergewichtsübungen das Zusatzgewicht. */
function vorschlag(key, wdh, rpe, koerperKg) {
  const basis = e1rmFuer(key);
  if (!basis || !rpe) return null;
  return koerperUebung(key) ? zusatzFuer(basis, wdh, rpe, koerperKg) : lastFuerWeit(basis, wdh, rpe, incVon(key));
}

/** e1RM eines Satzes; bei Körpergewichtsübungen über die Gesamtlast. Für Rekorde ohne RPE (wie die Auswertung),
 *  mitRpe = Schätzung aus der eingetragenen RPE (Anzeige am Satz). */
export function satzE1rm(key, s, koerperKg, mitRpe = false) {
  if (!(s.wdh > 0)) return null;
  if (s.typ === 'warmup') return null;                   // Aufwärmsätze zählen nicht fürs e1RM
  const rpe = mitRpe ? s.rpe : null;
  return koerperUebung(key) ? e1rmKoerper(s.kg ?? 0, s.wdh, rpe, koerperKg, formel())?.gesamt ?? null : (mitRpe ? e1rmWeit : e1rm)(s.kg, s.wdh, rpe, formel());
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
  // Fokus: die Übung mit dem nächsten offenen Satz; die übrigen treten zurück, solange sie aufgeklappt ist
  const fokus = !t.bearbeiten && aktuell && !t.karten[aktuell[0]].zu ? aktuell[0] : null;
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
    else if (['top', 'test'].includes(g.rolle) && s.wdh > 0) lichter({ gold: false, titel: 'Gültiger Versuch', text: `${gwE(s.kg)} × ${s.wdh}` });
    // Supersatz: ohne Pause zur nächsten Übung der Gruppe; die Pause läuft erst nach der letzten Übung der Runde
    if (k.supersatz) {
      const gruppe = t.karten.map((kk, i) => [kk, i]).filter(([kk]) => kk.supersatz === k.supersatz);
      const weiter = gruppe.filter(([, i]) => i > ki).map(([kk]) => kk).find((kk) => kk.gruppen.some((gg) => gg.saetze.some((x) => !x.erledigt)));
      if (weiter) { setTimer(null); toast({ titel: 'Supersatz', text: `Weiter mit ${nameVon(weiter.key)}` }); return; }
    }
    const naechster = g.saetze[si + 1] ?? k.gruppen[gi + 1]?.saetze[0] ?? t.karten[ki + 1]?.gruppen[0]?.saetze[0];
    const pause = pauseVon(k.key, g.rolle, einst.pausen);
    setTimer({ ende: Date.now() + pause * 1000, dauer: pause, start0: pause, fertig: false,
      naechster: naechster ? `${gwE(naechster.kg)} × ${naechster.wdh}` : 'letzter Satz geschafft' });
    // Letzter Satz der Übung: einklappen, die nächste offene Übung aufklappen
    if (k.gruppen.every((gg, gj) => gg.saetze.every((x, sj) => x.erledigt || (gj === gi && sj === si)))) {
      aendere((ks) => {
        ks[ki].zu = true;
        const n = ks.findIndex((kk, j) => j > ki && kk.key && kk.gruppen.some((gg) => gg.saetze.some((x) => !x.erledigt)));
        if (n >= 0) ks[n].zu = false;
      });
    }
  };

  const gesamt = alleSaetze(t);
  return html`<div class="screen">
    <header class="topbar kopf-training">
      <div class="row" style="width:100%">
        <button class="iconbtn" onClick=${minimieren} aria-label="Training im Hintergrund weiterlaufen lassen">${I.runter}</button>
        <div style="flex:1;min-width:0"><div class="eyebrow">${t.titel}${einst.cut ? ' · Cut' : ''}</div>
          ${t.bearbeiten ? html`<div class="muted" style="font-size:13px">Gespeichertes Training ändern</div>`
            : html`<div class="row" style="gap:8px;align-items:baseline"><span class="clock">${uhr(dauer)}</span><span class="muted" style="font-size:12px">Trainingszeit</span></div>`}</div>
        <button class="btn btn-chalk btn-sm" onClick=${() => setSheet({ art: 'ende' })}>${t.bearbeiten ? 'Fertig' : 'Beenden'}</button>
      </div>
      ${timer ? html`<div style="width:100%"><${PausenTimer} timer=${timer} setTimer=${setTimer} kopf=${true}/></div>` : null}
      <div class="fortschritt" style="width:100%" role="progressbar" aria-valuemin="0" aria-valuemax=${gesamt.length} aria-valuenow=${gesamt.filter((s) => s.erledigt).length}
        aria-label="Erledigte Sätze">${t.karten.map((k) => {
          const s = k.gruppen.flatMap((g) => g.saetze);
          return html`<div key=${k.id} style=${`flex:${s.length}`}><i style=${`width:${(s.filter((x) => x.erledigt).length / s.length) * 100}%`}></i></div>`;
        })}</div>
    </header>

    ${t.karten.map((k, ki) => k.slot ? html`<section class=${`card ex ${fokus != null ? 'gedimmt' : ''}`} key=${k.id}>
        <div class="ex-head"><div class="badge" style="background:var(--raised);color:var(--muted)">+</div>
          <div style="min-width:0"><p class="ex-title">${k.slot.label}</p>
            <div class="ex-meta">${k.gruppen[0].saetze.length} × ${k.gruppen[0].wdhText}${k.gruppen[0].rpe ? ` · ${rpeText(k.gruppen[0].rpe)}` : ''} · Übung wählen</div></div></div>
        <div class="slot"><${UebungSuche} id=${`slot-${ki}`} familien=${k.slot.families?.length ? k.slot.families : null} onWahl=${(key) => aendere((ks) => setzeUebung(ks[ki], key, kg))}/></div>
      </section>`
      : html`<${Karte} key=${k.id} k=${k} ki=${ki} karten=${t.karten} abhaken=${abhaken} aendere=${aendere} setSheet=${setSheet} einst=${einst} zuVerlauf=${zuVerlauf} bearbeiten=${!!t.bearbeiten} aktuell=${aktuell}
          gedimmt=${fokus != null && fokus !== ki}/>`)}

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
    ${sheet?.art === 'entfernen' && t.karten[sheet.ki] && html`<${Sheet} zu=${() => setSheet(null)} label="Übung entfernen">
      <div><div class="eyebrow">Übung entfernen</div><h2 class="h2">${nameVon(t.karten[sheet.ki].key)}</h2></div>
      <p style="margin:0">${t.karten[sheet.ki].gruppen.some((g) => g.saetze.some((s) => s.erledigt)) ? 'Auch die schon abgehakten Sätze dieser Übung fallen weg.' : 'Die Übung verschwindet aus diesem Training.'}</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Behalten</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${() => { const name = nameVon(t.karten[sheet.ki].key); aendere((ks) => ks.splice(sheet.ki, 1)); setSheet(null); toast({ titel: 'Übung entfernt', text: name }); }}>Entfernen</button></div>
    <//>`}
  </div>`;
}

/** Wischen auf einer Übung: nach links = entfernen (mit Rückfrage), nach rechts = ein-/ausklappen. Senkrecht scrollt normal.
 *  Die Karte folgt dem Finger 1:1 (hinter der Schwelle mit Widerstand); beim Loslassen gleitet sie zurück bzw. hinaus. */
const SCHWELLE = 90;
function useWischen(links, rechts) {
  const z = useRef(null), el = useRef(null);
  const start = (e) => { const p = e.touches[0]; z.current = { x: p.clientX, y: p.clientY, dx: 0, an: false, aus: false }; };
  const zug = (e) => {
    const s = z.current; if (!s || s.aus) return;
    const p = e.touches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (!s.an) { if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; if (Math.abs(dx) < 1.5 * Math.abs(dy) || e.target.closest?.('.slot, input')) { s.aus = true; return; } s.an = true; s.x = p.clientX; }
    s.dx = p.clientX - s.x;
    const weg = Math.abs(s.dx) <= SCHWELLE ? s.dx : Math.sign(s.dx) * (SCHWELLE + (Math.abs(s.dx) - SCHWELLE) * 0.35);
    const k = el.current;
    k.style.transition = 'none';
    k.style.transform = `translateX(${weg}px)`;
    k.dataset.wisch = s.dx < 0 ? 'links' : 'rechts';
    k.dataset.scharf = String(Math.abs(s.dx) > SCHWELLE);
  };
  const ende = () => {
    const s = z.current; z.current = null;
    const k = el.current;
    if (!k || !s?.an) return;
    delete k.dataset.wisch; delete k.dataset.scharf;
    const ausloesen = Math.abs(s.dx) > SCHWELLE;
    if (ausloesen && s.dx > 0) {
      // Einklappen: kurz weiter nach rechts gleiten, dann umschalten und zurückfedern
      k.style.transition = 'transform .14s ease-out'; k.style.transform = `translateX(${SCHWELLE * 1.4}px)`;
      setTimeout(() => { k.style.transition = 'transform .28s cubic-bezier(.2, .9, .3, 1.2)'; k.style.transform = ''; rechts(); }, 140);
      return;
    }
    k.style.transition = 'transform .3s cubic-bezier(.2, .9, .3, 1.15)';
    k.style.transform = '';
    if (ausloesen) links();
  };
  return { ref: el, onTouchStart: start, onTouchMove: zug, onTouchEnd: ende, onTouchCancel: ende };
}

function Karte({ k, ki, karten, abhaken, aendere, setSheet, einst, zuVerlauf, bearbeiten = false, aktuell = null, gedimmt = false }) {
  const wisch = useWischen(() => setSheet({ art: 'entfernen', ki }), () => aendere((ks) => { ks[ki].zu = !ks[ki].zu; }));
  if (k.zu) {
    const alle = k.gruppen.flatMap((g) => g.saetze), fertig = alle.filter((s) => s.erledigt).length;
    return html`<section class=${`card ex eingeklappt ${gedimmt ? 'gedimmt' : ''}`} ...${wisch}>
      <button class="ex-zu" onClick=${() => aendere((ks) => { ks[ki].zu = false; })} aria-label=${`${nameVon(k.key)} aufklappen`}>
        <${UebungsBild} schluessel=${k.key} groesse=${32}/><b>${nameVon(k.key)}</b>
        <span class=${fertig === alle.length ? 'ok' : 'muted'}>${fertig}/${alle.length} ${fertig === alle.length ? '✓' : 'Sätze'}</span></button>
    </section>`;
  }
  const lift = liftVon(k.key), letzte = LETZTES[k.key], g0 = k.gruppen[0], koerper = koerperUebung(k.key), a = anpassung(k.key);
  const aufw = !bearbeiten && stangeVon(k.key) && g0.saetze[0].kg > 40 ? aufwaermen(g0.saetze[0].kg, { stange: stangeKg(), inventar: scheibenKg() }) : [];
  const naechste = karten[ki + 1];
  // Errechnetes 1RM heute: bester abgehakter Satz, sonst der aktuelle Satz dieser Übung (live beim Ändern)
  const heute1rm = (() => {
    const kand = k.gruppen.flatMap((g, gi) => g.saetze.map((s, si) => ({ s, jetzt: aktuell && aktuell[0] === ki && aktuell[1] === gi && aktuell[2] === si })))
      .filter(({ s, jetzt }) => (s.erledigt || jetzt) && s.wdh > 0 && (s.kg > 0 || koerper) && s.typ !== 'warmup');
    const werte = kand.map(({ s }) => satzE1rm(k.key, s, einst.koerpergewicht, true)).filter((v) => v != null);
    return werte.length ? Math.max(...werte) : null;
  })();
  const supersatz = (an) => aendere((ks) => {
    if (an) { const gruppe = ks[ki].supersatz ?? ks[ki + 1]?.supersatz ?? Math.max(0, ...ks.map((x) => x.supersatz ?? 0)) + 1; ks[ki].supersatz = gruppe; ks[ki + 1].supersatz = gruppe; }
    else { const gruppe = ks[ki].supersatz; for (const x of ks) if (x.supersatz === gruppe) x.supersatz = undefined; }
  });
  return html`<section class=${`card ex ${k.supersatz ? 'supersatz' : ''} ${gedimmt ? 'gedimmt' : ''}`} ...${wisch}>
    ${k.supersatz ? html`<div class="ss-marke">Supersatz ${String.fromCharCode(64 + k.supersatz)}</div>` : null}
    <div class="ex-head">
      <button class="bild-knopf" onClick=${() => zuVerlauf(k.key)} aria-label="Verlauf und Chart dieser Übung" style=${lift === 'andere' ? '' : `--c:${LIFT[lift].farbe}`}><${UebungsBild} schluessel=${k.key} groesse=${48}/></button>
      <div style="min-width:0;flex:1"><button class="ex-title titel-knopf" onClick=${() => zuVerlauf(k.key)}>${nameVon(k.key)}</button>
        <div class="ex-meta">${letzte ? html`Letztes Mal <b>${letzte[2] ? `${gw(letzte[2].kg ?? 0)} × ${letzte[2].wdh}${letzte[2].rpe != null ? ` @ ${fmt(letzte[2].rpe)}` : ''}` : letzte[0]}</b> · ${letzte[1]}` : 'Noch kein Eintrag'}${BEST_E1RM[k.key] ? html` · <span class="best-1rm">1RM ${gwE(BEST_E1RM[k.key], 1)}</span>` : ''}${heute1rm ? html` · <span class="heute-1rm" title="Errechnet aus Gewicht × Wdh (mit RPE, falls eingetragen)">heute ≈ ${gwE(heute1rm, 1)}</span>` : ''}</div>
        ${a?.cues || a?.rack ? html`<div class="cue">${a.cues ? html`<span>${a.cues}</span>` : null}${a.rack ? html`<span class="rack">Rack ${a.rack}</span>` : null}</div>` : null}
        ${k.notiz ? html`<div class="cue notiz">${k.notiz}</div>` : null}</div>
      <div class="ex-akt">
        <button class="mini akzent" onClick=${() => zuVerlauf(k.key)} aria-label="Verlauf und Chart dieser Übung">${I.statistik}</button>
        <button class="mini" onClick=${() => setSheet({ art: 'tausch', ki })} aria-label="Übung tauschen">${I.tausch}</button>
      </div>
    </div>
    ${k.gruppen.map((g, gi) => html`<div key=${gi}>
      <div class="group-h">
        <span class=${`tag ${['top', 'test'].includes(g.rolle) ? 'top' : ''}`}>${rollenText[g.rolle] ?? (programmText(g.saetzeText) ?? 'Arbeitssätze')}</span>
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
        const satz1rm = s.rpe != null && (s.kg > 0 || koerper) ? satzE1rm(k.key, s, einst.koerpergewicht, true) : s.erledigt ? s.e1rm : null;
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
        ${satz1rm || extras.length ? html`<div class="setinfo">
          ${satz1rm ? html`<span>${s.rpe != null ? '≈ ' : ''}1RM ${gwE(satz1rm, 1)}${koerper ? ` gesamt (Zusatz ${gw(satz1rm - einst.koerpergewicht, 1)})` : ''}</span>` : null}
          ${extras.length ? html`<span class="extras">${extras.join(' · ')}</span>` : null}${s.pr ? html`<span class="prb">Rekord</span>` : null}</div>` : null}
      </div>`;
      })}
      ${g.notiz ? html`<p class="muted" style="font-size:13px;margin:6px 16px 4px">${programmText(g.notiz)}</p>` : null}
    </div>`)}
    <div class="ex-foot">
      <span class="satz-pm" role="group" aria-label="Sätze">
        <button class="mini" disabled=${!k.gruppen.at(-1).saetze.some((s) => !s.erledigt) || k.gruppen.flatMap((g) => g.saetze).length < 2} aria-label="Satz entfernen"
          onClick=${() => aendere((ks) => {
            const gr = ks[ki].gruppen, g = gr.at(-1), i = g.saetze.findLastIndex((s) => !s.erledigt);
            if (i >= 0) g.saetze.splice(i, 1);
            if (!g.saetze.length && gr.length > 1) gr.pop();          // leere Gruppe entfernen, sonst legt „+“ Sätze ohne Werte an
          })}>−</button>
        <span>Satz</span>
        <button class="mini" aria-label="Satz hinzufügen"
          onClick=${() => aendere((ks) => {
            const g = ks[ki].gruppen.at(-1);
            // Vorlage: letzter Satz der Gruppe, sonst der Übung; fehlen Werte, Wdh aus dem Plan und Gewicht aus dem e1RM
            const vorlage = g.saetze.at(-1) ?? ks[ki].gruppen.flatMap((x) => x.saetze).at(-1) ?? {};
            const wdh = vorlage.wdh ?? (parseInt(g.wdhText, 10) || 5);
            const kg = vorlage.kg ?? vorschlag(ks[ki].key, wdh, g.rpe?.max ?? 8, einst.koerpergewicht);
            g.saetze.push({ ...vorlage, kg, kgPlan: vorlage.kgPlan ?? kg, wdh, id: undefined, erledigt: false, e1rm: null, pr: false, rpe: null, zeit: null, notiz: undefined, geaendert: false });
          })}>+</button>
      </span>
      <button class="link" onClick=${() => setSheet({ art: 'unotiz', ki })}>${k.notiz ? 'Notiz ändern' : 'Notiz'}</button>
      ${k.supersatz ? html`<button class="link" onClick=${() => supersatz(false)}>Supersatz lösen</button>`
        : naechste && !naechste.slot ? html`<button class="link" onClick=${() => supersatz(true)}>Supersatz mit nächster</button>` : null}
      <span class="link">Pause ${mmss(pauseVon(k.key, g0.rolle, einst.pausen))}</span>
    </div>
  </section>`;
}

// Eingabeart im Gewichts-/Wdh-Fenster: Tippen (Tastatur) oder Knöpfe; die zuletzt genutzte bleibt auf dem Gerät gemerkt
const EINGABE = 'prh-eingabe';
const eingabeTippen = () => { try { return localStorage.getItem(EINGABE) === 'tippen'; } catch { return false; } };
const merkeEingabe = (tippen) => { try { localStorage.setItem(EINGABE, tippen ? 'tippen' : 'knoepfe'); } catch { /* egal */ } };

/** Große Zahl: Tippen öffnet die Tastatur; wer danach die Knöpfe nimmt, bekommt wieder die große Anzeige. */
function GrossZahl({ id, text, setze, einheitText, ganz = false, tippen, setTippen, fertig }) {
  const feld = useRef(null);
  const [eingabe, setEingabe] = useState(text);
  useEffect(() => { if (tippen) { setEingabe(text); feld.current?.focus(); feld.current?.select(); } }, [tippen]);
  if (!tippen) return html`<button class="big big-knopf" onClick=${() => { setTippen(true); merkeEingabe(true); }} aria-label="Zahl eintippen">${text}<small>${einheitText}</small></button>`;
  return html`<label class="big big-eingabe" for=${id}><input id=${id} ref=${feld} type="text" inputmode=${ganz ? 'numeric' : 'decimal'} enterkeyhint="done" value=${eingabe}
    onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); setTimeout(() => fertig?.(), 0); } }}
    onInput=${(e) => { const v = e.currentTarget.value; setEingabe(v); const n = leseZahl(v); if (n != null) setze(ganz ? Math.max(0, Math.round(n)) : n); }}/><small>${einheitText}</small></label>`;
}

function KgSheet({ t, s: z, zu, satz, koerperKg }) {
  const k = t.karten[z.ki], g = k.gruppen[z.gi], s = g.saetze[z.si], inc = incVon(k.key), koerper = koerperUebung(k.key);
  const [kg, setKg] = useState(s.kg ?? vorschlag(k.key, s.wdh ?? (parseInt(g.wdhText, 10) || 5), g.rpe?.max ?? 8, koerperKg) ?? 0);
  const [alle, setAlle] = useState(true);
  const [tippen, setTippen] = useState(eingabeTippen);
  const knopf = (f) => { setTippen(false); merkeEingabe(false); f(); };
  const best = BEST_E1RM[k.key];
  const zielRpe = s.rpe ?? g.rpe?.max ?? 9;
  const ok = () => {
    for (let i = z.si; i < (alle ? g.saetze.length : z.si + 1); i++) {
      satz(z.ki, z.gi, i, (x) => { if (i === z.si || !x.erledigt) { x.kg = kg; x.geaendert = true; } });
    }
    zu();
  };
  return html`<${Sheet} zu=${zu} label="Gewicht">
    <div><div class="eyebrow">${koerper ? 'Zusatzgewicht' : 'Gewicht'} · Satz ${z.si + 1}</div><h2 class="h2">${nameVon(k.key)}</h2></div>
    <${GrossZahl} id="kg-zahl" text=${`${koerper && kg > 0 ? '+' : ''}${gw(kg)}`} einheitText=${einheit()} tippen=${tippen} setTippen=${setTippen} fertig=${ok}
      setze=${(n) => setKg(koerper ? inKg(n) : Math.max(0, inKg(n)))}/>
    <div class="stepper">${[-2 * inc, -inc, inc, 2 * inc].map((d) => html`<button key=${d} onClick=${() => knopf(() => setKg(koerper ? +(kg + d).toFixed(4) : Math.max(0, +(kg + d).toFixed(4))))}>${d > 0 ? '+' : '−'}${gw(Math.abs(d))}</button>`)}</div>
    ${koerper ? html`<p class="muted" style="margin:0;font-size:13.5px">Gesamtlast ${koerperKg ? gwE(koerperKg + kg) : '–'} (Körpergewicht ${koerperKg ? gwE(koerperKg) : 'fehlt – in den Einstellungen eintragen'}). Negativ = Unterstützung.</p>` : null}
    ${stangeVon(k.key) ? html`<div class="stack" style="gap:8px"><${Hantel} kg=${kg}/><div class="row between"><span class="eyebrow">Pro Seite</span><${Scheiben} kg=${kg}/></div></div>` : null}
    ${best && !koerper && lastFuerWeit(best, s.wdh, zielRpe) ? html`<p class="muted" style="margin:0;font-size:13.5px">Bestes e1RM ${gwE(best, 1)}. Das entspricht etwa <b style="color:var(--ink)">${gwE(lastFuerWeit(best, s.wdh, zielRpe, inc))} × ${s.wdh} @ RPE ${fmt(zielRpe)}</b>, darüber wird es ein Rekord.</p>` : null}
    ${!koerper && kg > 0 && s.wdh > 0 ? html`<p class="muted" style="margin:0;font-size:13.5px">Mit ${gwE(kg)} × ${s.wdh}${s.rpe != null ? ` @ RPE ${fmt(s.rpe)}` : ''}: errechnetes 1RM etwa <b style="color:var(--ink)">${gwE(e1rmWeit(kg, s.wdh, s.rpe, formel()), 1)}</b>.</p>` : null}
    ${g.saetze.length > z.si + 1 ? html`<label class="schalter" for="kg-alle"><span>Auch für die folgenden Sätze</span>
      <input type="checkbox" id="kg-alle" checked=${alle} onChange=${(e) => setAlle(e.currentTarget.checked)}/></label>` : null}
    <button class="btn btn-chalk btn-block" onClick=${ok}>Übernehmen</button>
  <//>`;
}

function WdhSheet({ t, s: z, zu, satz }) {
  const g = t.karten[z.ki].gruppen[z.gi], s = g.saetze[z.si];
  const [wdh, setWdh] = useState(Number.isFinite(s.wdh) ? s.wdh : parseInt(g.wdhText, 10) || 5);
  const [tippen, setTippen] = useState(eingabeTippen);
  const ok = () => { satz(z.ki, z.gi, z.si, (x) => { x.wdh = wdh; x.geaendert = true; }); zu(); };
  return html`<${Sheet} zu=${zu} label="Wiederholungen">
    <div class="eyebrow">Wiederholungen · Satz ${z.si + 1}</div>
    <${GrossZahl} id="wdh-zahl" text=${String(wdh)} einheitText="Wdh" ganz=${true} tippen=${tippen} setTippen=${setTippen} setze=${setWdh} fertig=${ok}/>
    <div class="stepper">${[-2, -1, 1, 2].map((d) => html`<button key=${d} onClick=${() => { setTippen(false); merkeEingabe(false); setWdh(Math.max(0, wdh + d)); }}>${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`)}</div>
    ${wdh === 0 ? html`<p class="muted" style="margin:0">0 Wdh zählt als Fehlversuch: gespeichert, aber nicht für e1RM und Volumen gewertet.</p>` : null}
    <button class="btn btn-chalk btn-block" onClick=${ok}>Übernehmen</button>
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
  const wert = rpe != null ? satzE1rm(k.key, { ...s, rpe }, koerperKg, true) : null;
  const gear = (id) => setExtra((x) => ({ ...x, gear: x.gear.includes(id) ? x.gear.filter((y) => y !== id) : [...x.gear, id] }));
  const zahl = (v) => (String(v).trim() === '' || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
  const nimm = () => {
    const alle = { ...extra, ketten: zahl(kettenText) != null ? inKg(zahl(kettenText)) : null, ms: zahl(msText) };
    const sauber = Object.fromEntries(Object.entries(alle).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));
    // Gewicht leer („–“) und RPE eingetragen: aus dem e1RM vorbelegen, ebenso die folgenden Sätze ohne Gewicht
    if (rpe != null && s.kg == null && k.key) {
      aendere((ks) => {
        const gr = ks[z.ki].gruppen[z.gi];
        for (let i = z.si; i < gr.saetze.length; i++) {
          const x = gr.saetze[i];
          if (x.kg != null || x.erledigt) continue;
          const v = vorschlag(k.key, x.wdh, rpe, koerperKg);
          if (v != null) { x.kg = v; x.kgPlan = v; }
        }
      });
    }
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
    <div class="rpe-grid knapp">
      ${[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => html`<button key=${r} aria-pressed=${String(rpe === r)} onClick=${() => setRpe(r)}>
        <b>${fmt(r)}</b><span>${r === 10 ? 'Limit' : `noch ${fmt(10 - r)}`}</span></button>`)}
      <button aria-pressed=${String(rpe == null)} onClick=${() => setRpe(null)}><b>–</b><span>ohne</span></button>
    </div>
    <div class="kv knapp">
      <div><span class="eyebrow">e1RM${koerperUebung(k.key) ? ' ges.' : ''}</span><b>${wert ? gw(wert, 1) : '–'}</b></div>
      <div><span class="eyebrow">% 1RM</span><b>${rpe != null && rtsPct(s.wdh, rpe) ? fmt(rtsPct(s.wdh, rpe) * 100, 1) : '–'}</b></div>
      <div><span class="eyebrow">Bestwert</span><b>${gw(BEST_E1RM[k.key] ?? null, 1)}</b></div>
    </div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Satztyp</span>
      <div class="chips-zeile">${SATZTYP.map(([id, text]) => html`<button key=${id} class="chip" aria-pressed=${String(typ === id)} onClick=${() => setTyp(id)}>${text}</button>`)}</div>
      ${typ === 'warmup' ? html`<span class="muted" style="font-size:12.5px">Aufwärmsätze zählen nicht ins Volumen und nicht fürs e1RM.</span>` : null}</div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Ausrüstung</span>
      <div class="chips-zeile">${AUSRUESTUNG.map(([id, text]) => html`<button key=${id} class="chip" aria-pressed=${String(extra.gear.includes(id))} onClick=${() => gear(id)}>${text}</button>`)}</div></div>
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
  const [loeschFrage, setLoeschFrage] = useState(false);
  const saetze = alleSaetze(t).filter((s) => s.erledigt);
  const tonnage = saetze.reduce((a, s) => a + (s.kg || 0) * (s.wdh || 0), 0);
  const prListe = t.karten.flatMap((k) => k.gruppen.flatMap((g) => g.saetze.filter((s) => s.erledigt && s.pr).map((s) => ({ k, s }))));
  const prs = prListe.length;
  const ende = t.bearbeiten && t.ende ? Date.parse(t.ende) : Date.now();
  return html`<${Sheet} zu=${zu} label=${t.bearbeiten ? 'Änderungen speichern' : 'Training beenden'}>
    <div class="row between" style="align-items:flex-start"><div><div class="eyebrow">${t.titel}</div><h2 class="h2">${t.bearbeiten ? 'Änderungen speichern' : 'Training beenden'}</h2></div>
      <button class="iconbtn loeschen-knopf" onClick=${() => setLoeschFrage(true)} aria-label=${t.bearbeiten ? 'Änderungen verwerfen' : 'Training löschen'}>${I.papierkorb}</button></div>
    ${loeschFrage ? html`<div class="hint" role="alertdialog" aria-label="Löschen bestätigen">${I.warn}<span class="t">${t.bearbeiten ? 'Änderungen verwerfen?' : 'Training löschen?'}</span><span></span>
      <p>${t.bearbeiten ? 'Das gespeicherte Training bleibt, wie es war.' : saetze.length === 1 ? '1 abgehakter Satz geht verloren, nichts wird gespeichert.' : `${saetze.length} abgehakte Sätze gehen verloren, nichts wird gespeichert.`}</p><span></span>
      <div class="row" style="margin-top:6px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setLoeschFrage(false)}>Abbrechen</button>
        <button class="btn btn-gefahr btn-sm" style="flex:1" onClick=${() => beenden({ verwerfen: true })}>${t.bearbeiten ? 'Verwerfen' : 'Löschen'}</button></div></div>` : null}
    <div class="kv">
      <div><span class="eyebrow">Dauer</span><b>${Math.max(1, Math.round((ende - t.start) / 60000))} min</b></div>
      <div><span class="eyebrow">Sätze</span><b>${saetze.length}</b></div>
      <div><span class="eyebrow">Volumen</span><b>${tonnageText(tonnage)}</b></div>
    </div>
    ${prs ? html`<div class="pr-ende"><div class="row"><span class="medaille">PR</span>
      <div><b>${prs} ${prs === 1 ? 'neuer Rekord' : 'neue Rekorde'}</b><div class="muted" style="font-size:13px">Landet in Rekordtafel und Statistik.</div></div></div>
      <ul>${prListe.map(({ k, s }, i) => html`<li key=${i}><span>${nameVon(k.key)}</span><b>${gwE(s.kg)} × ${s.wdh}</b><span class="muted">e1RM ${gwE(s.e1rm, 1)}</span></li>`)}</ul></div>` : null}
    <div class="stack" style="gap:8px"><span class="eyebrow">Wie anstrengend war das Training? (Session-RPE 1–10)</span>
      <div class="feel">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => html`<button key=${n} aria-pressed=${String(gefuehl === n)} onClick=${() => setGefuehl(n)}>${n}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">Daraus rechnet die Statistik die Trainingsbelastung (Session-RPE × Minuten).</span></div>
    <label class="stack" style="gap:8px" for="ende-notiz"><span class="eyebrow">Notiz</span>
      <textarea id="ende-notiz" placeholder="z. B. Knie heute gut, Bank schnell" value=${notiz} onInput=${(e) => setNotiz(e.currentTarget.value)}></textarea></label>
    <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${zu}>${t.bearbeiten ? 'Weiter ändern' : 'Weiter trainieren'}</button>
      <button class=${`btn ${saetze.length ? 'btn-go' : 'btn-gefahr'}`} style="flex:1.4" onClick=${() => beenden({ sessionRpe: gefuehl, notiz: notiz.trim() || null })}>${saetze.length ? 'Speichern' : 'Verwerfen'}</button></div>
    <p class="muted" style="margin:0;font-size:12.5px">${!saetze.length ? (t.bearbeiten ? 'Kein Satz abgehakt – die Änderungen werden verworfen, das gespeicherte Training bleibt.' : 'Kein Satz abgehakt – das Training wird nicht gespeichert.')
      : t.bearbeiten ? 'Ersetzt das gespeicherte Training, auf dem Handy sofort und auf dem Server beim nächsten Abgleich.'
      : 'Das Training wird sofort auf dem Handy gesichert und hochgeladen, sobald Netz da ist.'}</p>
  <//>`;
}
