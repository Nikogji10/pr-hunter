// PR Hunter · Challenges und Bestenliste unter Freunden (Wünsche 200, 212) – eigener Reiter im Feed.
// Challenges (Update 30): Titel, Art (Trainings, Tonnen, Sätze, Stunden), Zeitraum, eingeladene Freunde; Wertung rechnet
// der Server aus den gespeicherten Trainings. Bestenliste: aus dem Vergleich (compare_stats) – je Lift das aktuelle e1RM,
// Total und DOTS, nur Freunde mit Vergleich-Freigabe.
import { html, useState, useEffect, fmt, gw, einheit, LIFT, Avatar, deEn, datumKurz, I, Sheet, zwischen } from './basis.js';
import { DIENSTE, HEUTE, plusTage } from './stand.js';
import { dots } from '../js/punkte.js';

const ARTEN = [['trainings', 'Trainings', 'Workouts', '🏋️'], ['tonnen', 'Tonnen', 'Tonnes', '🏗️'], ['saetze', 'Sätze', 'Sets', '🔁'], ['stunden', 'Stunden', 'Hours', '⏱️']];
const artName = (a) => { const x = ARTEN.find(([k]) => k === a); return x ? deEn(x[1], x[2]) : a; };
const wertText = (art, w) => (w == null ? '–' : art === 'tonnen' ? `${fmt(w, 1)} t` : art === 'stunden' ? `${fmt(w, 1)} h` : fmt(w, 0));
const MEDAILLE = ['🥇', '🥈', '🥉'];
const montag = (d) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const ZEITRAUM = [
  ['woche', 'Diese Woche', 'This week', () => [montag(HEUTE), plusTage(montag(HEUTE), 6)]],
  ['7', '7 Tage', '7 days', () => [HEUTE, plusTage(HEUTE, 6)]],
  ['14', '2 Wochen', '2 weeks', () => [HEUTE, plusTage(HEUTE, 13)]],
  ['monat', 'Dieser Monat', 'This month', () => { const [j, m] = HEUTE.split('-').map(Number); return [`${HEUTE.slice(0, 7)}-01`, new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10)]; }],
  ['30', '30 Tage', '30 days', () => [HEUTE, plusTage(HEUTE, 29)]],
];

export function ChallengesReiter() {
  const [liste, setListe] = useState(() => zwischen.lies('challenges') ?? undefined);   // undefined = lädt, null = Update fehlt; erst gemerkte
  const [fehler, setFehler] = useState(null);
  const [neu, setNeu] = useState(false);
  const laden = () => DIENSTE.ladeChallenges?.().then((l) => { setListe(l); setFehler(null); if (l) zwischen.schreib('challenges', l); }).catch((e) => { setListe([]); setFehler(navigator.onLine ? e.message : deEn('Kein Netz.', 'No connection.')); });
  useEffect(() => { laden(); }, []);
  const antworten = async (c, dabei) => { try { await DIENSTE.challengeAntworten(c.id, dabei); } catch (e) { setFehler(e.message); } laden(); };
  if (!DIENSTE.ladeChallenges) return html`<div class="reiter-inhalt stack" style="gap:12px"><section class="card pad"><p class="muted" style="margin:0">${deEn('Challenges gibt es nur mit Konto.', 'Challenges need an account.')}</p></section><${Bestenliste}/></div>`;
  return html`<div class="reiter-inhalt stack" style="gap:12px">
    ${liste === null ? html`<section class="hint immer">${I.warn}<span class="t">${deEn('Datenbank-Update 30 fehlt', 'Database update 30 missing')}</span><span></span>
      <p>${deEn('Challenges brauchen db/30_lauf2.sql in Supabase.', 'Challenges need db/30_lauf2.sql in Supabase.')}</p></section>` : html`
    <button class="btn btn-chalk btn-block" onClick=${() => setNeu(true)}>${deEn('+ Neue Challenge', '+ New challenge')}</button>
    ${liste === undefined ? html`<p class="muted">${deEn('Lade …', 'Loading …')}</p>` : null}
    ${liste?.length === 0 ? html`<section class="card pad"><p class="muted" style="margin:0;font-size:14px">${deEn('Noch keine Challenge. Fordere deine Freunde heraus – wer trainiert diese Woche am meisten?', 'No challenge yet. Challenge your friends – who trains the most this week?')}</p></section>` : null}
    ${(liste ?? []).map((c) => html`<${ChallengeKarte} key=${c.id} c=${c} antworten=${antworten}/>`)}`}
    ${fehler ? html`<p class="fehler">${fehler}</p>` : null}
    <${Bestenliste}/>
    ${neu ? html`<${NeueChallenge} zu=${() => setNeu(false)} fertig=${() => { setNeu(false); laden(); }}/>` : null}
  </div>`;
}

