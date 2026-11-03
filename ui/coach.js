// PR Hunter · Coach-Modus (Wunsch 214, Update 32). Coach: Athleten (Freunde mit Zustimmung) auswählen → Block, Woche,
// Bestwerte, letzte Trainings mit Sätzen/RPE/Notizen; je Training kommentieren; Plan schicken. Athlet: Anfrage annehmen
// oder ablehnen, Verbindung jederzeit beenden (unter Feed → Freunde).
import { html, useState, useEffect, deEn, Avatar, I, Sheet, datumKurz, datumLang, nameVon, gw, fmt, zwischen, sprache, LIFT } from './basis.js';
import { DIENSTE, HEUTE, plusTage } from './stand.js';
import { HAUPT, kanon } from '../js/daten.js';
import { e1rm } from '../js/rechnen.js';

const folge = (saetze) => {
  const f = [];
  for (const s of saetze) { const g = f.at(-1); if (g && g.kg === s.kg && g.wdh === s.wdh) g.n++; else f.push({ kg: s.kg, wdh: s.wdh, rpe: s.rpe, n: 1 }); }
  return f.map((g) => `${g.n > 1 ? `${g.n}×` : ''}${g.kg != null ? gw(Number(g.kg)) : '–'}×${g.wdh ?? '–'}${g.rpe != null ? ` @${fmt(Number(g.rpe))}` : ''}`).join('  ');
};

/** Athleten-Seite: Anfragen und aktive Coaches (Feed → Freunde). */
export function CoachAnfragen() {
  const [rel, setRel] = useState(() => zwischen.lies('coach') ?? []);
  const laden = () => DIENSTE.coachBeziehungen?.().then((r) => { if (r) { setRel(r); zwischen.schreib('coach', r); } }).catch(() => {});
  useEffect(() => { laden(); }, []);
  const coaches = rel.filter((r) => r.rolle === 'coach');
  if (!coaches.length) return null;
  const aktion = async (f) => { try { await f(); } catch (e) { DIENSTE.meldung?.({ titel: 'Ging nicht', text: e.message }); } laden(); };
  return html`<section class="card pad stack coach-anfrage">${coaches.map((c) => html`<div key=${c.andere} class="coach-anfrage-zeile">
    <${Avatar} bild=${c.avatar} name=${c.name} groesse=${34}/>
    <span class="coach-anfrage-text">${c.status === 'angefragt' ? html`<b>${c.name}</b> ${deEn('möchte dein Coach sein – sieht dann deine Trainings und kann Pläne schicken.', 'wants to be your coach – will see your workouts and can send plans.')}`
      : html`<b>${c.name}</b> ${deEn('ist dein Coach', 'is your coach')}`}</span>
    <div class="coach-anfrage-knoepfe">${c.status === 'angefragt' ? html`<button class="btn btn-soft btn-sm" onClick=${() => aktion(() => DIENSTE.coachAntworten(c.andere, false))}>${deEn('Ablehnen', 'Decline')}</button>
      <button class="btn btn-chalk btn-sm" onClick=${() => aktion(() => DIENSTE.coachAntworten(c.andere, true))}>${deEn('Annehmen', 'Accept')}</button>`
      : html`<button class="link" onClick=${() => aktion(() => DIENSTE.coachBeenden(c.andere))}>${deEn('Beenden', 'End')}</button>`}</div></div>`)}</section>`;
}

