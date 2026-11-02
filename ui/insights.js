// PR Hunter · Insights wie in Jefit (Wunsch 181): Analyse-Karten in der Statistik. Rechnungen in js/insights.js.
import { html, useMemo, useState } from '../vendor/htm-preact.js';
import { fmt, gw, einheit, nameVon, UebungsBild, datumKurz, deEn, sprache, uebung, pauseVon, I } from './basis.js';
import { normiere, serie, einheitAnalyse, einsRmAnalyse, saetzeJeMuskel, wochenVergleich, zeitAnalyse, minuten, IDEAL, MUSTER, bewegungsmuster, bewegungsmusterSchnitt, montagVon } from '../js/insights.js';
import { kanon, plusTage } from '../js/daten.js';
import { MiniFigur } from './koerper.js';

const GRUPPE_NAME = { brust: 'Brust', ruecken: 'Rücken', schultern: 'Schultern', bizeps: 'Bizeps', trizeps: 'Trizeps', unterarme: 'Unterarme',
  beine: 'Oberschenkel', gesaess: 'Gesäß', waden: 'Waden', bauch: 'Bauch' };
const GRUPPE_ZONEN = { brust: ['brust'], ruecken: ['latissimus', 'oberer_ruecken', 'ruecken_unten', 'trapez'], schultern: ['schulter_vorn', 'schulter_seite', 'schulter_hinten'],
  bizeps: ['bizeps'], trizeps: ['trizeps'], unterarme: ['unterarme'], beine: ['quadrizeps', 'beinbeuger', 'adduktoren'], gesaess: ['gesaess'], waden: ['waden'], bauch: ['bauch'] };
const STUFE = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch' };
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONAT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const hm = (min) => (min == null ? '–' : min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.round(min)} min`);
const hms = (sek) => { const s = Math.round(sek); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const kurz = (kg) => (kg >= 1000 ? `${fmt(kg / 1000, kg >= 10000 ? 0 : 1)}k` : fmt(kg, 0));
const GRUPPE_EN = { brust: 'Chest', ruecken: 'Back', schultern: 'Shoulders', bizeps: 'Biceps', trizeps: 'Triceps', unterarme: 'Forearms',
  beine: 'Upper legs', gesaess: 'Glutes', waden: 'Calves', bauch: 'Abs' };
const namen = (liste) => { const n = liste.map((x) => (sprache() === 'en' ? GRUPPE_EN : GRUPPE_NAME)[x.gruppe]); return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} ${deEn('und', 'and')} ${n.at(-1)}`; };

function Kopf({ titel, unter }) {
  return html`<div class="ins-kopf"><b>${titel}</b> <span class="ins-analyse">Analyse</span>${unter ? html`<div class="ins-unter">${unter}</div>` : null}</div>`;
}

export function Insights({ trainings, einst, heute }) {
  const E = useMemo(() => normiere(trainings), [trainings]);
  const muskelnVon = (k) => uebung(k)?.m ?? [];
  const pause = (k) => pauseVon(k, null, einst.pausen);
  if (!E.length) return html`<section class="card pad"><p class="muted" style="margin:0">Noch keine Trainings – nach dem ersten Training stehen hier deine Analysen.</p></section>`;
  const s = serie(E, heute), a = einheitAnalyse(E, heute, { muskelnVon, pauseVon: pause }), r = einsRmAnalyse(E, heute),
    m = saetzeJeMuskel(E, heute, muskelnVon), w = wochenVergleich(E, heute, { abgeschlossen: true });
  const letzte5 = E.filter((e) => minuten(e) != null).slice(-5).reverse().map((e) => ({ e, z: zeitAnalyse(e, pause) }));
  return html`<div class="stack insights" style="gap:12px">
    <${SerieKarte} s=${s}/>
    ${a ? html`<${EinheitKarte} a=${a}/>` : null}
    ${r.anzahl ? html`<${EinsRmKarte} r=${r}/>` : null}
    ${m.liste.length ? html`<${MuskelKarte} m=${m}/>` : null}
    <${MusterKarte} E=${E} heute=${heute}/>
    ${a?.zeit ? html`<${ZeitKarte} z=${a.zeit} e=${a.einheit} letzte=${letzte5}/>` : null}
    <${WocheKarte} w=${w}/>
  </div>`;
}

