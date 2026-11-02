// PR Hunter · Timer im Rechner (Wunsch 164): Stoppuhr, Countdown und Intervall-Timer (Arbeit/Pause/Runden,
// z. B. Tabata, EMOM). Großer Ring, Farbe je Phase, Ton + Vibration beim Wechsel, Mitteilung, wenn die App im
// Hintergrund ist. Gerechnet wird aus Zeitstempeln (läuft also beim Sperren weiter); Zustand und eigene
// Vorlagen liegen auf dem Gerät.
import { html, useState, useEffect, useRef, useTakt, mmss, piep, vibriere, tonFreigeben, speicher, ZahlFeld } from './basis.js';
import * as mitteilung from './mitteilung.js';

const SCHLUESSEL = 'prh-timer', VORLAGEN = 'prh-timer-vorlagen';
const VORLAUF = 5;           // s „Bereit“ vor dem Intervall
const FEST = [
  { name: 'Tabata', arbeit: 20, pause: 10, runden: 8 },
  { name: 'EMOM 10', arbeit: 60, pause: 0, runden: 10 },
  { name: '40/20 × 10', arbeit: 40, pause: 20, runden: 10 },
  { name: '30/30 × 12', arbeit: 30, pause: 30, runden: 12 },
];
const lies = (k, s) => { try { return JSON.parse(speicher.lies(k)) ?? s; } catch { return s; } };

/** Laufzeit in ms aus dem Zustand (ohne Pausen). */
const vergangen = (z, jetzt = Date.now()) => (z.start == null ? 0 : (z.angehalten ?? jetzt) - z.start - (z.versatz ?? 0));

/** Phase des Intervall-Timers bei e ms: { phase: bereit|arbeit|pause|fertig, runde, rest (s), anteil }. */
export function intervallPhase({ arbeit, pause, runden }, e) {
  const s = e / 1000;
  if (s < VORLAUF) return { phase: 'bereit', runde: 1, rest: VORLAUF - s, anteil: 1 - s / VORLAUF };
  const t = s - VORLAUF, zyklus = arbeit + pause;
  const runde = Math.floor(t / zyklus);
  if (runde >= runden) return { phase: 'fertig', runde: runden, rest: 0, anteil: 0 };
  const im = t - runde * zyklus;
  return im < arbeit ? { phase: 'arbeit', runde: runde + 1, rest: arbeit - im, anteil: 1 - im / arbeit }
    : { phase: 'pause', runde: runde + 1, rest: zyklus - im, anteil: 1 - (im - arbeit) / pause };
}

const PHASE_TEXT = { bereit: 'Bereit', arbeit: 'Arbeit', pause: 'Pause', fertig: 'Fertig', countdown: 'Countdown', stoppuhr: 'Stoppuhr' };

function Ring({ anteil, farbe, gross, klein }) {
  const C = 2 * Math.PI * 88;
  return html`<div class="t-ring" style=${`--pc:${farbe}`}>
    <svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="12"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--pc)" stroke-width="12" stroke-linecap="round" stroke-dasharray=${C}
        stroke-dashoffset=${C * (1 - Math.max(0, Math.min(1, anteil)))} transform="rotate(-90 100 100)" style="transition:stroke-dashoffset .25s linear"/></svg>
    <div class="t-mitte"><b class="tab-num">${gross}</b><span>${klein}</span></div>
  </div>`;
}

