// PR Hunter · Feed: Trainings der Freunde (und die eigenen), wie der Feed in Jefit – Dauer, Übungen, Sätze, Volumen,
// Rekorde und je Übung der beste Satz. Sichtbar nur, was die anderen freigeben (Einstellungen → Konto, Standard an);
// wer selbst nicht teilt, sieht auch nichts. Daten: public.feed() aus db/15_feed.sql. In der Demo die eigenen Tage.
import { html, useState, useEffect, I, Avatar, datumLang, datumKurz, deEn, gw, gwE, tonnage, minutenText, sprache, nameVon, useUnterReiter, UNTER_VORSCHAU, Sheet, vibriere, zeigeFenster, zwischen } from './basis.js';
import { DEMO, HEUTE, trainingsTage, trainingAm, plusTage } from './stand.js';
import { DIENSTE } from './stand.js';
import { useLayoutEffect, useRef } from '../vendor/htm-preact.js';
import { rekordChronik } from '../js/auswertung.js';
import { ChallengesReiter } from './challenges.js';
import { GruppenVerwaltung, GruppenFilter, inGruppe } from './gruppen.js';
import { CoachAnfragen } from './coach.js';
import { PartnerLeiste, standKurz } from './zusammen.js';

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

// #################################################################
// Kalender (Wunsch 95): je Woche, wer an welchem Tag trainiert (✓ erledigt, ○ geplant) – mit Zeile „Zusammen“:
// Tage, an denen mehrere trainieren, und gemeinsame Ruhetage. Daten: public.feed_kalender() aus db/18_kalender.sql.
// #################################################################
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], WT_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const montagVon = (d) => plusTage(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Demo: die eigenen Trainingstage und ein Beispiel-Freund, der an anderen Tagen trainiert. */
function demoKalender(von, bis) {
  const z = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) {
    if (trainingsTage[d]) z.push({ nutzer: 'ich', name: 'Du', avatar: null, datum: d, art: 'erledigt', ich: true });
    const wt = new Date(`${d}T00:00:00Z`).getUTCDay();
    if ([1, 3, 5].includes(wt)) z.push({ nutzer: 'kumpel', name: 'Kumpel', avatar: null, datum: d, art: d <= HEUTE ? 'erledigt' : 'geplant', ich: false });
  }
  return z;
}

// Feste Palette ohne Akzentfarbe: die Farbwelt (z. B. Kobalt = blau) darf nicht mit einem Freund zusammenfallen
const FARBEN = ['#F59E0B', '#3B82F6', '#EC4899', '#A855F7', '#14B8A6', '#EF4444'];
const MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONAT_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Monatskalender: je Tag ein Punkt pro Person (gefüllt = trainiert, Ring = geplant); grün = alle trainieren,
 *  grau = alle haben Ruhetag. Blättern bis 2 Monate zurück und 2 vor. */
const uebName = (u) => (u.key ? nameVon(u.key, sprache() === 'en' ? u.en : u.de) : '–');