function ChallengeKarte({ c, antworten }) {
  const dabei = c.stand.filter((s) => s.status === 'dabei').sort((a, b) => (b.wert ?? 0) - (a.wert ?? 0));
  const eingeladen = c.stand.filter((s) => s.status !== 'dabei');
  const max = Math.max(0.0001, ...dabei.map((s) => s.wert ?? 0));
  const vorbei = c.bis < HEUTE, laeuft = c.von <= HEUTE && !vorbei;
  const rest = laeuft ? Math.round((Date.parse(`${c.bis}T00:00:00Z`) - Date.parse(`${HEUTE}T00:00:00Z`)) / 864e5) + 1 : null;
  const icon = ARTEN.find(([k]) => k === c.art)?.[3] ?? '🏆';
  return html`<section class=${`card pad stack challenge ${vorbei ? 'vorbei' : ''}`}>
    <div class="row between" style="align-items:flex-start"><div><span class="eyebrow">${`${icon} ${artName(c.art)} · ${datumKurz(c.von)}–${datumKurz(c.bis)}`}</span><b class="ch-titel">${c.titel}</b></div>
      <span class=${`ch-status ${laeuft ? 'laeuft' : ''}`}>${vorbei ? deEn('Beendet', 'Finished') : laeuft ? deEn(`noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'}`, `${rest} ${rest === 1 ? 'day' : 'days'} left`) : deEn('startet bald', 'starts soon')}</span></div>
    ${c.status === 'eingeladen' ? html`<div class="ch-einladung"><span>${deEn(`${c.ersteller} fordert dich heraus!`, `${c.ersteller} challenges you!`)}</span>
      <div class="row" style="gap:6px"><button class="btn btn-soft btn-sm" onClick=${() => antworten(c, false)}>${deEn('Ablehnen', 'Decline')}</button>
        <button class="btn btn-chalk btn-sm" onClick=${() => antworten(c, true)}>${deEn('Annehmen', 'Accept')}</button></div></div>` : null}
    <div class="ch-rang">${dabei.map((s, i) => html`<div key=${s.id} class=${`ch-zeile ${s.ich ? 'ich' : ''}`}>
      <span class="ch-platz">${MEDAILLE[i] ?? `${i + 1}.`}</span><${Avatar} bild=${s.avatar} name=${s.name} groesse=${28}/>
      <div class="ch-balken-feld"><span>${s.ich ? deEn('Du', 'You') : s.name}</span><div class="ch-balken"><i style=${`width:${Math.round(((s.wert ?? 0) / max) * 100)}%`}></i></div></div>
      <b>${wertText(c.art, s.wert)}</b></div>`)}</div>
    ${eingeladen.length ? html`<span class="muted" style="font-size:12.5px">${deEn(`Eingeladen: ${eingeladen.map((s) => (s.ich ? 'du' : s.name)).join(', ')}`, `Invited: ${eingeladen.map((s) => (s.ich ? 'you' : s.name)).join(', ')}`)}</span>` : null}
    ${vorbei && dabei[0]?.wert > 0 ? html`<span class="ch-sieger">${deEn(`🏆 ${dabei[0].ich ? 'Du hast gewonnen!' : `${dabei[0].name} hat gewonnen`}`, `🏆 ${dabei[0].ich ? 'You won!' : `${dabei[0].name} won`}`)}</span>` : null}
    ${c.status === 'dabei' ? html`<button class="link" style="justify-self:start;font-size:13px" onClick=${() => antworten(c, false)}>${c.ichErsteller ? deEn('Challenge löschen', 'Delete challenge') : deEn('Verlassen', 'Leave')}</button>` : null}
  </section>`;
}

function NeueChallenge({ zu, fertig }) {
  const [art, setArt] = useState('trainings');
  const [zeit, setZeit] = useState('woche');
  const [titel, setTitel] = useState('');
  const [freunde, setFreunde] = useState(null);
  const [wahl, setWahl] = useState([]);
  const [fehler, setFehler] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { DIENSTE.ladeFreunde?.().then((f) => { const l = (f ?? []).filter((x) => x.status === 'angenommen'); setFreunde(l); setWahl(l.map((x) => x.id)); }).catch((e) => setFehler(e.message)); }, []);
  const z = ZEITRAUM.find(([k]) => k === zeit), [von, bis] = z[3]();
  const vorschlag = deEn(`Wer schafft mehr ${artName(art)}?`, `Who gets more ${artName(art).toLowerCase()}?`);
  const anlegen = async () => {
    setLaeuft(true); setFehler(null);
    try { await DIENSTE.challengeAnlegen({ titel: titel.trim() || vorschlag, art, von, bis, freunde: wahl }); fertig(); }
    catch (e) { setFehler(e.message); setLaeuft(false); }
  };
  return html`<${Sheet} zu=${zu} label=${deEn('Neue Challenge', 'New challenge')}>
    <h2 class="h2">${deEn('Neue Challenge', 'New challenge')}</h2>
    <span class="eyebrow">${deEn('Was zählt?', 'What counts?')}</span>
    <div class="ch-arten">${ARTEN.map(([k, de, en, ic]) => html`<button key=${k} class="ch-art" aria-pressed=${String(art === k)} onClick=${() => setArt(k)}><span>${ic}</span><b>${deEn(de, en)}</b></button>`)}</div>
    <span class="eyebrow">${deEn('Zeitraum', 'Period')}</span>
    <div class="chips-zeile" style="flex-wrap:wrap">${ZEITRAUM.map(([k, de, en]) => html`<button key=${k} class="chip" aria-pressed=${String(zeit === k)} onClick=${() => setZeit(k)}>${deEn(de, en)}</button>`)}</div>
    <span class="muted" style="font-size:12.5px">${`${datumKurz(von)} – ${datumKurz(bis)}`}</span>
    <label class="field" for="ch-titel"><span class="label">${deEn('Titel (optional)', 'Title (optional)')}</span>
      <input id="ch-titel" class="text" type="text" maxlength="80" placeholder=${vorschlag} value=${titel} onInput=${(e) => setTitel(e.currentTarget.value)}/></label>
    <span class="eyebrow">${deEn('Wen herausfordern?', 'Who to challenge?')}</span>
    ${freunde == null ? html`<p class="muted">${deEn('Lade …', 'Loading …')}</p>` : !freunde.length ? html`<p class="muted" style="margin:0">${deEn('Noch keine Freunde – unter Feed → Freunde hinzufügen.', 'No friends yet – add some under Feed → Friends.')}</p>`
      : html`<div class="chips-zeile" style="flex-wrap:wrap">${freunde.map((f) => html`<button key=${f.id} class="chip" aria-pressed=${String(wahl.includes(f.id))}
        onClick=${() => setWahl(wahl.includes(f.id) ? wahl.filter((x) => x !== f.id) : [...wahl, f.id])}><${Avatar} bild=${f.avatar} name=${f.name} groesse=${20}/>${f.name}</button>`)}</div>`}
    ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
    <button class="btn btn-chalk btn-block" disabled=${laeuft || !wahl.length} onClick=${anlegen}>${laeuft ? deEn('Legt an …', 'Creating …') : deEn('Herausfordern', 'Challenge')}</button>
  <//>`;
}

