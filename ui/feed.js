// PR Hunter · Feed: Trainings der Freunde (und die eigenen), wie der Feed in Jefit – Dauer, Übungen, Sätze, Volumen,
// Rekorde und je Übung der beste Satz. Sichtbar nur, was die anderen freigeben (Einstellungen → Konto, Standard an);
// wer selbst nicht teilt, sieht auch nichts. Daten: public.feed() aus db/15_feed.sql. In der Demo die eigenen Tage.
import { html, useState, useEffect, I, Avatar, datumLang, gw, gwE, tonnage, minutenText, sprache, nameVon } from './basis.js';
import { DEMO, HEUTE, trainingsTage, trainingAm, plusTage } from './stand.js';
import { DIENSTE } from './stand.js';
import { rekordChronik } from '../js/auswertung.js';

/** Demo: die letzten Trainingstage als eigener Feed (Rekorde wie in der Statistik gezählt). */
function demoFeed() {
  const tage = Object.keys(trainingsTage).sort();
  const pr = rekordChronik(tage.map((d) => trainingAm(d)).filter(Boolean));
  return tage.filter((d) => d > plusTage(HEUTE, -30)).reverse().slice(0, 12).map((d) => {
    const t = trainingAm(d);
    return { id: d, name: 'Du', ich: true, datum: d, minuten: t.dauer, uebungen: t.uebungen.length, saetze: t.uebungen.reduce((a, u) => a + u.saetze.length, 0),
      volumen: t.tonnage, prs: pr.filter((r) => r.datum === d).length,
      liste: t.uebungen.map((u) => { const b = u.saetze.reduce((m, s) => (!m || (s.e1rm ?? 0) > (m.e1rm ?? 0) || (s.e1rm == null && (s.kg ?? 0) > (m.kg ?? 0)) ? s : m), null);
        return { key: u.key, saetze: u.saetze.length, prs: pr.filter((r) => r.datum === d && r.key === u.key).length, kg: b?.kg ?? null, wdh: b?.wdh ?? null, folge: folgeAus(u.saetze) }; }) };
  });
}

/** Sätze zusammenfassen wie public.feed() ab Update 16: gleiche kg × Wdh einmal mit Anzahl, in Satzreihenfolge. */
function folgeAus(saetze) {
  const f = [];
  for (const s of saetze) {
    const g = f.find((x) => x.kg === s.kg && x.wdh === s.wdh);
    if (g) g.n++; else f.push({ kg: s.kg, wdh: s.wdh, n: 1 });
  }
  return f;
}
/** „35 × 3 · 2 × 20 × 6“: Top-Satz und Back-offs getrennt statt alle Sätze wie der beste. */
const folgeText = (folge) => folge.map((g) => `${g.n > 1 ? `${g.n} × ` : ''}${g.kg != null ? gw(g.kg) : '–'} × ${g.wdh ?? '–'}`).join(' · ');

// Letzter Stand im Gerät: der Feed erscheint sofort, die Abfrage aktualisiert im Hintergrund
const CACHE = 'prh-feed';
const ausCache = () => { try { return JSON.parse(localStorage.getItem(CACHE)) ?? []; } catch { return []; } };
const inCache = (f) => { try { localStorage.setItem(CACHE, JSON.stringify(f)); } catch { /* voll oder gesperrt */ } };

