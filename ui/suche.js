// PR Hunter · Übungssuche mit Vorschlagsliste (Combobox). Sucht in Deutsch, Englisch und Jefit-Namen,
// filtert nach Muskelgruppe und Equipment, zeigt Favoriten und zuletzt trainierte Übungen oben.
// Passt nichts, lässt sich eine neue Übung anlegen (Formular in ui/uebung.js, über DIENSTE).
import { html, useState, useEffect, I, katalogListe, LIFT, liftVon, nameVon, anpassung, sprache, MUSKEL_DE, datumKurz, UebungsBild, Sheet, speicher, zeigeFenster } from './basis.js';
import { MuskelWahl, ZONE_NAME } from './koerper.js';
import { MUSKELGRUPPEN } from '../js/bodybuilding.js';
import { useRef } from '../vendor/htm-preact.js';
import { ZULETZT, DIENSTE } from './stand.js';

export const FAMILIE = {
  squat: 'Kniebeuge', bench: 'Bankdrücken', deadlift: 'Kreuzheben', press: 'Drücken', row: 'Rudern', pull_up: 'Klimmzug',
  pulldown: 'Latzug', curl: 'Bizeps', triceps: 'Trizeps', shoulder_iso: 'Schulter', fly: 'Brust', push_up: 'Liegestütz',
  dip: 'Dips', leg_iso: 'Beine iso.', lunge: 'Ausfallschritt', squat_machine: 'Beinmaschine', hinge: 'Hüftstreckung',
  core: 'Rumpf', shrug: 'Nacken/Trapez', forearm: 'Unterarm', neck: 'Hals', olympic: 'Olympisch', plyometrics: 'Sprung',
  conditioning: 'Kondition', mobility: 'Mobilität', strongman: 'Strongman',
};
export const EQUIPMENT = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', 'body only': 'Körpergewicht', cable: 'Kabel', machine: 'Maschine',
  kettlebell: 'Kettlebell', bands: 'Band', 'ez bar': 'SZ-Stange', 'e-z curl bar': 'SZ-Stange', 'medicine ball': 'Medizinball',
  'exercise ball': 'Gymnastikball', 'foam roll': 'Faszienrolle', other: 'Sonstiges', none: 'ohne',
};
const EQUIPMENT_FILTER = ['barbell', 'dumbbell', 'body only', 'cable', 'machine', 'kettlebell', 'bands', 'ez bar', 'other'];
const passtEquipment = (e, eq) => !eq || e.eq === eq || (eq === 'ez bar' && e.eq === 'e-z curl bar');

// Muskelzonen des Diagramms → Katalogmuskeln (free-exercise-db), die Schulter zusätzlich über den Namen getrennt
const ZONEN = {
  brust: ['chest'], schulter_vorn: ['shoulders', null, /lateral|seitheb|rear|reverse|face pull|hintere|upright|aufrecht/],
  schulter_seite: ['shoulders', /lateral|seitheb|upright|aufrecht/], schulter_hinten: [['shoulders', 'middle back'], /rear|reverse fl|face pull|hintere|reverse-fl/],
  trapez: ['traps'], oberer_ruecken: ['middle back', null, /rear|reverse fl|reverse-fl/], latissimus: ['lats'], ruecken_unten: ['lower back'],
  bizeps: ['biceps'], trizeps: ['triceps'], unterarme: ['forearms'], bauch: ['abdominals'], quadrizeps: ['quadriceps'], adduktoren: ['adductors'],
  abduktoren: ['abductors'], gesaess: ['glutes'], beinbeuger: ['hamstrings'], waden: ['calves'],
};
const OHNE_FAMILIEN = new Set(['mobility', 'plyometrics', 'conditioning']);     // Dehnen, Sprünge, Kondition: nicht in der Muskelsuche
export const ISO_FAMILIEN = new Set(['curl', 'triceps', 'shoulder_iso', 'fly', 'leg_iso', 'shrug', 'forearm', 'neck', 'core']);
export function zonePasst(e, zone) {
  const [m, nur, nicht] = ZONEN[zone] ?? [];
  if (!m || OHNE_FAMILIEN.has(e.f)) return false;
  return [].concat(m).some((x) => e.m.includes(x)) && (!nur || nur.test(e.s)) && (!nicht || !nicht.test(e.s));
}
// Beliebtheit: von dir trainiert, Favorit, bewährte Standardübung (Generator-Auswahl, Wettkampf), mit Bild, Grundform ohne Klammer
const BEWAEHRT = new Set([...Object.values(MUSKELGRUPPEN).flatMap((g) => g.uebungen.map(([k]) => k)), 'competition_squat', 'competition_bench_press', 'competition_deadlift']);
const beliebt = (e) => (ZULETZT[e.k] ? 4 : 0) + (anpassung(e.k)?.favorit ? 3 : 0) + (BEWAEHRT.has(e.k) ? 3 : 0) + (e.i ? 1 : 0) + (e.de.includes('(') ? 0 : 1);