export function CoachSeite({ zurueck, plaene = [] }) {
  const [rel, setRel] = useState(() => zwischen.lies('coach'));          // null = lädt / Update fehlt
  const [fehlt, setFehlt] = useState(false);
  const [wahl, setWahl] = useState(() => { try { return sessionStorage.getItem('prh-coach-athlet'); } catch { return null; } });
  const [einladen, setEinladen] = useState(false);
  const laden = () => DIENSTE.coachBeziehungen?.().then((r) => { if (r == null) { setFehlt(true); return; } setRel(r); zwischen.schreib('coach', r); }).catch(() => {});
  useEffect(() => { laden(); }, []);
  const athleten = (rel ?? []).filter((r) => r.rolle === 'athlet');
  const akt = athleten.find((a) => a.andere === wahl) ?? athleten.find((a) => a.status === 'aktiv') ?? athleten[0] ?? null;
  const waehle = (id) => { setWahl(id); try { sessionStorage.setItem('prh-coach-athlet', id); } catch { /* egal */ } };
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${deEn('Deine Athleten', 'Your athletes')}</div><h1 class="h1">Coach</h1></div></header>
    ${fehlt ? html`<section class="hint immer">${I.warn}<span class="t">${deEn('Datenbank-Update 32 fehlt', 'Database update 32 missing')}</span><span></span><p>${deEn('Der Coach-Modus braucht db/32_coach.sql in Supabase.', 'Coach mode needs db/32_coach.sql in Supabase.')}</p></section>` : null}
    ${athleten.length ? html`<div class="chips-zeile coach-chips">${athleten.map((a) => html`<button key=${a.andere} class="chip" aria-pressed=${String(akt?.andere === a.andere)} onClick=${() => waehle(a.andere)}>
      <${Avatar} bild=${a.avatar} name=${a.name} groesse=${22}/>${a.name}${a.status === 'angefragt' ? ' ⏳' : ''}</button>`)}
      <button class="chip" onClick=${() => setEinladen(true)}>${deEn('+ Athlet', '+ Athlete')}</button></div>`
    : !fehlt && rel ? html`<section class="card pad stack coach-start"><span class="coach-gross" aria-hidden="true">📋</span><b>${deEn('Betreue deine Freunde', 'Coach your friends')}</b>
      <span class="muted" style="font-size:13.5px">${deEn('Lade einen Freund ein. Nimmt er an, siehst du hier seine Trainings mit Sätzen, RPE und Notizen, kannst kommentieren und ihm Pläne schicken.', 'Invite a friend. Once they accept, you see their workouts with sets, RPE and notes here, can comment and send them plans.')}</span>
      <button class="btn btn-chalk btn-block" onClick=${() => setEinladen(true)}>${deEn('Athlet einladen', 'Invite athlete')}</button></section>` : null}
    ${akt ? html`<${AthletAnsicht} key=${akt.andere} a=${akt} plaene=${plaene} geaendert=${laden}/>` : null}
    ${einladen ? html`<${Einladen} vorhanden=${athleten.map((a) => a.andere)} zu=${() => setEinladen(false)} fertig=${() => { setEinladen(false); laden(); }}/>` : null}
  </div>`;
}

function Einladen({ vorhanden, zu, fertig }) {
  const [freunde, setFreunde] = useState(() => (zwischen.lies('freunde') ?? []).filter?.((x) => x.status === 'angenommen') ?? []);
  const [fehler, setFehler] = useState(null);
  useEffect(() => { DIENSTE.ladeFreunde?.().then((f) => f && setFreunde(f.filter((x) => x.status === 'angenommen'))).catch(() => {}); }, []);
  const frei = freunde.filter((f) => !vorhanden.includes(f.id));
  return html`<${Sheet} zu=${zu} label=${deEn('Athlet einladen', 'Invite athlete')}>
    <h2 class="h2">${deEn('Athlet einladen', 'Invite athlete')}</h2>
    <p class="muted" style="margin:0;font-size:13.5px">${deEn('Dein Freund bekommt die Anfrage unter Feed → Freunde und entscheidet selbst.', 'Your friend gets the request under Feed → Friends and decides.')}</p>
    ${!frei.length ? html`<p class="muted" style="margin:0">${deEn('Keine weiteren Freunde – unter Feed → Freunde hinzufügen.', 'No more friends – add some under Feed → Friends.')}</p>` : null}
    ${frei.map((f) => html`<button key=${f.id} class="btn btn-soft btn-block coach-einladen" onClick=${async () => { try { await DIENSTE.coachAnfragen(f.id); fertig(); } catch (e) { setFehler(e.message); } }}>
      <${Avatar} bild=${f.avatar} name=${f.name} groesse=${24}/>${f.name}</button>`)}
    ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
  <//>`;
}