/** 212: Bestenliste – Rangliste je Lift, Total oder DOTS aus dem Vergleich. */
export function Bestenliste() {
  const [daten, setDaten] = useState(() => zwischen.lies('vergleich') ?? undefined);
  const [kat, setKat] = useState('total');
  useEffect(() => { DIENSTE.ladeVergleich?.().then((d) => { setDaten(d ?? null); if (d) zwischen.schreib('vergleich', d); }).catch(() => setDaten((x) => x ?? null)); }, []);
  if (!DIENSTE.ladeVergleich || daten === null) return null;
  if (daten === undefined) return null;
  const total = (p) => (['squat', 'bench', 'dead'].every((l) => p.lifts[l]?.aktuell != null) ? ['squat', 'bench', 'dead'].reduce((a, l) => a + p.lifts[l].aktuell, 0) : null);
  const wert = (p) => (kat === 'total' ? total(p) : kat === 'dots' ? (total(p) != null && p.koerpergewicht ? dots(total(p), p.koerpergewicht) : null) : p.lifts[kat]?.aktuell ?? null);
  const rang = daten.map((p) => ({ p, w: wert(p) })).filter((x) => x.w != null).sort((a, b) => b.w - a.w);
  const kats = [['squat', LIFT.squat.name], ['bench', LIFT.bench.name], ['dead', LIFT.dead.name], ['total', 'Total'], ['dots', 'DOTS']];
  return html`<section class="card pad stack">
    <div><span class="viz-t">${deEn('Bestenliste', 'Leaderboard')}</span><div class="viz-u">${deEn('e1RM der letzten 12 Wochen – Freunde mit Vergleich-Freigabe', 'e1RM of the last 12 weeks – friends who share the comparison')}</div></div>
    <div class="chips-zeile">${kats.map(([k, n]) => html`<button key=${k} class="chip" aria-pressed=${String(kat === k)} onClick=${() => setKat(k)}>${n}</button>`)}</div>
    ${rang.length < 2 ? html`<p class="muted" style="margin:0;font-size:13.5px">${deEn('Noch zu wenige Werte für eine Rangliste – dafür brauchen mindestens zwei Personen den Vergleich eingeschaltet.', 'Not enough values for a ranking yet – at least two people need the comparison switched on.')}</p>`
      : html`<div class="ch-rang">${rang.map(({ p, w }, i) => html`<div key=${p.id} class=${`ch-zeile ${p.ich ? 'ich' : ''}`}>
        <span class="ch-platz">${MEDAILLE[i] ?? `${i + 1}.`}</span><${Avatar} bild=${p.avatar} name=${p.name} groesse=${28}/>
        <div class="ch-balken-feld"><span>${p.ich ? deEn('Du', 'You') : p.name}</span><small class="muted">${i ? (kat === 'dots' ? `−${fmt(rang[0].w - w, 1)}` : `−${gw(rang[0].w - w, 1)} ${einheit()}`) : deEn('vorne', 'leading')}</small></div>
        <b>${kat === 'dots' ? fmt(w, 1) : `${gw(w, 1)} ${einheit()}`}</b></div>`)}</div>`}
  </section>`;
}