/** Reihenfolge: exakter Name, Name beginnt mit der Eingabe, mit dem ersten Wort, sonst. */
function rang(e, q, w0) {
  if (!q) return 0;
  const de = e.de.toLowerCase(), en = e.en.toLowerCase(), eigen = anpassung(e.k)?.name?.toLowerCase();
  return de === q || en === q || eigen === q ? 0 : de.startsWith(q) || en.startsWith(q) || eigen?.startsWith(q) ? 1
    : de.startsWith(w0) || en.startsWith(w0) ? 2 : 3;
}

/** Treffer für Suchtext und Filter; dann Favoriten, zuletzt trainierte (neueste zuerst), kürzere Namen. */
export function suche(liste, { q = '', familien = null, muskel = '', equipment = '', zone = null, mitVersteckten = false, max = 60, sortierung = null, art = '' } = {}) {
  const woerter = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const eingabe = woerter.join(' ');
  const name = (e) => nameVon(e.k);
  // 154: Sortierung „beliebt“ (trainiert, Favorit, Standardübung …) oder „name“ (A–Z); ohne Angabe wie bisher
  const nachName = sortierung === 'name', nachBeliebt = sortierung === 'beliebt' || (!sortierung && zone);
  return liste
    .filter((e) => (!familien || familien.includes(e.f)) && (!muskel || e.m.includes(muskel)) && (!zone || zonePasst(e, zone)) && passtEquipment(e, equipment)
      && (!art || (art === 'iso') === ISO_FAMILIEN.has(e.f))
      && (mitVersteckten || !anpassung(e.k)?.versteckt)
      && woerter.every((w) => e.s.includes(w) || anpassung(e.k)?.name?.toLowerCase().includes(w)))
    .map((e) => [e, rang(e, eingabe, woerter[0]), anpassung(e.k)?.favorit ? 0 : 1, ZULETZT[e.k] ?? '', nachBeliebt ? -beliebt(e) : 0])
    .sort((a, b) => a[1] - b[1] || (nachName ? name(a[0]).localeCompare(name(b[0]), sprache()) : 0) || a[4] - b[4] || a[2] - b[2] || b[3].localeCompare(a[3])
      || (eingabe ? a[0].de.length - b[0].de.length : name(a[0]).localeCompare(name(b[0]), sprache())))
    .slice(0, max).map(([e]) => e);
}

/** 209: Stern zum Merken direkt in der Auswahl (gleiche Favoriten wie auf der Übungsseite, im Konto gespeichert). */
function Stern({ k }) {
  const [an, setAn] = useState(!!anpassung(k)?.favorit);
  if (!DIENSTE.speichereAnpassung) return null;
  const umschalten = () => { const a = anpassung(k) ?? {}; setAn(!an); DIENSTE.speichereAnpassung(k, { ...a, favorit: !an }); };
  return html`<button class=${`aw-stern ${an ? 'an' : ''}`} aria-pressed=${String(an)} aria-label=${an ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten'} onClick=${umschalten}>${an ? '★' : '☆'}</button>`;
}

/** 209: Favoriten und zuletzt benutzte Übungen als Schnellwahl oben (nur ohne Suche und Filter). */
function Schnellwahl({ familien, waehle }) {
  const passt = (e) => (!familien || familien.includes(e.f)) && !anpassung(e.k)?.versteckt;
  const liste = katalogListe().filter(passt);
  const favs = liste.filter((e) => anpassung(e.k)?.favorit).sort((a, b) => (ZULETZT[b.k] ?? '').localeCompare(ZULETZT[a.k] ?? '')).slice(0, 12);
  const zuletzt = liste.filter((e) => ZULETZT[e.k] && !anpassung(e.k)?.favorit).sort((a, b) => ZULETZT[b.k].localeCompare(ZULETZT[a.k])).slice(0, 10);
  const reihe = (titel, l) => (l.length ? html`<div class="aw-schnell"><span class="eyebrow">${titel}</span>
    <div class="aw-schnell-reihe">${l.map((e) => html`<button key=${e.k} class="aw-kachel" onClick=${() => waehle(e.k)}><${UebungsBild} schluessel=${e.k} groesse=${52} zoom=${false}/><span>${nameVon(e.k)}</span></button>`)}</div></div>` : null);
  return html`${reihe('★ Favoriten', favs)}${reihe('Zuletzt benutzt', zuletzt)}`;
}