// ---------- a) Trainings-Serie ----------
function SerieKarte({ s }) {
  const en = sprache() === 'en';
  const max14 = Math.max(30, ...s.zeit14.map((x) => x.min));
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Trainings-Serie" unter="Aktuell"/>
    ${s.wochen ? html`<p class="ins-text">${deEn(`${s.wochen >= s.laengste && s.wochen > 1 ? 'Stark – neuer Rekord: ' : ''}${s.wochen} ${s.wochen === 1 ? 'Woche' : 'Wochen'} in Folge trainiert!`, `${s.wochen >= s.laengste && s.wochen > 1 ? 'Boom – new record: ' : ''}${s.wochen} ${s.wochen === 1 ? 'week' : 'weeks'} in a row!`)}</p>
      <p class="ins-text klein">${deEn(`Im Schnitt ${fmt(s.tageProWoche, 1)} Tage pro Woche aktiv${s.minutenSchnitt ? `, ${Math.round(s.minutenSchnitt)} Minuten je Training` : ''} und ${fmt(s.rekordeProWoche, 1)} Rekorde pro Woche.`,
        `On average active ${fmt(s.tageProWoche, 1)} days a week${s.minutenSchnitt ? `, ${Math.round(s.minutenSchnitt)} minutes per workout` : ''} and ${fmt(s.rekordeProWoche, 1)} records a week.`)}</p>`
      : html`<p class="ins-text">Diese Woche trainieren und eine neue Serie starten.</p>`}
    <div class="ins-serie"><span class="ins-flamme" aria-hidden="true">🔥</span><b class="zahl">${s.wochen}</b><span>${deEn(s.wochen === 1 ? 'Woche Serie' : 'Wochen Serie', s.wochen === 1 ? 'week streak' : 'week streak')}</span></div>
    <div class="ins-zwei drei"><div><span class="muted">Trainingstage</span><b>${s.gesamt.tage}</b><small class="muted">insgesamt</small></div>
      <div><span class="muted">Stunden</span><b>${`${s.gesamt.geschaetzt ? '≈' : ''}${fmt(s.gesamt.stunden, 0)}`}</b><small class="muted">insgesamt</small></div>
      <div><span class="muted">Längste Serie</span><b>${deEn(`${s.laengste} Wo.`, `${s.laengste} wk`)}</b><small class="muted">am Stück</small></div></div>
    <div class="ins-raster">
      <span></span>${(en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'D', 'M', 'D', 'F', 'S', 'S']).map((t, i) => html`<span key=${i} class="ins-wt">${t}</span>`)}
      ${s.raster.map((wo, i) => {
        const neuerMonat = i === 0 || wo.montag.slice(5, 7) !== s.raster[i - 1].montag.slice(5, 7);
        return html`<span key=${wo.montag} class="ins-monat">${neuerMonat ? (en ? MONAT_EN : MONAT)[Number(wo.montag.slice(5, 7)) - 1] : ''}</span>
          ${wo.tage.map((t) => html`<i key=${t.datum} class=${`ins-tag s${t.stufe} ${t.zukunft ? 'zukunft' : ''}`} title=${datumKurz(t.datum)}></i>`)}`;
      })}
    </div>
    <div class="ins-trenner"></div>
    <b class="ins-titel">Trainingszeit <span class="muted">der letzten 2 Wochen</span></b>
    <svg class="ins-balken14" viewBox="0 0 280 120" role="img" aria-label="Trainingszeit je Tag">
      ${[0, 0.5, 1].map((f) => html`<text key=${f} x="0" y=${100 - f * 90 + 3} class="ins-achse">${f ? hm(max14 * f) : '0'}</text>`)}
      ${s.zeit14.map((x, i) => { const h = (x.min / max14) * 90; const bx = 52 + i * 16;
        return html`<rect key=${x.datum} x=${bx} y=${x.min ? 100 - h : 98} width="9" height=${x.min ? h : 2} rx="4" class=${x.min ? 'ins-bar' : 'ins-bar leer'}/>`; })}
    </svg>
    ${s.top.length ? html`<b class="ins-titel">Top 3 Übungen</b>
      <div class="ins-top">${s.top.map((t, i) => html`<div key=${t.key} class="ins-top-zeile"><span class="ins-rang">${i + 1}</span><${UebungsBild} schluessel=${t.key} groesse=${40}/>
        <span><b>${nameVon(t.key)}</b><small>${deEn(`${t.n}×`, `${t.n} times`)}</small></span></div>`)}</div>` : null}
  </section>`;
}

// ---------- b) Letzte Einheit ----------
function Halbkreis({ wert }) {
  const r = 70, cx = 90, cy = 86, bogen = (von, bis) => {
    const p = (f) => [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
    const [x1, y1] = p(von), [x2, y2] = p(bis);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const f = Math.max(0, Math.min(1, wert / 100)), [px, py] = [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
  const name = wert < 40 ? 'Leichtes Training' : wert < 60 ? 'Fortschritt' : wert < 80 ? 'Optimal' : 'Stark';
  return html`<svg class="ins-halbkreis" viewBox="0 0 180 110" role="img" aria-label=${`Trainings-Score ${wert}`}>
    <path d=${bogen(0, 1)} class="ins-bogen-grund"/>
    <path d=${bogen(0.02, 0.22)} class="ins-bogen b1"/><path d=${bogen(0.27, 0.73)} class="ins-bogen b2"/><path d=${bogen(0.78, 0.98)} class="ins-bogen b3"/>
    <circle cx=${px} cy=${py} r="7" class="ins-zeiger"/>
    <text x=${cx} y=${cy - 8} text-anchor="middle" class="ins-score">${wert}</text>
    <text x=${cx} y=${cy + 14} text-anchor="middle" class="ins-score-name">${name}</text>
  </svg>`;
}
function Regler({ titel, stufe, wert, farbe, text }) {
  return html`<div class="ins-regler" style=${`--rf:${farbe}`}>
    <div class="row between"><b>${titel}</b><span class="ins-stufe">${STUFE[stufe]}</span></div>
    <div class="ins-spur"><i style=${`left:${Math.round(wert * 100)}%`}></i></div>
    <p class="muted">${text}</p></div>`;
}
function EinheitKarte({ a }) {
  const iText = { niedrig: 'Leichtes Training – eine gute Grundlage. Für mehr Reiz Gewicht oder Sätze steigern.', mittel: 'Solide Anstrengung, gut für stetigen Fortschritt.', hoch: 'Hohe Intensität – auf genug Erholung achten.' }[a.intensitaet.stufe];
  const eText = a.erholung.belastet ? deEn(`${a.erholung.belastet} der trainierten Muskelgruppen waren in den 2 Tagen davor schon dran.`, `${a.erholung.belastet} of the trained muscle groups were already worked in the 2 days before.`)
    : 'Alle Muskeln waren vor dem Training ausreichend erholt.';
  const zText = a.zeit ? (a.zeit.ungenutzt > 60 ? deEn(`Etwa ${fmt(a.zeit.mehrPauseJeSatz / 60, 1)} min mehr geplante Pause je Satz oder ${hm(a.zeit.ungenutzt / 60)} weniger Leerlauf würden die Zeit besser nutzen.`,
    `About ${fmt(a.zeit.mehrPauseJeSatz / 60, 1)} min more planned rest per set or ${hm(a.zeit.ungenutzt / 60)} less idle time would use the time better.`) : 'Die Trainingszeit war gut genutzt.') : null;
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Trainingseinheit" unter=${deEn(`Training vom ${datumKurz(a.einheit.datum)}`, `Workout of ${datumKurz(a.einheit.datum)}`)}/>
    <p class="ins-text akzent">${deEn(`Diese Woche ${a.woche.anzahl} ${a.woche.anzahl === 1 ? 'Training' : 'Trainings'}, zusammen ${hm(a.woche.minuten)}.`, `This week ${a.woche.anzahl} ${a.woche.anzahl === 1 ? 'workout' : 'workouts'}, ${hm(a.woche.minuten)} in total.`)}</p>
    <b class="ins-titel">Im Fokus</b>
    ${a.muskeln.slice(0, 5).map((x) => html`<div key=${x.gruppe} class="ins-muskel">
      <b class="ins-gross">${GRUPPE_NAME[x.gruppe]}</b>
      <div class="ins-muskel-zeile"><${MiniFigur} zonen=${GRUPPE_ZONEN[x.gruppe] ?? []}/>
        <div class="ins-vier"><div><span>Volumen</span><b>${kurz(x.volumen)}</b></div><div><span>Sätze</span><b>${x.saetze}</b></div>
          <div><span>Min</span><b>${Math.round(x.minuten)}</b></div><div><span>Rekorde</span><b>${x.rekorde}</b></div></div></div></div>`)}
    <b class="ins-titel">Trainings-Score</b>
    <${Halbkreis} wert=${a.score}/>
    <${Regler} titel="Intensität" stufe=${a.intensitaet.stufe} wert=${a.intensitaet.wert} farbe="#FF8A5C" text=${iText}/>
    <${Regler} titel="Erholung" stufe=${a.erholung.stufe} wert=${a.erholung.wert} farbe="#34C77B" text=${eText}/>
    ${a.nutzung ? html`<${Regler} titel="Zeitnutzung" stufe=${a.nutzung.stufe} wert=${a.nutzung.wert} farbe="#3BA7F0" text=${zText}/>` : null}
  </section>`;
}