function Kalender({ eintraege = [], einst = {} }) {
  const [monat, setMonat] = useState(0);
  const [tag, setTag] = useState(null);                       // angetippter Tag
  const [auf, setAuf] = useState(null);                       // aufgeklappte Person an diesem Tag
  const erster = (() => { const d = new Date(`${HEUTE.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + monat); return d.toISOString().slice(0, 10); })();
  const naechster = (() => { const d = new Date(`${erster}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })();
  const von = montagVon(erster), bis = plusTage(montagVon(plusTage(naechster, -1)), 6);
  // Kalender zuerst aus dem Gerätespeicher (letzter Stand), dann still aktualisieren – die Kachel springt nicht.
  // Schon der erste Aufbau ist gefüllt (auch das Bild der Seite beim Wischen).
  const merkKey = `prh-kal-${von}`;
  const ausSpeicher = () => { try { return JSON.parse(localStorage.getItem(merkKey)); } catch { return null; } };
  const [daten, setDaten] = useState(() => (DEMO ? demoKalender(von, bis) : ausSpeicher()));   // null = lädt, { fehlt } = Update 18 fehlt
  const kachel = useRef(null), erstes = useRef(true);
  useLayoutEffect(() => {                                    // vor dem Zeichnen, damit kein leerer Kalender aufblitzt
    const anfang = erstes.current; erstes.current = false;
    if (!kachel.current?.isConnected) return;               // unsichtbarer Aufbau (Bild fürs Wischen): nichts laden
    if (DEMO) { if (!anfang) setDaten(demoKalender(von, bis)); return; }
    const gemerkt = anfang ? daten : ausSpeicher();
    if (!anfang) setDaten(gemerkt);
    if (!DIENSTE.ladeKalender) return;
    DIENSTE.ladeKalender(von, bis).then((k) => {
      setDaten(k ?? { fehlt: true });
      if (Array.isArray(k)) try { localStorage.setItem(merkKey, JSON.stringify(k)); } catch { /* voll: egal */ }
    }).catch(() => { if (!gemerkt) setDaten([]); });
  }, [monat]);
  const tage = []; for (let d = von; d <= bis; d = plusTage(d, 1)) tage.push(d);
  // Ausgeblendete Freunde (Freunde → je Freund „Kalender zeigen“) fallen weg
  const liste = (Array.isArray(daten) ? daten : []).filter((z) => z.ich || sichtbar(einst, z.nutzer, 'kalender'));
  const personen = [...new Map(liste.map((z) => [z.nutzer, z])).values()].sort((x, y) => (y.ich - x.ich) || x.name.localeCompare(y.name));
  const farbe = Object.fromEntries(personen.map((p, i) => [p.nutzer, FARBEN[i % FARBEN.length]]));
  const zeileVon = (n, d) => liste.find((z) => z.nutzer === n && z.datum === d) ?? null;
  const art = (n, d) => zeileVon(n, d)?.art ?? null;
  const en = sprache() === 'en';
  const titel = `${(en ? MONAT_EN : MONAT)[Number(erster.slice(5, 7)) - 1]} ${erster.slice(0, 4)}`;
  return html`<section class="card pad stack kalender" ref=${kachel}>
    <div class="row between"><span class="viz-t">Wer trainiert wann</span>
      <span class="row" style="gap:4px"><button class="iconbtn klein" disabled=${monat <= -2} onClick=${() => setMonat(monat - 1)} aria-label="Monat zurück"><span style="display:inline-block;transform:rotate(180deg)">${I.weiter}</span></button>
        <b class="kal-monat" translate="no">${titel}</b>
        <button class="iconbtn klein" disabled=${monat >= 2} onClick=${() => setMonat(monat + 1)} aria-label="Monat vor">${I.weiter}</button></span></div>
    ${daten?.fehlt ? html`<p class="muted" style="margin:0;font-size:13px">Braucht Datenbank-Update 18 (db/18_kalender.sql).</p>`
      : html`<div class="kal-monatsraster">
        ${(en ? WT_EN : WT).map((w) => html`<span key=${w} class="kal-wt" translate="no">${w}</span>`)}
        ${tage.map((d) => {
          const drin = d >= erster && d < naechster;
          const da = personen.map((p) => [p, art(p.nutzer, d)]).filter(([, a]) => a);
          const alle = personen.length > 1 && da.length === personen.length, keiner = personen.length > 1 && !da.length && drin;
          return html`<button key=${d} class=${`kal-tag ${drin ? '' : 'aussen'} ${d === HEUTE ? 'heute' : ''} ${alle ? 'alle' : ''} ${keiner ? 'frei' : ''} ${tag === d ? 'gewaehlt' : ''}`}
            onClick=${() => { setTag(tag === d ? null : d); setAuf(null); }} aria-label=${datumLang(d)}>
            <span class="kal-nr">${Number(d.slice(8, 10))}</span>
            <span class="kal-punkte">${da.map(([p, a]) => html`<i key=${p.nutzer} class=${a} style=${`--f:${farbe[p.nutzer]}`}></i>`)}</span></button>`;
        })}
      </div>

      ${tag ? html`<div class="kal-detail"><b>${datumLang(tag)}</b>
        ${personen.filter((p) => art(p.nutzer, tag)).length ? personen.filter((p) => art(p.nutzer, tag)).map((p) => {
          const z = zeileVon(p.nutzer, tag), a = z.art;
          const e = p.ich && a === 'erledigt' ? eintraege.find((x) => x.datum === tag && x.ich) : null;   // Sätze nur bei einem selbst
          const namen = (z.uebungen ?? []).map((k) => nameVon(k, k));
          const offen = auf === p.nutzer;
          return html`<div key=${p.nutzer} class="kal-person">
            <button class="kal-person-kopf" aria-expanded=${String(offen)} disabled=${!e && !namen.length} onClick=${() => setAuf(offen ? null : p.nutzer)}>
              <i style=${`background:${farbe[p.nutzer]}`}></i><b>${p.ich ? 'Du' : p.name}</b>
              <span class="muted">${e ? `${e.uebungen} Übungen · ${e.saetze} Sätze` : namen.length ? `${a === 'geplant' ? 'geplant' : 'trainiert'} · ${namen.length} Übungen` : a === 'geplant' ? 'geplant' : 'trainiert'}</span>
              ${e || namen.length ? html`<span class="woche-pfeil" aria-hidden="true">${I.weiter}</span>` : null}</button>
            ${offen && e ? html`<ul class="feed-liste">${e.liste.map((u, i) => html`<li key=${i}><span class="feed-name">${uebName(u)}</span>
              ${u.folge?.length ? html`<b class="feed-folge" style="grid-column:2 / 4">${folgeText(u.folge)}</b>` : html`<span class="muted">${u.saetze} ×</span><b>${u.kg != null && u.wdh != null ? `${gwE(u.kg)} × ${u.wdh}` : '–'}</b>`}
              ${u.prs ? html`<span class="tag gold">PR</span>` : html`<span></span>`}</li>`)}</ul>`
              : offen && namen.length ? html`<ul class="kal-namen">${namen.map((n, i) => html`<li key=${i}>${n}</li>`)}</ul>` : null}
          </div>`;
        }) : html`<span class="muted" style="font-size:13px">Niemand trainiert an diesem Tag.</span>`}
        ${personen.some((p) => art(p.nutzer, tag) === 'erledigt' && !zeileVon(p.nutzer, tag)?.uebungen?.length && !(p.ich && eintraege.some((x) => x.datum === tag && x.ich)))
          ? html`<span class="muted" style="font-size:12px">Details gibt es für die letzten 30 Tage.</span>` : null}</div>` : null}
      <div class="kal-legende">${personen.map((p) => html`<span key=${p.nutzer}><i style=${`background:${farbe[p.nutzer]}`}></i>${p.ich ? 'Du' : p.name}</span>`)}</div>
      <span class="muted" style="font-size:12px">● trainiert · ○ geplant · grün = alle trainieren · grau = alle haben Ruhetag</span>`}
  </section>`;
}

// #################################################################
// Freunde (Wunsch 122): suchen, anfragen, annehmen, entfernen, blockieren; je Freund Feed/Kalender/Vergleich ausblenden
// (einst.freundeAus = { id: { feed: false, kalender: false, vergleich: false } }, auf allen Geräten). Daten: db/19_freunde.sql.
// #################################################################
const SICHT = [['feed', 'Feed'], ['kalender', 'Kalender'], ['vergleich', 'Vergleich']];
export const sichtbar = (einst, id, art) => einst.freundeAus?.[id]?.[art] !== false;

function Freunde({ einst, setEinst }) {
  const [liste, setListe] = useState(() => zwischen.lies('freunde'));   // null = lädt, false = Update 19 fehlt; erst gemerkte Liste
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState([]);
  const [fehler, setFehler] = useState(null);
  const [offen, setOffen] = useState(null);                  // aufgeklappter Freund (Einstellungen je Freund)
  const laden = () => DIENSTE.ladeFreunde?.().then((f) => { setListe(f ?? false); if (f) zwischen.schreib('freunde', f); }).catch((e) => setFehler(e.message));
  useEffect(() => { if (!DEMO) laden(); else setListe([]); }, []);
  useEffect(() => {
    if (DEMO || q.trim().length < 2) { setTreffer([]); return; }
    const id = setTimeout(() => DIENSTE.sucheNutzer?.(q).then(setTreffer).catch(() => setTreffer([])), 300);
    return () => clearTimeout(id);
  }, [q]);
  const aktion = async (art, id) => {
    setFehler(null);
    try { await DIENSTE.freundAktion(art, id); await laden(); } catch (e) { setFehler(e.message); }
  };
  // Eigene Freigabe für diesen Freund (Server, Update 21) – sofort in der Liste zeigen, bei Fehler neu laden
  const teilen = async (id, art, wert) => {
    setListe((l) => l.map((x) => (x.id === id ? { ...x, teilt: { ...x.teilt, [art]: wert } } : x)));
    try { await DIENSTE.freigabeSetzen(id, art, wert); } catch (e) { setFehler(e.message); laden(); }
  };
  const umschalten = (id, art) => {
    const alt = einst.freundeAus ?? {}, f = { ...(alt[id] ?? {}) };
    f[art] = f[art] === false;                                 // false = ausgeblendet; zurück auf an entfernt den Eintrag
    if (f[art]) delete f[art];
    setEinst({ ...einst, freundeAus: { ...alt, [id]: f } });
  };
  if (liste === false) return html`<section class="hint immer">${I.warn}<span class="t">Datenbank-Update 19 fehlt</span><span></span><p>Freunde brauchen <b>db/19_freunde.sql</b> in Supabase.</p></section>`;
  const l = liste ?? [];
  const rein = l.filter((x) => x.status === 'offen' && x.richtung === 'rein'), raus = l.filter((x) => x.status === 'offen' && x.richtung === 'raus');
  const freunde = l.filter((x) => x.status === 'angenommen'), blockiert = l.filter((x) => x.status === 'blockiert');
  const bekannt = new Map(l.map((x) => [x.id, x]));
  const zeile = (x, rechts) => html`<div key=${x.id} class="freund-zeile"><${Avatar} bild=${x.avatar} name=${x.name} groesse=${34}/><b>${x.name}</b><span class="row" style="gap:6px">${rechts}</span></div>`;
  return html`<div class="stack" style="gap:12px">
    ${rein.length ? html`<section class="card pad stack anfragen-karte"><span class="viz-t">Anfragen an dich</span>
      ${rein.map((x) => zeile(x, html`<button class="btn btn-go btn-sm" onClick=${() => aktion('annehmen', x.id)}>Annehmen</button>
        <button class="iconbtn klein" aria-label="Ablehnen" onClick=${() => aktion('entfernen', x.id)}>${I.zu}</button>`))}</section>` : null}
    <section class="card pad stack">
      <label class="field" for="f-suche"><span class="label">Freunde finden</span>
        <input id="f-suche" class="text" type="search" placeholder="Anzeigename suchen" value=${q} onInput=${(e) => setQ(e.currentTarget.value)}/></label>
      ${treffer.map((x) => { const b = bekannt.get(x.id);
        return zeile(x, b?.status === 'angenommen' ? html`<span class="muted" style="font-size:12.5px">Freund</span>`
          : b?.status === 'offen' && b.richtung === 'raus' ? html`<span class="muted" style="font-size:12.5px">angefragt</span>`
          : b?.status === 'offen' ? html`<button class="btn btn-go btn-sm" onClick=${() => aktion('annehmen', x.id)}>Annehmen</button>`
          : b?.status === 'blockiert' ? html`<span class="muted" style="font-size:12.5px">blockiert</span>`
          : html`<button class="btn btn-chalk btn-sm" onClick=${() => aktion('anfragen', x.id)}>Anfragen</button>`); })}
      ${q.trim().length >= 2 && !treffer.length ? html`<span class="muted" style="font-size:13px">Niemand mit diesem Namen.</span>` : null}
      ${fehler ? html`<p class="fehler">${fehler}</p>` : null}
    </section>
    <section class="card pad stack"><span class="viz-t">Deine Freunde</span>
      ${!freunde.length ? html`<p class="muted" style="margin:0;font-size:13.5px">Noch keine Freunde. Such oben nach dem Anzeigenamen und schick eine Anfrage – sobald sie angenommen ist, seht ihr euch im Feed, im Kalender und im Vergleich (so weit ihr es in den Einstellungen unter „Freunde“ freigebt).</p>` : null}
      ${freunde.map((x) => html`<div key=${x.id} class="freund-block">
        ${zeile(x, html`<button class="iconbtn klein" aria-expanded=${String(offen === x.id)} aria-label="Einstellungen für diesen Freund" onClick=${() => setOffen(offen === x.id ? null : x.id)}><span class="woche-pfeil" style="background:none">${I.weiter}</span></button>`)}
        ${offen === x.id ? html`<div class="freund-optionen">
          ${/* Tabelle: je Art eine Zeile, Spalten „Ich teile“ (Freigabe in der DB) und „Ich sehe“ (nur Anzeige) */ ''}
          <div class="freigabe-tabelle" role="table" aria-label=${`Freigaben mit ${x.name}`}>
            <span></span><b class="ft-kopf">Ich teile</b><b class="ft-kopf">Ich sehe</b>
            ${SICHT.map(([art, text]) => html`<span key=${'n' + art} class="ft-art">${text}</span>
              <span key=${'t' + art} class="ft-zelle">${x.teilt ? html`<input type="checkbox" class="ft-schalter" aria-label=${`${text} teilen`} checked=${x.teilt[art] !== false} onChange=${(ev) => teilen(x.id, art, ev.currentTarget.checked)}/>` : html`<span class="muted">–</span>`}</span>
              <span key=${'s' + art} class="ft-zelle"><input type="checkbox" class="ft-schalter" aria-label=${`${text} sehen`} checked=${sichtbar(einst, x.id, art)} onChange=${() => umschalten(x.id, art)}/></span>`)}
          </div>
          <span class="muted" style="font-size:12px">${`„Ich teile“: was ${x.name} von dir sieht. „Ich sehe“: was du von ${x.name} angezeigt bekommst.`}</span>
          <div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => aktion('entfernen', x.id)}>Entfernen</button>
            <button class="btn btn-gefahr btn-sm" style="flex:1" onClick=${() => aktion('blockieren', x.id)}>Blockieren</button></div>
          ${DIENSTE.melden ? html`<button class="link" style="justify-self:start;font-size:13px" onClick=${() => DIENSTE.melden(x.id, x.name)}>Melden</button>` : null}</div>` : null}</div>`)}
    </section>
    ${raus.length ? html`<section class="card pad stack"><span class="viz-t">Gesendete Anfragen</span>
      ${raus.map((x) => zeile(x, html`<button class="btn btn-soft btn-sm" onClick=${() => aktion('entfernen', x.id)}>Zurückziehen</button>`))}</section>` : null}
    ${blockiert.length ? html`<section class="card pad stack"><span class="viz-t">Blockiert</span>
      ${blockiert.map((x) => zeile(x, html`<button class="btn btn-soft btn-sm" onClick=${() => aktion('entfernen', x.id)}>Freigeben</button>`))}</section>` : null}
  </div>`;
}

// Letzter Stand im Gerät: der Feed erscheint sofort, die Abfrage aktualisiert im Hintergrund
const CACHE = 'prh-feed';
const ausCache = () => { try { return JSON.parse(localStorage.getItem(CACHE)) ?? []; } catch { return []; } };
const inCache = (f) => { try { localStorage.setItem(CACHE, JSON.stringify(f)); } catch { /* voll oder gesperrt */ } };

/** 185: Like und Kommentare unter einem Feed-Eintrag – sofort angezeigt, dann gespeichert (bei Fehler zurück). */
function Reaktionen({ e, r, offen, umschalten, neu }) {
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState(null);
  const liken = async () => {
    const vorher = r, jetzt = { ...r, ich: !r.ich, likes: r.likes + (r.ich ? -1 : 1) };
    neu(jetzt); setFehler(null);
    try { await DIENSTE.liken(e.id, jetzt.ich); } catch (x) { neu(vorher); setFehler(x.message); }
  };
  const senden = async () => {
    const t = text.trim(); if (!t) return;
    const k = { id: `neu-${Date.now()}`, name: 'Du', text: t, zeit: new Date().toISOString(), ich: true };
    neu({ ...r, kommentare: [...r.kommentare, k] }); setText(''); setFehler(null);
    try { await DIENSTE.kommentieren(e.id, t); } catch (x) { neu(r); setText(t); setFehler(x.message); }
  };
  // Gedrückt halten (oder Rechtsklick) öffnet das Menü: Löschen (Verfasser und Besitzer des Trainings), Melden (fremde)
  const uhr = useState({})[0];
  // als eigenes Fenster (die Karte mit Glaseffekt würde ein festes Fenster sonst in sich einsperren)
  const setMenue = (k) => zeigeFenster((zu) => html`<${Sheet} zu=${zu} label="Kommentar">
      <div class="kommentar-vorschau"><b>${k.ich ? 'Du' : k.name}</b><span>${k.text}</span></div>
      <div class="stack" style="gap:8px">
        ${k.ich || e.ich ? html`<button class="btn btn-gefahr btn-block" onClick=${() => { zu(); loeschen(k.id); }}>${I.papierkorb} Löschen</button>` : null}
        ${!k.ich && DIENSTE.melden ? html`<button class="btn btn-soft btn-block" onClick=${() => { zu(); setTimeout(() => DIENSTE.melden(k.uid ?? null, k.name, `Kommentar von ${k.name}: „${k.text}“`), 80); }}>${I.warn} Melden</button>` : null}
        <button class="btn btn-soft btn-block" onClick=${zu}>Abbrechen</button></div>
    <//>`);
  const langDruck = (k) => ({
    onPointerDown: (ev) => { uhr.x = ev.clientX; uhr.y = ev.clientY; clearTimeout(uhr.t); uhr.t = setTimeout(() => { vibriere(15); setMenue(k); }, 500); },
    onPointerMove: (ev) => { if (Math.abs(ev.clientX - uhr.x) > 8 || Math.abs(ev.clientY - uhr.y) > 8) clearTimeout(uhr.t); },
    onPointerUp: () => clearTimeout(uhr.t), onPointerLeave: () => clearTimeout(uhr.t), onPointerCancel: () => clearTimeout(uhr.t),
    onContextMenu: (ev) => { ev.preventDefault(); clearTimeout(uhr.t); setMenue(k); },
  });
  const loeschen = async (kid) => {
    neu({ ...r, kommentare: r.kommentare.filter((k) => k.id !== kid) });
    try { if (!String(kid).startsWith('neu-')) await DIENSTE.kommentarLoeschen(kid); } catch (x) { neu(r); setFehler(x.message); }
  };
  return html`<div class="reaktionen">
    <div class="row" style="gap:6px">
      <button class=${`chip reakt ${r.ich ? 'an' : ''}`} aria-pressed=${String(r.ich)} onClick=${liken} aria-label="Gefällt mir">${r.ich ? '♥' : '♡'}<b>${r.likes || ''}</b></button>
      <button class="chip reakt" aria-expanded=${String(offen)} onClick=${umschalten}>💬<b>${r.kommentare.length || ''}</b></button></div>
    ${offen ? html`<div class="kommentare">
      ${r.kommentare.map((k) => html`<div key=${k.id} class="kommentar" ...${langDruck(k)}><b>${k.ich ? 'Du' : k.name}</b><span>${k.text}</span></div>`)}
      <div class="row" style="gap:6px"><input class="text" type="text" maxlength="500" placeholder="Kommentar schreiben …" aria-label="Kommentar" value=${text}
        onInput=${(ev) => setText(ev.currentTarget.value)} onKeyDown=${(ev) => ev.key === 'Enter' && senden()}/>
        <button class="btn btn-chalk btn-sm" disabled=${!text.trim()} onClick=${senden}>Senden</button></div></div>` : null}
    ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
  </div>`;
}

export function Feed({ einst, setEinst = () => {}, anfragen = 0, neuReakt = [], gesehen = () => {}, aktiv = [], zuEinstellungen }) {
  // Reiter merkt sich die Sitzung (Neuladen bleibt bei „Freunde“); neu geöffnete App startet bei „Feed“
  const [reiter, setReiterRoh] = useState(() => UNTER_VORSCHAU.feed ?? (() => { try { return sessionStorage.getItem('prh-reiter-feed'); } catch { return null; } })() ?? 'feed');
  const setReiter = (k) => { setReiterRoh(k); try { sessionStorage.setItem('prh-reiter-feed', k); } catch { /* egal */ } };
  const [feedGruppe, setFeedGruppe] = useState(null);           // 218: Feed nach Gruppe filtern
  useUnterReiter('feed', [['feed'], ['freunde'], ['challenges']], reiter, (k) => { setReiter(k); scrollTo({ top: 0 }); });
  const [stand, setStand] = useState({ laedt: !DEMO, eintraege: DEMO ? demoFeed() : ausCache(), fehler: null, fehlt: false });
  const [offen, setOffen] = useState(null);
  const [uebAuf, setUebAuf] = useState(() => new Set());       // aufgeklappte Übungen (Feed-Eintrag-Id + Index)
  const umschaltenUeb = (id) => setUebAuf((alt) => { const n = new Set(alt); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // 185: Likes und Kommentare (Update 27); null = Update fehlt → Leiste ausgeblendet
  const [reakt, setReakt] = useState(() => zwischen.lies('reaktionen') ?? {});
  const [kommOffen, setKommOffen] = useState(null);
  const reaktionenLaden = (liste) => DIENSTE.ladeReaktionen?.(liste.map((e) => e.id).filter(Boolean)).then((r) => { setReakt(r ?? null); if (r) zwischen.schreib('reaktionen', r); }).catch(() => {});
  const laden = async () => {
    if (DEMO || !DIENSTE.ladeFeed) return;
    setStand((s) => ({ ...s, laedt: true, fehler: null }));
    try {
      const f = await DIENSTE.ladeFeed();
      if (f) inCache(f);
      setStand({ laedt: false, eintraege: f ?? [], fehler: null, fehlt: f == null });
      if (f) reaktionenLaden(f);
    } catch (e) { setStand((s) => ({ ...s, laedt: false, fehler: navigator.onLine ? e.message : 'Kein Netz – der Feed braucht eine Verbindung.' })); }
  };
  useEffect(() => { laden(); }, []);
  // 190: Neues bleibt sichtbar, solange die Seite offen ist; „gesehen“ geht nach 2 s an den Server (Zahl am Reiter weg)
  const [neuHier] = useState(() => neuReakt);
  const neuIds = new Set(neuHier.map((x) => x.id));
  useEffect(() => { if (neuReakt.length) { const t = setTimeout(gesehen, 2000); return () => clearTimeout(t); } }, [neuReakt.length]);
  const name = (u) => (u.key ? nameVon(u.key, sprache() === 'en' ? u.en : u.de) : '–');
  const geteilt = einst.feedTeilen !== false;
  const [zuschauen, setZuschauen] = useState(null);       // 258: Freund, dessen laufendes Training angezeigt wird
  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Trainings von dir und deinen Freunden</div><h1 class="h1">Feed</h1></div>
      ${DEMO ? html`<span class="proto">Beispieldaten</span>` : html`<button class=${`iconbtn ${stand.laedt ? 'dreht' : ''}`} onClick=${laden} aria-label="Neu laden" disabled=${stand.laedt}>${I.neu}</button>`}</header>
    ${stand.fehlt ? html`<section class="hint immer">${I.warn}<span class="t">Datenbank-Update 15 fehlt</span><span></span>
      <p>Der Feed braucht <b>db/15_feed.sql</b> in Supabase. Bis dahin bleibt er leer.</p></section>` : null}
    <div class="reiter" role="tablist">${[['feed', 'Feed'], ['freunde', 'Freunde'], ['challenges', 'Challenges']].map(([k, n]) => html`<button key=${k} role="tab" aria-selected=${String(reiter === k)} onClick=${() => setReiter(k)}>
      ${n}${k === 'freunde' && anfragen ? html`<i class="anfrage-punkt">${anfragen}</i>` : null}</button>`)}</div>
    <div class="unter-inhalt">
    ${reiter === 'freunde' ? html`<div class="stack" style="gap:12px"><${CoachAnfragen}/><${Freunde} einst=${einst} setEinst=${setEinst}/><${GruppenVerwaltung} einst=${einst} setEinst=${setEinst}/></div>` : reiter === 'challenges' ? html`<${ChallengesReiter} einst=${einst}/>` : html`<div class="reiter-inhalt stack" style="gap:12px">
    ${aktiv.length ? html`<section class="card pad stack trainiert-gerade"><span class="viz-t">${deEn('Trainiert gerade', 'Training right now')}</span>
      ${aktiv.map((a) => { const min = Math.max(1, Math.round((Date.now() - Date.parse(a.seit)) / 60000)), kurz = standKurz(a.stand);
        // 258: Antippen zeigt das Training (Übungen, Sätze, Fortschritt), ohne beizutreten
        return html`<div key=${a.id} class="aktiv-zeile"><button class="aktiv-ansehen" disabled=${!a.stand?.length} onClick=${() => setZuschauen(a.id)}
            aria-label=${deEn(`Training von ${a.name} ansehen`, `View ${a.name}'s workout`)}><span class="aktiv-avatar"><${Avatar} bild=${a.avatar} name=${a.name} groesse=${34}/><i></i></span>
          <span style="flex:1;min-width:0"><span class="aktiv-z1"><b>${a.name}</b><small class="muted">${` · ${deEn(`seit ${min} min`, `for ${min} min`)}${a.titel ? ` · ${a.titel}` : ''}`}</small></span>
            ${kurz ? html`<small class="aktiv-stand">${kurz}</small>` : null}</span></button>
          ${DIENSTE.mitmachen && a.stand?.length ? html`<button class="btn btn-soft btn-sm" onClick=${() => DIENSTE.mitmachen(a)}>${deEn('Mitmachen', 'Join')}</button>` : null}</div>`; })}
    </section>` : null}
    ${(() => { const a = zuschauen && aktiv.find((x) => x.id === zuschauen); if (!zuschauen) return null;
      return html`<${Sheet} zu=${() => setZuschauen(null)} label=${deEn('Training ansehen', 'View workout')}>
        ${a ? html`<h2 class="h2">${a.titel || deEn(`Training von ${a.name}`, `${a.name}'s workout`)}</h2>
          <${PartnerLeiste} p=${a} offen=${true}/>
          <p class="muted" style="margin:0;font-size:12.5px">${deEn('Aktualisiert sich von selbst, solange das Fenster offen ist.', 'Updates by itself while this window is open.')}</p>
          ${DIENSTE.mitmachen ? html`<button class="btn btn-chalk btn-block" onClick=${() => { setZuschauen(null); DIENSTE.mitmachen(a); }}>${deEn('Mitmachen', 'Join')}</button>` : null}`
        : html`<p style="margin:0">${deEn('Das Training ist beendet.', 'The workout has ended.')}</p>`}
      <//>`; })()}
    ${neuHier.length ? html`<section class="card pad stack neu-reakt"><span class="viz-t">${deEn(`Neu für dich (${neuHier.length})`, `New for you (${neuHier.length})`)}</span>
      ${neuHier.slice(0, 6).map((x, i) => html`<div key=${i} class="neu-reakt-zeile"><span aria-hidden="true">${x.art === 'like' ? '♥' : '💬'}</span>
        <span><b>${x.name}</b> ${x.art === 'like' ? deEn('gefällt dein Training', 'liked your workout') : html`${deEn('kommentiert', 'commented')}: „${x.text}“`}<small class="muted">${` · ${datumKurz(x.datum)}`}</small></span></div>`)}
    </section>` : null}
    ${einst.kalender !== false ? html`<${Kalender} eintraege=${stand.eintraege} einst=${einst}/>` : null}
    ${stand.fehler ? html`<p class="fehler">${stand.fehler}</p>` : null}
    ${stand.laedt && !stand.eintraege.length ? html`<p class="muted">Lade …</p>` : null}
    ${!stand.laedt && !stand.eintraege.length && !stand.fehlt && geteilt ? html`<section class="card pad"><p class="muted" style="margin:0">In den letzten 30 Tagen noch keine geteilten Trainings.</p></section>` : null}
    <${GruppenFilter} gruppen=${einst.gruppen ?? []} wert=${feedGruppe} setWert=${setFeedGruppe}/>
    ${stand.eintraege.filter((e) => e.ich || !e.nutzer || (sichtbar(einst, e.nutzer, 'feed') && inGruppe(einst.gruppen, feedGruppe, e.nutzer))).map((e) => html`<article key=${e.id} class=${`card pad stack feed-eintrag ${e.prs ? 'mit-pr' : ''} ${neuIds.has(e.id) ? 'hat-neues' : ''}`}>
      <div class="feed-kopf"><${Avatar} bild=${e.avatar} name=${e.name} groesse=${40}/>
        <div style="min-width:0;flex:1"><b>${e.ich ? 'Du' : e.name}</b><div class="muted" style="font-size:12.5px">${datumLang(e.datum)}</div></div>
        ${e.prs ? html`<span class="feed-pr"><span class="medaille">PR</span><b>${e.prs}</b></span>` : null}</div>
      <div class="feed-zahlen">
        <div><span class="eyebrow">Dauer</span><b>${e.minuten ? (e.minuten < 60 ? minutenText(e.minuten) : `${Math.floor(e.minuten / 60)}:${String(Math.round(e.minuten % 60)).padStart(2, '0')} h`) : '–'}</b></div>
        <div><span class="eyebrow">Übungen</span><b>${e.uebungen}</b></div>
        <div><span class="eyebrow">Sätze</span><b>${e.saetze}</b></div>
        <div><span class="eyebrow">Volumen</span><b>${tonnage(e.volumen)}</b></div></div>
      ${/* Je Übung zugeklappt: Name und Satzzahl; aufgeklappt die Sätze untereinander (Gewicht × Wdh) */ ''}
      <ul class="feed-liste feed-uebungen">${(offen === e.id ? e.liste : e.liste.slice(0, 4)).map((u, i) => {
        const id = `${e.id}-${i}`, auf = uebAuf.has(id);
        const folge = (u.folge ?? []).filter((g) => (g.kg ?? 0) > 0 || (g.wdh ?? 0) > 0);
        return html`<li key=${i}>
          <button class="feed-ueb-kopf" aria-expanded=${String(auf)} onClick=${() => umschaltenUeb(id)}>
            <span class="feed-name">${name(u)}</span><span class="muted">${`${u.saetze} Sätze`}</span>
            ${u.prs ? html`<span class="tag gold">PR</span>` : html`<span></span>`}<span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></button>
          ${auf ? html`<ul class="feed-saetze">${folge.length ? folge.map((g, j) => html`<li key=${j}><span class="muted">${g.n > 1 ? `${g.n} ×` : ''}</span><b>${g.kg != null ? gwE(g.kg) : '–'}</b><span>${`× ${g.wdh ?? '–'}`}</span></li>`)
            : html`<li><span></span><b>${u.kg != null && u.wdh != null ? gwE(u.kg) : '–'}</b><span>${u.wdh != null ? `× ${u.wdh}` : ''}</span></li>`}</ul>` : null}
        </li>`;
      })}</ul>
      ${e.liste.length > 4 ? html`<button class="link" style="justify-self:start" onClick=${() => setOffen(offen === e.id ? null : e.id)}>${offen === e.id ? 'Weniger' : `Alle ${e.liste.length} Übungen`}</button>` : null}
      ${reakt && DIENSTE.liken && e.id ? html`<${Reaktionen} e=${e} r=${reakt[e.id] ?? { likes: 0, ich: false, kommentare: [] }} offen=${kommOffen === e.id}
        umschalten=${() => setKommOffen(kommOffen === e.id ? null : e.id)} neu=${(r) => setReakt((alt) => ({ ...alt, [e.id]: r }))}/>` : null}
    </article>`)}
    </div>`}
    </div>
  </div>`;
}