/** Ein Treffer: großes Bild, Name, andere Sprache · Gerät · zuletzt, Familie. */
function TrefferZeile({ e, waehle }) {
  const fav = anpassung(e.k)?.favorit, zul = ZULETZT[e.k], lift = liftVon(e.k);
  return html`<div class="aw-zeile"><button class="aw-treffer" onClick=${() => waehle(e.k)}>
    <${UebungsBild} schluessel=${e.k} groesse=${56}/>
    <span class="aw-text"><b>${fav ? html`<span class="stern" aria-label="Favorit">★</span> ` : null}${nameVon(e.k)}</b>
      <small><span translate="no">${sprache() === 'en' ? e.de : e.en}</span></small>
      <small>${e.eq ? html`<span>${EQUIPMENT[e.eq] ?? e.eq}</span>` : null}${zul ? html` · <span>${`zuletzt ${datumKurz(zul)}`}</span>` : null}${e.eigen ? html` · <span>eigene</span>` : null}</small></span>
    <span class="aw-familie">${lift !== 'andere' ? html`<i class="dot" style=${`background:${LIFT[lift].farbe}`}></i>` : null}<span>${FAMILIE[e.f] ?? e.f}</span>
      <span class="aw-art">${ISO_FAMILIEN.has(e.f) ? 'Isolation' : 'Grundübung'}</span></span>
  </button><${Stern} k=${e.k}/></div>`;
}

/**
 * 161/145/154: Übungsauswahl als Vollbild-Fenster – überall dieselbe (Training, Tauschen, Eigener Plan, Editor,
 * Generatoren, Verlauf, Import). Suche, Muskel über das Körperdiagramm (feine Zonen), Grund-/Isolationsübung,
 * Gerät, Sortierung nach Beliebtheit oder Name; familien = Vorauswahl eines Platzes („Alle Übungen“ hebt sie auf).
 */