// ---------- c) 1RM ----------
function EinsRmKarte({ r }) {
  const max = Math.max(1, ...r.proTag.map((x) => Math.abs(x.diff)));
  const medaille = ['🥇', '🥈', '🥉'];
  return html`<section class="card pad stack ins">
    <${Kopf} titel="1RM" unter="Letzte 7 Tage"/>
    <p class="ins-text">${r.summe >= 0 ? 'Fortschritt! Deine 1RM-Veränderung der letzten 7 Tage:' : 'Fortschritt ist nicht immer gerade. Deine 1RM-Veränderung der letzten 7 Tage:'}</p>
    <b class=${`ins-gross-zahl ${r.summe >= 0 ? 'auf' : 'ab'}`}>${`${r.summe > 0 ? '+' : r.summe < 0 ? '−' : ''}${gw(Math.abs(r.summe), 1)}`}<small>${einheit()}</small></b>
    <svg class="ins-1rm" viewBox="0 0 280 100" role="img" aria-label="1RM-Veränderung je Tag">
      <line x1="0" x2="280" y1="50" y2="50" class="ins-null"/>
      ${r.proTag.map((x, i) => { const h = (Math.abs(x.diff) / max) * 42, bx = 10 + i * 38;
        return html`<g key=${x.datum}>${x.diff ? html`<rect x=${bx} y=${x.diff > 0 ? 50 - h : 50} width="18" height=${Math.max(2, h)} rx="4" class=${x.diff > 0 ? 'ins-bar' : 'ins-bar ab'}/>` : html`<circle cx=${bx + 9} cy="50" r="2.5" class="ins-punkt-leer"/>`}
          <text x=${bx + 9} y="98" text-anchor="middle" class="ins-achse">${datumKurz(x.datum).slice(0, 5)}</text></g>`; })}
    </svg>
    ${r.top.length ? html`<b class="ins-titel">Top 3 mit dem größten Zuwachs</b>
      ${r.top.map((t, i) => html`<div key=${t.key} class="ins-gewinn"><span class="ins-medaille">${medaille[i]}</span><${UebungsBild} schluessel=${t.key} groesse=${40}/>
        <div><div class="row between"><b class="ins-link">${nameVon(t.key)}</b><span class="ins-prozent">▲ ${fmt(t.prozent, 0)} %</span></div>
          <small>${deEn(`Neues 1RM: ${gw(t.neu.wert, 1)} ${einheit()}, ${datumKurz(t.neu.datum)}`, `New best 1RM: ${gw(t.neu.wert, 1)} ${einheit()}, ${datumKurz(t.neu.datum)}`)}</small>
          <small class="muted">${deEn(`Vorher: ${gw(t.vorher.wert, 1)} ${einheit()}, ${datumKurz(t.vorher.datum)}`, `Previous best: ${gw(t.vorher.wert, 1)} ${einheit()}, ${datumKurz(t.vorher.datum)}`)}</small></div></div>`)}` : null}
  </section>`;
}