function AthletAnsicht({ a, plaene, geaendert }) {
  const [tr, setTr] = useState(() => zwischen.lies(`coach-${a.andere}`));
  const [block, setBlock] = useState(null);
  const [plan, setPlan] = useState(false);
  const [mehr, setMehr] = useState(8);
  const [status, setStatus] = useState(null);
  const [beenden, setBeenden] = useState(false);
  useEffect(() => {
    if (a.status !== 'aktiv') return;
    DIENSTE.athletTrainings?.(a.andere).then((l) => { setTr(l); zwischen.schreib(`coach-${a.andere}`, l); }).catch((e) => setStatus(e.message));
    DIENSTE.athletBlock?.(a.andere).then(setBlock).catch(() => {});
  }, [a.andere, a.status]);
  if (a.status !== 'aktiv') {
    return html`<section class="card pad stack"><b>${deEn(`Warte auf ${a.name}`, `Waiting for ${a.name}`)}</b>
      <span class="muted" style="font-size:13.5px">${deEn('Die Anfrage ist verschickt. Sobald sie angenommen ist, erscheinen hier die Trainings.', 'The request is sent. Once accepted, the workouts appear here.')}</span>
      <button class="link" style="justify-self:start" onClick=${async () => { await DIENSTE.coachBeenden(a.andere); geaendert(); }}>${deEn('Anfrage zurückziehen', 'Withdraw request')}</button></section>`;
  }
  const liste = tr ?? [];
  const best = Object.fromEntries(Object.entries(HAUPT).map(([l, k]) => [l, Math.max(0, ...liste.flatMap((t) => t.uebungen.filter((u) => kanon(u.key) === k).flatMap((u) => u.saetze))
    .filter((s) => s.kg > 0 && s.wdh >= 1 && s.wdh <= 10).map((s) => e1rm(Number(s.kg), s.wdh)))]));
  const woche = liste.filter((t) => t.datum >= plusTage(HEUTE, -6)).length;
  const blockWoche = block ? Math.min(block.wochen || 99, Math.floor((Date.parse(`${HEUTE}T00:00:00Z`) - Date.parse(`${block.start}T00:00:00Z`)) / (7 * 864e5)) + 1) : null;
  return html`<div class="stack" style="gap:12px">
    <section class="card pad stack coach-ueberblick">
      <div class="row" style="gap:12px;align-items:center"><${Avatar} bild=${a.avatar} name=${a.name} groesse=${48}/>
        <div style="flex:1;min-width:0"><b class="coach-name">${a.name}</b><div class="muted" style="font-size:13px">${block ? `${block.name} · ${deEn('Woche', 'Week')} ${blockWoche}/${block.wochen}` : deEn('Kein aktiver Block', 'No active block')}</div></div></div>
      <div class="coach-zahlen">
        <div><small>${deEn('Diese Woche', 'This week')}</small><b>${woche}</b></div>
        <div><small>${deEn('Zuletzt', 'Latest')}</small><b>${liste[0] ? datumKurz(liste[0].datum) : '–'}</b></div>
        ${Object.entries(best).map(([l, w]) => html`<div key=${l}><small>${LIFT[l].name}</small><b>${w > 0 ? fmt(Math.round(w * 2) / 2, 1) : '–'}</b></div>`)}
      </div>
      <div class="row" style="gap:8px"><button class="btn btn-chalk" style="flex:1" disabled=${!plaene.length || !DIENSTE.planSenden} onClick=${() => setPlan(true)}>${deEn('Plan schicken', 'Send plan')}</button>
        <button class="btn btn-soft" onClick=${() => setBeenden(true)}>${deEn('Beenden', 'End')}</button></div>
      ${status ? html`<span class="muted" style="font-size:12.5px">${status}</span>` : null}
    </section>
    ${tr == null ? html`<p class="muted">${deEn('Lade …', 'Loading …')}</p>` : !liste.length ? html`<section class="card pad"><p class="muted" style="margin:0">${deEn('Noch keine Trainings in den letzten Monaten.', 'No workouts in recent months.')}</p></section>` : null}
    ${liste.slice(0, mehr).map((t) => html`<${CoachTraining} key=${t.id} t=${t}/>`)}
    ${liste.length > mehr ? html`<button class="btn btn-soft btn-block" onClick=${() => setMehr(mehr + 10)}>${deEn('Ältere Trainings', 'Older workouts')}</button>` : null}
    ${beenden ? html`<${Sheet} zu=${() => setBeenden(false)} label=${deEn('Coaching beenden', 'Stop coaching')}>
      <div class="row" style="gap:12px;align-items:center"><${Avatar} bild=${a.avatar} name=${a.name} groesse=${44}/>
        <h2 class="h2" style="margin:0">${deEn(`Coaching von ${a.name} beenden?`, `Stop coaching ${a.name}?`)}</h2></div>
      <p class="muted" style="margin:0;font-size:13.5px">${deEn(`Du siehst danach ${a.name}s Trainings nicht mehr. Deine Kommentare und geschickten Pläne bleiben. Wieder verbinden geht jederzeit über „+ Athlet“.`, `You will no longer see ${a.name}'s workouts. Your comments and sent plans stay. You can reconnect any time via “+ Athlete”.`)}</p>
      <button class="btn btn-gefahr btn-block" onClick=${async () => { try { await DIENSTE.coachBeenden(a.andere); setBeenden(false); geaendert(); } catch (e) { setBeenden(false); setStatus(e.message); } }}>${deEn('Coaching beenden', 'Stop coaching')}</button>
      <button class="btn btn-soft btn-block" onClick=${() => setBeenden(false)}>${deEn('Abbrechen', 'Cancel')}</button>
    <//>` : null}
    ${plan ? html`<${Sheet} zu=${() => setPlan(false)} label=${deEn('Plan schicken', 'Send plan')}>
      <h2 class="h2">${deEn(`Plan an ${a.name}`, `Plan for ${a.name}`)}</h2>
      ${plaene.map((p, i) => html`${i === 0 || p.eigen !== plaene[i - 1].eigen ? html`<span class="eyebrow">${p.eigen ? deEn('Deine Pläne', 'Your plans') : deEn('Vorlagen', 'Templates')}</span>` : null}<button key=${p.name} class="btn btn-soft btn-block" onClick=${async () => { try { await DIENSTE.planSenden(a.andere, p.name, p.def); setPlan(false); setStatus(deEn(`„${p.name}“ geschickt – ${a.name} übernimmt ihn unter Programme.`, `“${p.name}” sent – ${a.name} adds it under Programs.`)); } catch (e) { setStatus(e.message); } }}>${p.name}</button>`)}
    <//>` : null}
  </div>`;
}

function CoachTraining({ t }) {
  const [text, setText] = useState('');
  const [offen, setOffen] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const min = t.start && t.ende ? Math.round((Date.parse(t.ende) - Date.parse(t.start)) / 60000) : null;
  const senden = async () => { try { await DIENSTE.kommentieren(t.id, text); setGesendet(true); setText(''); setOffen(false); } catch (e) { DIENSTE.meldung?.({ titel: 'Nicht gesendet', text: e.message }); } };
  return html`<article class="card pad stack coach-training">
    <div class="row between"><b>${datumLang(t.datum)}</b><span class="muted" style="font-size:12.5px">${[min && min < 600 ? `${min} min` : null, t.rpe ? `RPE ${fmt(Number(t.rpe))}` : null].filter(Boolean).join(' · ')}</span></div>
    ${t.uebungen.map((u, i) => html`<div key=${i} class="coach-uebung"><span>${nameVon(u.key, sprache() === 'en' ? u.en : u.de)}</span><small>${folge(u.saetze.filter((s) => s.typ !== 'warmup'))}</small></div>`)}
    ${t.notiz ? html`<p class="cue notiz" style="margin:0">${t.notiz}</p>` : null}
    ${offen ? html`<div class="row" style="gap:6px"><input class="text" type="text" maxlength="500" placeholder=${deEn('Kommentar für deinen Athleten …', 'Comment for your athlete …')} value=${text} onInput=${(e) => setText(e.currentTarget.value)} onKeyDown=${(e) => e.key === 'Enter' && text.trim() && senden()}/>
      <button class="btn btn-chalk btn-sm" disabled=${!text.trim()} onClick=${senden}>${deEn('Senden', 'Send')}</button></div>`
      : html`<button class="link" style="justify-self:start" onClick=${() => setOffen(true)}>${gesendet ? deEn('✓ Kommentiert – noch einer', '✓ Commented – add another') : deEn('💬 Kommentieren', '💬 Comment')}</button>`}
  </article>`;
}