export function UebungsAuswahl({ titel = 'Übung wählen', familien = null, zoneStart = null, onWahl, zu, merken = null, zustand = null }) {
  const [q, setQ] = useState(zustand?.q ?? '');
  const [alle, setAlle] = useState(zustand?.alle ?? !familien);
  const [zone, setZone] = useState(zustand?.zone ?? zoneStart);
  const [koerper, setKoerper] = useState(false);              // Diagramm nur auf Wunsch offen, nach der Wahl wieder zu
  const [equipment, setEquipment] = useState(zustand?.equipment ?? '');
  const [art, setArt] = useState(zustand?.art ?? '');
  const [sortierung, setSortierung] = useState(() => speicher.lies('prh-sortierung') ?? 'beliebt');
  const [max, setMax] = useState(80);
  const fam = alle ? null : familien;
  const treffer = suche(katalogListe(), { q, familien: fam, zone, equipment, art, sortierung, max: max + 1 });
  const mehr = treffer.length > max;
  // erst schließen, dann melden: so räumt das Fenster seinen Verlaufseintrag auf, bevor ein Elternfenster zugeht
  // merken: Auswahl führt auf eine andere Seite (Verlauf → Übung) – Zustand merken, damit „Zurück“ wieder hierher führt
  const waehle = (k) => { merken?.({ q, alle, zone, equipment, art }); zu(); setTimeout(() => onWahl(k), 60); };
  const neu = DIENSTE.neueUebungStarten ? () => { const text = q.trim(); zu(); setTimeout(() => DIENSTE.neueUebungStarten(text, onWahl), 60); } : null;
  const sortieren = (s) => { setSortierung(s); speicher.schreib('prh-sortierung', s); };
  const filterZahl = [zone, equipment, art].filter(Boolean).length;
  return html`<${Sheet} zu=${zu} label=${titel} voll=${true}>
    <div class="aw-kopf">
      <div class="row between"><h2 class="h2" style="margin:0">${titel}</h2><button class="iconbtn" onClick=${zu} aria-label="Schließen">${I.zu}</button></div>
      <div class="suche">${I.suche}<input type="search" autocomplete="off" placeholder="Übung suchen …" value=${q} onInput=${(e) => { setQ(e.currentTarget.value); setMax(80); }}/></div>
      <div class="aw-leiste">
        <div class="seg aw-seg" role="group" aria-label="Sortierung">${[['beliebt', 'Beliebt'], ['name', 'A–Z']].map(([k, n]) => html`<button key=${k} aria-pressed=${String(sortierung === k)} onClick=${() => sortieren(k)}>${n}</button>`)}</div>
        <div class="seg aw-seg" role="group" aria-label="Art">${[['', 'Alle'], ['grund', 'Grundübung'], ['iso', 'Isolation']].map(([k, n]) => html`<button key=${k || 'alle'} aria-pressed=${String(art === k)} onClick=${() => setArt(k)}>${n}</button>`)}</div>
      </div>
      <div class="chips-zeile">
        <button class="chip" aria-pressed=${String(koerper || !!zone)} aria-expanded=${String(koerper)} onClick=${() => setKoerper(!koerper)}>${zone ? ZONE_NAME[zone] : 'Muskel wählen'}</button>
        ${familien ? html`<button class="chip" aria-pressed=${String(alle)} onClick=${() => setAlle(!alle)}>Alle Übungen</button>` : null}
        ${['', ...EQUIPMENT_FILTER].map((k) => html`<button key=${k || 'alle'} class="chip" aria-pressed=${String(equipment === k)} onClick=${() => setEquipment(k)}>${k ? EQUIPMENT[k] : 'Alle Geräte'}</button>`)}
      </div>
      ${koerper ? html`<div class="aw-koerper"><${MuskelWahl} zone=${zone} waehle=${(z) => { setZone(z); setMax(80); if (z) setTimeout(() => setKoerper(false), 250); }}/>
        <button class="btn btn-chalk btn-block" onClick=${() => setKoerper(false)}>${zone ? `${ZONE_NAME[zone]} anzeigen` : 'Fertig'}</button></div>` : null}
      <span class="muted aw-zahl">${`${Math.min(treffer.length, max)}${mehr ? '+' : ''} Treffer`}${fam ? ' · passend zum Platz' : ''}${filterZahl ? ` · ${filterZahl} Filter` : ''}</span>
    </div>
    <div class="aw-liste">
      ${!q.trim() && !filterZahl ? html`<${Schnellwahl} familien=${fam} waehle=${waehle}/>` : null}
      ${treffer.slice(0, max).map((e) => html`<${TrefferZeile} key=${e.k} e=${e} waehle=${waehle}/>`)}
      ${mehr ? html`<button class="btn btn-soft btn-block" onClick=${() => setMax(max + 120)}>Mehr zeigen</button>` : null}
      ${!treffer.length ? html`<p class="muted" style="margin:0;padding:14px 4px">Nichts gefunden. Anderes Wort, Filter lösen${fam ? ' oder „Alle Übungen“ einschalten' : ''}.</p>` : null}
      ${neu ? html`<button class="aw-neu" onClick=${neu}><b>+ ${q.trim() ? `„${q.trim()}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</b><small>Mit Duplikatprüfung, danach für alle verfügbar</small></button>` : null}
    </div>
  <//>`;
}

/** Auslöser in Karten und Fenstern: sieht aus wie ein Suchfeld, öffnet die große Auswahl. */
export function UebungSuche({ id, familien = null, onWahl, platzhalter = 'Übung suchen …', autofokus = false, titel = null, zone = null, wiederOeffnen = false }) {
  // wiederOeffnen: nach „Zurück“ von der gewählten Übung die Auswahl mit Suche und Filtern wieder zeigen
  const schluessel = `prh-auswahl-${id}`;
  const [gemerkt] = useState(() => { if (!wiederOeffnen) return null; try { const z = JSON.parse(sessionStorage.getItem(schluessel)); sessionStorage.removeItem(schluessel); return z; } catch { return null; } });
  const merken = wiederOeffnen ? (z) => { try { sessionStorage.setItem(schluessel, JSON.stringify(z)); } catch { /* egal */ } } : null;
  const oeffnen = (zustand = null) => zeigeFenster((zu) => html`<${UebungsAuswahl} titel=${titel ?? (familien ? 'Übung für diesen Platz' : 'Übung wählen')} familien=${familien}
    zoneStart=${zone} onWahl=${onWahl} zu=${zu} merken=${merken} zustand=${zustand}/>`);
  useEffect(() => { if (autofokus || gemerkt) oeffnen(gemerkt); }, []);
  return html`<div class="stack" style="gap:6px">
    <button id=${id} class="suche suche-knopf" onClick=${() => oeffnen()}>${I.suche}<span>${platzhalter}</span></button>
  </div>`;
}