// ---------- d) Sätze je Muskel ----------
function MuskelKarte({ m }) {
  const max = Math.max(IDEAL[1] + 6, ...m.liste.map((x) => x.saetze));
  const y = (v) => 110 - (v / max) * 100, n = m.liste.length, bw = Math.min(30, 230 / n - 8);
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Sätze je Muskel" unter="Letzte 7 Tage"/>
    <p class="ins-text">${m.erreicht.length ? deEn(`Gut! Idealbereich bei ${m.erreicht.length} ${m.erreicht.length === 1 ? 'Muskelgruppe' : 'Muskelgruppen'} erreicht.`, `Well done! Ideal range reached for ${m.erreicht.length} ${m.erreicht.length === 1 ? 'muscle group' : 'muscle groups'}.`)
      : 'Noch keine Muskelgruppe im Idealbereich.'}${m.unter.length ? deEn(' Bring noch', ' Work on getting your') : ''}</p>
    ${m.unter.length ? html`<b class="ins-gross verlauf">${namen(m.unter.slice(0, 3))}</b><p class="ins-text klein">${deEn(`auf ${IDEAL[0]}–${IDEAL[1]} harte Sätze pro Woche, um sie wirksam zu trainieren.`, `to ${IDEAL[0]}–${IDEAL[1]} hard sets a week to train them effectively.`)}</p>` : null}
    <svg class="ins-muskeln" viewBox="0 0 280 150" role="img" aria-label="Sätze je Muskelgruppe">
      <rect x="30" y=${y(IDEAL[1])} width="250" height=${y(IDEAL[0]) - y(IDEAL[1])} class="ins-ideal"/>
      <text x="278" y=${y(IDEAL[1]) - 4} text-anchor="end" class="ins-ideal-text">Ideal</text>
      ${[0, IDEAL[0], IDEAL[1]].map((v) => html`<text key=${v} x="0" y=${y(v) + 3} class="ins-achse">${v}</text>`)}
      ${m.liste.map((x, i) => { const bx = 40 + i * (240 / n);
        return html`<g key=${x.gruppe}><rect x=${bx} y=${y(x.saetze)} width=${bw} height=${110 - y(x.saetze)} rx="6" class=${`ins-bar ${x.saetze >= IDEAL[0] && x.saetze <= IDEAL[1] ? 'gut' : x.saetze > IDEAL[1] ? 'viel' : ''}`}/>
          <text x=${bx + bw / 2} y=${y(x.saetze) - 4} text-anchor="middle" class="ins-wert">${x.saetze}</text>
          <text x=${bx + bw / 2} y="126" text-anchor="end" transform=${`rotate(-40 ${bx + bw / 2} 126)`} class="ins-achse">${GRUPPE_NAME[x.gruppe]}</text></g>`; })}
    </svg>
  </section>`;
}

// ---------- g) Bewegungsmuster (Sechseck + Drücken/Ziehen je Tag) ----------
const MUSTER_NAME = { squat: ['Kniebeuge', 'Squat'], vPush: ['Drücken vert.', 'V. Push'], hPull: ['Ziehen horiz.', 'H. Pull'],
  hinge: ['Hip Hinge', 'Hinge'], vPull: ['Ziehen vert.', 'V. Pull'], hPush: ['Drücken horiz.', 'H. Push'] };
const DRUECKEN = '#7B61FF', ZIEHEN = '#AEB4FF';
const verhaeltnis = (a, b) => (a + b ? `${a} : ${b}` : '–');

function MusterKarte({ E, heute }) {
  const [art, setArt] = useState('woche');                                // 'woche' | 'schnitt' (Ø je Trainingswoche, ganzer Verlauf)
  const [zurueck, setZurueck] = useState(1);                              // 1 = letzte volle Woche (Start), 0 = laufende Woche
  const artVon = (k) => uebung(k)?.f ?? uebung(kanon(k))?.f;
  const erste = E.length ? montagVon(E[0].datum) : montagVon(heute);
  const montag = plusTage(montagVon(heute), -7 * zurueck);
  const b = art === 'schnitt' ? bewegungsmusterSchnitt(E, artVon) : bewegungsmuster(E, montag, artVon);
  const titel = zurueck === 0 ? deEn('Diese Woche (läuft)', 'This week (ongoing)') : zurueck === 1 ? deEn('Letzte Woche', 'Last week') : `${datumKurz(montag)}–${datumKurz(plusTage(montag, 6))}`;
  const z = (x) => (art === 'schnitt' ? fmt(x, 1) : String(x));
  const verh = (a, c) => (a + c ? `${z(a)} : ${z(c)}` : '–');
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Bewegungsmuster" unter=${art === 'schnitt' ? 'Ø Sätze je Trainingswoche' : 'Sätze je Muster'}/>
    <div class="filter" role="group" aria-label="Zeitraum">
      <button class="chip" aria-pressed=${String(art === 'woche')} onClick=${() => setArt('woche')}>Woche</button>
      <button class="chip" aria-pressed=${String(art === 'schnitt')} onClick=${() => setArt('schnitt')}>Ø gesamt</button></div>
    ${art === 'woche' ? html`<div class="row between mu-woche">
        <button class="iconbtn klein" disabled=${montag <= erste} onClick=${() => setZurueck(zurueck + 1)} aria-label="Woche zurück"><span style="display:inline-block;transform:rotate(180deg)">${I.weiter}</span></button>
        <span class="mu-woche-titel"><b>${titel}</b>${zurueck <= 1 ? html`<small class="muted">${`${datumKurz(montag)}–${datumKurz(plusTage(montag, 6))}`}</small>` : null}</span>
        <button class="iconbtn klein" disabled=${zurueck === 0} onClick=${() => setZurueck(zurueck - 1)} aria-label="Woche vor">${I.weiter}</button></div>`
      : html`<span class="muted mu-woche-text">${deEn(`Durchschnitt über ${b.wochen} Wochen mit Training`, `Average over ${b.wochen} weeks with training`)}</span>`}
    <div class="ins-zwei drei"><div><span class="muted">Drücken : Ziehen</span><b>${verh(b.push, b.pull)}</b></div>
      <div><span class="muted">Ober : Unter</span><b>${verh(b.ober, b.unter)}</b></div>
      <div><span class="muted">Sätze</span><b>${b.gesamt ? z(b.gesamt) : '–'}</b></div></div>
    ${art === 'woche' && !b.gesamt ? html`<p class="muted" style="margin:0;font-size:13px">${zurueck === 0 ? 'Diese Woche noch keine Sätze.' : 'In dieser Woche keine Sätze.'}</p>` : null}
    <${Sechseck} summe=${b.summe} z=${z}/>
    <${PaarBalken} titel="Vertikal: Drücken vs. Ziehen" tage=${b.tage} a="vPush" b="vPull" heute=${art === 'woche' ? heute : null}/>
    <${PaarBalken} titel="Horizontal: Drücken vs. Ziehen" tage=${b.tage} a="hPush" b="hPull" heute=${art === 'woche' ? heute : null}/>
  </section>`;
}

