// PR Hunter · Übungssuche mit Vorschlagsliste (Combobox). Sucht in Deutsch, Englisch und Jefit-Namen,
// filtert nach Muskelgruppe und Equipment, zeigt Favoriten und zuletzt trainierte Übungen oben.
// Passt nichts, lässt sich eine neue Übung anlegen (Formular in ui/uebung.js, über DIENSTE).
import { html, useState, useEffect, I, katalogListe, LIFT, liftVon, nameVon, anpassung, sprache, MUSKEL_DE, datumKurz, UebungsBild } from './basis.js';
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
export function suche(liste, { q = '', familien = null, muskel = '', equipment = '', zone = null, mitVersteckten = false, max = 60 } = {}) {
  const woerter = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const eingabe = woerter.join(' ');
  return liste
    .filter((e) => (!familien || familien.includes(e.f)) && (!muskel || e.m.includes(muskel)) && (!zone || zonePasst(e, zone)) && passtEquipment(e, equipment)
      && (mitVersteckten || !anpassung(e.k)?.versteckt)
      && woerter.every((w) => e.s.includes(w) || anpassung(e.k)?.name?.toLowerCase().includes(w)))
    .map((e) => [e, rang(e, eingabe, woerter[0]), anpassung(e.k)?.favorit ? 0 : 1, ZULETZT[e.k] ?? '', zone ? -beliebt(e) : 0])
    .sort((a, b) => a[1] - b[1] || a[4] - b[4] || a[2] - b[2] || b[3].localeCompare(a[3]) || (eingabe ? a[0].de.length - b[0].de.length : a[0].de.localeCompare(b[0].de, 'de')))
    .slice(0, max).map(([e]) => e);
}