export function Feed({ einst, zuEinstellungen }) {
  const [stand, setStand] = useState({ laedt: !DEMO, eintraege: DEMO ? demoFeed() : ausCache(), fehler: null, fehlt: false });
  const [offen, setOffen] = useState(null);
  const laden = async () => {
    if (DEMO || !DIENSTE.ladeFeed) return;
    setStand((s) => ({ ...s, laedt: true, fehler: null }));
    try {
      const f = await DIENSTE.ladeFeed();
      if (f) inCache(f);
      setStand({ laedt: false, eintraege: f ?? [], fehler: null, fehlt: f == null });
    } catch (e) { setStand((s) => ({ ...s, laedt: false, fehler: navigator.onLine ? e.message : 'Kein Netz – der Feed braucht eine Verbindung.' })); }
  };
  useEffect(() => { laden(); }, []);
  const name = (u) => (u.key ? nameVon(u.key, sprache() === 'en' ? u.en : u.de) : '–');
  const geteilt = einst.feedTeilen !== false;
  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Trainings von dir und deinen Freunden</div><h1 class="h1">Feed</h1></div>
      ${DEMO ? html`<span class="proto">Beispieldaten</span>` : html`<button class=${`iconbtn ${stand.laedt ? 'dreht' : ''}`} onClick=${laden} aria-label="Neu laden" disabled=${stand.laedt}>${I.neu}</button>`}</header>
    ${stand.fehlt ? html`<section class="hint immer">${I.warn}<span class="t">Datenbank-Update 15 fehlt</span><span></span>
      <p>Der Feed braucht <b>db/15_feed.sql</b> in Supabase. Bis dahin bleibt er leer.</p></section>` : null}
    ${!geteilt && !DEMO ? html`<section class="hint immer">${I.warn}<span class="t">Du teilst nicht</span><span></span>
      <p>Wer seine Trainings nicht teilt, sieht auch die der anderen nicht.</p><span></span>
      <div class="row" style="margin-top:6px"><button class="btn btn-soft btn-sm" onClick=${zuEinstellungen}>Zu den Einstellungen</button></div></section>` : null}
    ${stand.fehler ? html`<p class="fehler">${stand.fehler}</p>` : null}
    ${stand.laedt && !stand.eintraege.length ? html`<p class="muted">Lade …</p>` : null}
    ${!stand.laedt && !stand.eintraege.length && !stand.fehlt && geteilt ? html`<section class="card pad"><p class="muted" style="margin:0">In den letzten 30 Tagen noch keine geteilten Trainings.</p></section>` : null}
    ${stand.eintraege.map((e) => html`<article key=${e.id} class=${`card pad stack feed-eintrag ${e.prs ? 'mit-pr' : ''}`}>
      <div class="feed-kopf"><${Avatar} bild=${e.avatar} name=${e.name} groesse=${40}/>
        <div style="min-width:0;flex:1"><b>${e.ich ? 'Du' : e.name}</b><div class="muted" style="font-size:12.5px">${datumLang(e.datum)}</div></div>
        ${e.prs ? html`<span class="feed-pr"><span class="medaille">PR</span><b>${e.prs}</b></span>` : null}</div>
      <div class="feed-zahlen">
        <div><span class="eyebrow">Dauer</span><b>${e.minuten ? (e.minuten < 60 ? minutenText(e.minuten) : `${Math.floor(e.minuten / 60)}:${String(Math.round(e.minuten % 60)).padStart(2, '0')} h`) : '–'}</b></div>
        <div><span class="eyebrow">Übungen</span><b>${e.uebungen}</b></div>
        <div><span class="eyebrow">Sätze</span><b>${e.saetze}</b></div>
        <div><span class="eyebrow">Volumen</span><b>${tonnage(e.volumen)}</b></div></div>
      <ul class="feed-liste">${(offen === e.id ? e.liste : e.liste.slice(0, 4)).map((u, i) => html`<li key=${i}>
        <span class="feed-name">${name(u)}</span>
        ${u.folge?.length ? html`<b class="feed-folge" style="grid-column:2 / 4">${folgeText(u.folge)}</b>`
          : html`<span class="muted">${u.saetze} ×</span><b>${u.kg != null && u.wdh != null ? `${gwE(u.kg)} × ${u.wdh}` : '–'}</b>`}${u.prs ? html`<span class="tag gold">PR</span>` : html`<span></span>`}</li>`)}</ul>
      ${e.liste.length > 4 ? html`<button class="link" style="justify-self:start" onClick=${() => setOffen(offen === e.id ? null : e.id)}>${offen === e.id ? 'Weniger' : `Alle ${e.liste.length} Übungen`}</button>` : null}
    </article>`)}
  </div>`;
}