/** Netzdiagramm: Achsen je Muster, Fläche = Sätze (am größten Wert gemessen, mindestens 10). */
function Sechseck({ summe, z = String }) {
  const en = sprache() === 'en', M = 150, r = 66, max = Math.max(10, ...MUSTER.map((m) => summe[m]));
  const punkt = (i, f) => { const w = (-90 + i * 60) * Math.PI / 180; return [M + Math.cos(w) * r * f, 118 + Math.sin(w) * r * f]; };
  const ring = (f) => MUSTER.map((_, i) => punkt(i, f).join(',')).join(' ');
  const flaeche = MUSTER.map((m, i) => punkt(i, summe[m] / max).join(',')).join(' ');
  const hat = MUSTER.some((m) => summe[m] > 0);
  return html`<svg class="ins-sechseck" viewBox="0 0 300 236" role="img" aria-label="Bewegungsmuster">
    ${[1 / 3, 2 / 3, 1].map((f) => html`<polygon key=${f} points=${ring(f)} class="ins-netz"/>`)}
    ${MUSTER.map((_, i) => { const [x, y] = punkt(i, 1); return html`<line key=${i} x1=${M} y1="118" x2=${x} y2=${y} class="ins-netz"/>`; })}
    ${hat ? html`<polygon points=${flaeche} class="ins-netz-wert"/>` : null}
    ${MUSTER.map((m, i) => { const [x, y] = punkt(i, 1.13), anker = Math.abs(x - M) < 5 ? 'middle' : x > M ? 'start' : 'end';
      const oben = i === 0 ? -14 : i === 3 ? 6 : -3;
      return html`<text key=${m} x=${x} y=${y + oben} text-anchor=${anker} class="ins-netz-text" translate="no">${MUSTER_NAME[m][en ? 1 : 0]}
        <tspan x=${x} dy="14" class="ins-netz-zahl">${summe[m] ? z(summe[m]) : '–'}</tspan></text>`; })}
  </svg>`;
}