/** familien: Vorauswahl (z. B. Slot „Zusatz Beine“); „Alle Übungen“ hebt sie auf. */
export function UebungSuche({ id, familien = null, onWahl, platzhalter = 'Übung suchen …', autofokus = false }) {
  const [q, setQ] = useState('');
  const [alle, setAlle] = useState(!familien);
  const [aktiv, setAktiv] = useState(0);
  const [offen, setOffen] = useState(autofokus);
  const [filter, setFilter] = useState(false);
  const [zone, setZone] = useState(null);                    // Muskel aus dem Diagramm (ersetzt das Auswahlmenü, das im Fenster zitterte)
  const [equipment, setEquipment] = useState('');
  const feld = useRef(null);
  useEffect(() => { if (autofokus) feld.current?.focus(); }, []);
  const fam = alle ? null : familien;
  const treffer = suche(katalogListe(), { q, familien: fam, zone, equipment, max: zone ? 120 : 60 });
  const anzahl = katalogListe().filter((e) => !fam || fam.includes(e.f)).length;
  const waehle = (key) => { onWahl(key); setQ(''); setOffen(false); };
  const neu = DIENSTE.neueUebungStarten ? () => { setOffen(false); DIENSTE.neueUebungStarten(q.trim(), waehle); } : null;
  const taste = (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setOffen(true); setAktiv((a) => Math.min(treffer.length - 1, a + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setAktiv((a) => Math.max(0, a - 1)); }
    else if (ev.key === 'Enter' && treffer[aktiv]) { ev.preventDefault(); waehle(treffer[aktiv].k); }
    else if (ev.key === 'Escape') setOffen(false);
  };
  const andereSprache = (e) => (sprache() === 'en' ? e.de : e.en);
  return html`<div class="stack" style="gap:8px">
    <div class="suche">
      ${I.suche}
      <input id=${id} ref=${feld} type="search" role="combobox" aria-expanded=${String(offen)} aria-controls=${`${id}-liste`}
        aria-activedescendant=${offen && treffer[aktiv] ? `${id}-${treffer[aktiv].k}` : ''} autocomplete="off" placeholder=${platzhalter}
        value=${q} onFocus=${() => setOffen(true)} onInput=${(e) => { setQ(e.currentTarget.value); setAktiv(0); setOffen(true); }} onKeyDown=${taste}/>
    </div>
    <div class="row between wrap" style="gap:6px">
      <span class="muted" style="font-size:12.5px"><span>${fam ? `${anzahl} Übungen passend zum Platz` : `${anzahl} Übungen`}</span>${q || zone || equipment ? html` · <span>${`${treffer.length} Treffer`}</span>` : null}</span>
      <span class="row" style="gap:6px">
        <button class="chip" aria-pressed=${String(filter || !!zone || !!equipment)} aria-expanded=${String(filter)} onClick=${() => { setFilter(!filter); setOffen(true); }}>${zone || equipment ? `Muskel/Gerät (${[zone, equipment].filter(Boolean).length})` : 'Muskel/Gerät'}</button>
        ${familien ? html`<button class="chip" aria-pressed=${String(alle)} onClick=${() => { setAlle(!alle); setOffen(true); }}>Alle Übungen</button>` : null}
      </span>
    </div>
    ${filter ? html`<div class="stack such-filter" style="gap:8px">
      <${MuskelWahl} zone=${zone} waehle=${(z) => { setZone(z); setOffen(true); }}/>
      <div class="chips-zeile" role="group" aria-label="Equipment">${['', ...EQUIPMENT_FILTER].map((k) => html`<button key=${k || 'alle'} class="chip" aria-pressed=${String(equipment === k)}
        onClick=${() => { setEquipment(k); setOffen(true); }}>${k ? EQUIPMENT[k] : 'Alle Geräte'}</button>`)}</div>
    </div>` : null}
    ${offen ? html`<div class="treffer" id=${`${id}-liste`} role="listbox">
      ${(() => {
        const zeile = (e, k) => {
          const fav = anpassung(e.k)?.favorit, zul = ZULETZT[e.k];
          return html`<button key=${e.k} id=${`${id}-${e.k}`} role="option" aria-selected=${String(k === aktiv)} class="treffer-mit-bild"
            onMouseDown=${(ev) => ev.preventDefault()} onClick=${() => waehle(e.k)}>
            <${UebungsBild} schluessel=${e.k} groesse=${40}/>
            <span class="treffer-text"><b>${fav ? html`<span class="stern" aria-label="Favorit">★</span> ` : null}${nameVon(e.k)}</b>
            <small><span translate="no">${andereSprache(e)}</span>${e.eq ? html` · <span>${EQUIPMENT[e.eq] ?? e.eq}</span>` : null}${zul ? html` · <span>${`zuletzt ${datumKurz(zul)}`}</span>` : null}${e.eigen ? html` · <span>eigene</span>` : null}</small></span>
            <span class="tag row" style="gap:5px">${liftVon(e.k) !== 'andere' ? html`<i class="dot" style=${`background:${LIFT[liftVon(e.k)].farbe}`}></i>` : null}${FAMILIE[e.f] ?? e.f}</span></button>`;
        };
        if (!zone) return treffer.map(zeile);
        const grund = treffer.filter((e) => !ISO_FAMILIEN.has(e.f)), iso = treffer.filter((e) => ISO_FAMILIEN.has(e.f));
        return html`${grund.length ? html`<span class="treffer-gruppe">${`Grundübungen · ${ZONE_NAME[zone]}`}</span>${grund.map(zeile)}` : null}
          ${iso.length ? html`<span class="treffer-gruppe">${`Isolation · ${ZONE_NAME[zone]}`}</span>${iso.map((e, k) => zeile(e, k + grund.length))}` : null}`;
      })()}
      ${!treffer.length ? html`<p class="muted" style="margin:0;padding:14px">Nichts gefunden. Anderes Wort, Filter lösen${fam ? ' oder „Alle Übungen“ einschalten' : ''}.</p>` : null}
      ${neu && (q.trim().length >= 3 || !treffer.length) ? html`<button class="neu" onMouseDown=${(ev) => ev.preventDefault()} onClick=${neu}>
        <b>+ ${q.trim() ? `„${q.trim()}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</b><small>Mit Duplikatprüfung, danach für alle verfügbar</small></button>` : null}
    </div>` : null}
  </div>`;
}