export function Timer() {
  const [z, setZRoh] = useState(() => lies(SCHLUESSEL, { modus: 'intervall', arbeit: 20, pause: 10, runden: 8, countdown: 60, start: null, angehalten: null, versatz: 0 }));
  const [eigene, setEigene] = useState(() => lies(VORLAGEN, []));
  const setZ = (n) => { setZRoh(n); speicher.schreib(SCHLUESSEL, JSON.stringify(n)); };
  const laeuft = z.start != null && z.angehalten == null;
  useTakt(laeuft, 200);
  const e = vergangen(z);
  const ph = z.modus === 'intervall' ? intervallPhase(z, e)
    : z.modus === 'countdown' ? (e / 1000 >= z.countdown ? { phase: 'fertig', rest: 0, anteil: 0 } : { phase: 'countdown', rest: z.countdown - e / 1000, anteil: 1 - e / 1000 / z.countdown })
    : { phase: 'stoppuhr', rest: e / 1000, anteil: (e / 1000 % 60) / 60 };
  // Phasenwechsel: Ton, Vibration, Mitteilung (im Hintergrund)
  const letzte = useRef(`${ph.phase}-${ph.runde}`);
  useEffect(() => {
    const k = `${ph.phase}-${ph.runde}`;
    if (k === letzte.current) return;
    letzte.current = k;
    if (z.start == null) return;
    piep(); vibriere(ph.phase === 'fertig' ? [200, 100, 200, 100, 300] : ph.phase === 'arbeit' ? [250] : [120, 80, 120]);
    if (document.hidden) mitteilung.zeige('prh-timer', `${PHASE_TEXT[ph.phase]}${ph.runde ? ` · Runde ${ph.runde}/${z.runden}` : ''}`, '', { laut: true }).catch(() => {});
    if (ph.phase === 'fertig') setZ({ ...z, angehalten: Date.now() });
  }, [ph.phase, ph.runde]);
  // die letzten 3 Sekunden einer Phase kurz anzeigen (nur Vibration, damit es nicht nervt)
  const sek = Math.ceil(ph.rest);
  const vorher = useRef(sek);
  useEffect(() => { if (laeuft && z.modus !== 'stoppuhr' && sek <= 3 && sek > 0 && sek !== vorher.current) vibriere(40); vorher.current = sek; }, [sek]);

  const los = () => { tonFreigeben(); if (mitteilung.moeglich() && !mitteilung.erlaubt()) mitteilung.erlaubnisHolen().catch(() => {});
    if (z.start == null || ph.phase === 'fertig') setZ({ ...z, start: Date.now(), angehalten: null, versatz: 0 });
    else setZ({ ...z, versatz: (z.versatz ?? 0) + Date.now() - z.angehalten, angehalten: null }); };
  const halt = () => setZ({ ...z, angehalten: Date.now() });
  const reset = () => setZ({ ...z, start: null, angehalten: null, versatz: 0 });
  const farbe = { arbeit: 'var(--acc)', pause: 'var(--ok, #2FBF71)', bereit: 'var(--gold)', fertig: 'var(--gold)', countdown: 'var(--acc)', stoppuhr: 'var(--acc)' }[ph.phase];
  const gesamt = z.modus === 'intervall' ? VORLAUF + z.runden * (z.arbeit + z.pause) : null;
  const vorlageSpeichern = () => {
    const name = `${z.arbeit}/${z.pause} × ${z.runden}`;
    const neu = [...eigene.filter((v) => v.name !== name), { name, arbeit: z.arbeit, pause: z.pause, runden: z.runden }].slice(-8);
    setEigene(neu); speicher.schreib(VORLAGEN, JSON.stringify(neu));
  };
  return html`<section class=${`card pad stack timer-seite phase-${ph.phase}`}>
    <div class="seg" role="group" aria-label="Timer-Art">${[['intervall', 'Intervall'], ['countdown', 'Countdown'], ['stoppuhr', 'Stoppuhr']].map(([k, t]) =>
      html`<button key=${k} aria-pressed=${String(z.modus === k)} disabled=${laeuft} onClick=${() => setZ({ ...z, modus: k, start: null, angehalten: null, versatz: 0 })}>${t}</button>`)}</div>
    <${Ring} anteil=${ph.anteil} farbe=${farbe} gross=${z.modus === 'stoppuhr' ? mmss(Math.floor(ph.rest)) : mmss(Math.ceil(ph.rest))}
      klein=${z.modus === 'intervall' ? `${PHASE_TEXT[ph.phase]} · Runde ${ph.runde}/${z.runden}` : PHASE_TEXT[ph.phase]}/>
    <div class="row" style="gap:8px">
      ${laeuft ? html`<button class="btn btn-soft" style="flex:1" onClick=${halt}>Anhalten</button>`
        : html`<button class="btn btn-go" style="flex:1" onClick=${los}>${z.start != null && ph.phase !== 'fertig' ? 'Weiter' : 'Start'}</button>`}
      <button class="btn btn-soft" style="flex:1" disabled=${z.start == null} onClick=${reset}>Zurücksetzen</button>
    </div>
    ${z.modus === 'intervall' && !laeuft ? html`
      <div class="fields drei"><${ZahlFeld} id="t-arb" label="Arbeit (s)" wert=${z.arbeit} setze=${(x) => x > 0 && setZ({ ...z, arbeit: Math.round(x) })}/>
        <${ZahlFeld} id="t-pau" label="Pause (s)" wert=${z.pause} setze=${(x) => x >= 0 && setZ({ ...z, pause: Math.round(x) })}/>
        <${ZahlFeld} id="t-run" label="Runden" wert=${z.runden} setze=${(x) => x >= 1 && setZ({ ...z, runden: Math.round(x) })}/></div>
      <span class="muted" style="font-size:12.5px">${`Gesamt ${mmss(gesamt)} inkl. ${VORLAUF} s Vorlauf`}</span>
      <span class="eyebrow">Vorlagen</span>
      <div class="row wrap" style="gap:6px">${[...FEST, ...eigene].map((v) => html`<button key=${v.name} class="chip" aria-pressed=${String(v.arbeit === z.arbeit && v.pause === z.pause && v.runden === z.runden)}
        onClick=${() => setZ({ ...z, arbeit: v.arbeit, pause: v.pause, runden: v.runden, start: null, angehalten: null, versatz: 0 })}>${v.name}</button>`)}
        <button class="chip" onClick=${vorlageSpeichern}>＋ Speichern</button></div>` : null}
    ${z.modus === 'countdown' && !laeuft ? html`<div class="row wrap" style="gap:6px">${[30, 60, 90, 120, 180, 300].map((s) => html`<button key=${s} class="chip"
      aria-pressed=${String(z.countdown === s)} onClick=${() => setZ({ ...z, countdown: s, start: null, angehalten: null, versatz: 0 })}>${mmss(s)}</button>`)}</div>
      <${ZahlFeld} id="t-cd" label="Sekunden" wert=${z.countdown} setze=${(x) => x > 0 && setZ({ ...z, countdown: Math.round(x), start: null, angehalten: null, versatz: 0 })}/>` : null}
    <span class="muted" style="font-size:12.5px">Läuft weiter, wenn das Handy gesperrt ist; beim Phasenwechsel Ton, Vibration und Mitteilung.</span>
  </section>`;
}