/** Zwei Balken je Wochentag (Drücken, Ziehen) auf grauer Spur, Achse 0 / Mitte / Maximum (mindestens 20). */
function PaarBalken({ titel, tage, a, b, heute }) {
  const en = sprache() === 'en', groesst = Math.max(...tage.flatMap((t) => [t[a], t[b]])), max = groesst <= 10 && groesst > 0 && !Number.isInteger(groesst) ? 10 : Math.ceil(Math.max(20, groesst) / 10) * 10;
  const H = 96, y = (v) => 8 + H - (v / max) * H, WT = en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  return html`<div class="stack" style="gap:6px">
    <b class="ins-paar-titel">${titel}</b>
    <div class="row mu-legende"><span><i style=${`background:${DRUECKEN}`}></i>${deEn('Drücken', 'Push')}</span><span><i style=${`background:${ZIEHEN}`}></i>${deEn('Ziehen', 'Pull')}</span></div>
    <svg class="ins-paar" viewBox="0 0 300 130" role="img" aria-label=${titel}>
      ${[0, max / 2, max].map((v) => html`<g key=${v}><line x1="8" x2="262" y1=${y(v)} y2=${y(v)} class=${v ? 'ins-hilfslinie' : 'ins-grundlinie'}/>
        <text x="296" y=${y(v) + 4} text-anchor="end" class="ins-achse">${v}</text></g>`)}
      ${tage.map((t, i) => { const x = 20 + i * 35;
        return html`<g key=${t.datum}>
          ${[[a, DRUECKEN, 0], [b, ZIEHEN, 12]].map(([k, farbe, d]) => html`<rect key=${k} x=${x + d} y="8" width="8" height=${H} rx="4" class="mu-spur"/>
            ${t[k] ? html`<rect x=${x + d} y=${y(t[k])} width="8" height=${8 + H - y(t[k])} rx="4" style=${`fill:${farbe}`}/>` : null}`)}
          <text x=${x + 10} y="126" text-anchor="middle" class=${`ins-achse ${t.datum === heute ? 'ins-heute' : ''}`}>${WT[i]}</text></g>`; })}
    </svg>
  </div>`;
}

// ---------- e) Trainingszeit ----------
const TEILE = [['aktiv', 'Aktiv', '#7B61FF'], ['pause', 'Pause', '#AEB4FF'], ['laden', 'Laden', '#2F5BD3'], ['ungenutzt', 'Ungenutzt', '#E0786A']];
function Ring({ z }) {
  const r = 60, C = 2 * Math.PI * r;
  let off = 0;
  return html`<svg class="ins-ring" viewBox="0 0 160 160" role="img" aria-label="Aufteilung der Trainingszeit">
    ${TEILE.map(([k, , f]) => { const l = (z[k] / z.gesamt) * C; const el = html`<circle key=${k} cx="80" cy="80" r=${r} fill="none" stroke=${f} stroke-width="22" stroke-dasharray=${`${l} ${C - l}`} stroke-dashoffset=${-off} transform="rotate(-90 80 80)"/>`; off += l; return el; })}
    <text x="80" y="85" text-anchor="middle" class="ins-ring-zeit">${hms(z.gesamt)}</text>
  </svg>`;
}
function ZeitKarte({ z, e, letzte }) {
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Trainingszeit" unter=${deEn(`Training vom ${datumKurz(e.datum)}`, `Workout of ${datumKurz(e.datum)}`)}/>
    <p class="ins-text">${z.nutzung < 0.75 ? deEn(`Eine Zeitnutzung von ${Math.round(z.nutzung * 100)} % – vermutlich längere Pausen als geplant. Mit etwa ${fmt(z.mehrPauseJeSatz / 60, 1)} min mehr Pause je Satz wäre die Zeit voll genutzt.`,
      `A time utilization of ${Math.round(z.nutzung * 100)} % – probably longer rests than planned. About ${fmt(z.mehrPauseJeSatz / 60, 1)} min more rest per set would use the time fully.`)
      : deEn(`Starke ${Math.round(z.nutzung * 100)} % Zeitnutzung – kaum Leerlauf.`, `Strong ${Math.round(z.nutzung * 100)} % time utilization – hardly any idle time.`)}</p>
    <div class="ins-zwei"><div><span class="muted">Zeitnutzung</span><b class="ins-prozent-gross">${fmt(z.nutzung * 100, 1)}<small>%</small></b></div>
      <div><span class="muted">Ungenutzt</span><b class="ins-prozent-gross">${fmt((1 - z.nutzung) * 100, 1)}<small>%</small></b></div></div>
    <div class="ins-ring-zeile"><${Ring} z=${z}/><div class="ins-legende">${TEILE.map(([k, n, f]) => html`<span key=${k}><i style=${`background:${f}`}></i>${n}</span>`)}</div></div>
    ${letzte.length > 1 ? html`<b class="ins-titel">Letzte ${letzte.length} Trainings</b>
      ${letzte.map(({ e: x, z: y }) => html`<div key=${x.datum + (x.start ?? '')} class="ins-stapel">
        <div class="ins-stapel-balken">${TEILE.map(([k, , f]) => html`<i key=${k} style=${`width:${(y[k] / y.gesamt) * 100}%;background:${f}`}></i>`)}</div>
        <small class="muted">${deEn(`Gesamt ${hms(y.gesamt)} · ${datumKurz(x.datum)}`, `Total ${hms(y.gesamt)} · ${datumKurz(x.datum)}`)}</small></div>`)}` : null}
  </section>`;
}

// ---------- f) Wochenvergleich ----------
function WocheKarte({ w }) {
  const zeile = (titel, a, b, fmtWert, einheitText, mehr, weniger) => {
    const max = Math.max(a, b, 1), auf = a > b, gleich = a === b;
    return html`<div class="ins-woche">
      <b class="ins-titel">${titel}</b>
      <div class="row between"><b class="ins-gross-zahl">${fmtWert(a)}<small>${einheitText}</small></b><span class=${`ins-pfeil ${gleich ? '' : auf ? 'auf' : 'ab'}`} aria-hidden="true">${gleich ? '=' : `${auf ? '▲ +' : '▼ −'}${fmtWert(Math.abs(a - b))}`}</span></div>
      <div class="ins-vergleich"><span class="diese" style=${`--w:${(a / max) * 100}%`}><b>Letzte Woche</b><b>${fmtWert(a)}${einheitText ? ` ${einheitText}` : ''}</b></span>
        <span class="letzte" style=${`--w:${(b / max) * 100}%`}><b>Woche davor</b><b>${fmtWert(b)}${einheitText ? ` ${einheitText}` : ''}</b></span></div>
      <small class="ins-satz">${gleich ? 'Gleich wie die Woche davor' : auf ? mehr(a - b) : weniger(b - a)}</small></div>`;
  };
  const d = w.diese, l = w.letzte;
  return html`<section class="card pad stack ins">
    <${Kopf} titel="Wochenvergleich" unter="Letzte Woche gegen die Woche davor"/>
    ${w.abgeschlossen ? html`<p class="ins-hinweis">${I.tabVerlauf}<span>${deEn(`Letzte volle Woche (${datumKurz(w.von)}–${datumKurz(w.bis)}). Die laufende Woche kommt hier dazu, sobald sie vorbei ist.`,
      `Last full week (${datumKurz(w.von)}–${datumKurz(w.bis)}). The current week shows up here once it is over.`)}</span></p>` : null}
    ${zeile('Trainings', d.einheiten, l.einheiten, (x) => String(x), '', (x) => deEn(`${x} mehr als die Woche davor`, `${x} more than the week before`), (x) => deEn(`${x} weniger als die Woche davor`, `${x} fewer than the week before`))}
    ${zeile('1RM-Rekorde', d.rekorde, l.rekorde, (x) => String(x), '', (x) => deEn(`${x} mehr als die Woche davor`, `${x} more than the week before`), (x) => deEn(`${x} weniger als die Woche davor`, `${x} fewer than the week before`))}
    ${zeile('Ø Volumen je Training', d.volumen, l.volumen, (x) => fmt(x, 0), einheit(), (x) => deEn(`${fmt(x, 0)} ${einheit()} mehr als die Woche davor`, `${fmt(x, 0)} ${einheit()} more than the week before`), (x) => deEn(`${fmt(x, 0)} ${einheit()} weniger als die Woche davor`, `${fmt(x, 0)} ${einheit()} less than the week before`))}
    ${d.minuten || l.minuten ? zeile('Ø Trainingsdauer', d.minuten, l.minuten, (x) => hm(x), '', (x) => deEn(`${Math.round(x)} Minuten mehr als die Woche davor`, `${Math.round(x)} minutes more than the week before`), (x) => deEn(`${Math.round(x)} Minuten weniger als die Woche davor`, `${Math.round(x)} minutes less than the week before`)) : null}
  </section>`;
}
