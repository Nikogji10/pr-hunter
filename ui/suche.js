// PR Hunter · Übungssuche mit Vorschlagsliste (Combobox). Sucht in Deutsch, Englisch und Jefit-Namen,
// filtert nach Muskelgruppe und Equipment, zeigt Favoriten und zuletzt trainierte Übungen oben.
// Passt nichts, lässt sich eine neue Übung anlegen (Formular in ui/uebung.js, über DIENSTE).
import { html, useState, useEffect, I, katalogListe, LIFT, liftVon, nameVon, anpassung, sprache, MUSKEL_DE, datumKurz } from './basis.js';
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

/** Reihenfolge: exakter Name, Name beginnt mit der Eingabe, mit dem ersten Wort, sonst. */
function rang(e, q, w0) {
  if (!q) return 0;
  const de = e.de.toLowerCase(), en = e.en.toLowerCase(), eigen = anpassung(e.k)?.name?.toLowerCase();
  return de === q || en === q || eigen === q ? 0 : de.startsWith(q) || en.startsWith(q) || eigen?.startsWith(q) ? 1
    : de.startsWith(w0) || en.startsWith(w0) ? 2 : 3;
}

/** Treffer für Suchtext und Filter; dann Favoriten, zuletzt trainierte (neueste zuerst), kürzere Namen. */
export function suche(liste, { q = '', familien = null, muskel = '', equipment = '', mitVersteckten = false, max = 60 } = {}) {
  const woerter = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const eingabe = woerter.join(' ');
  return liste
    .filter((e) => (!familien || familien.includes(e.f)) && (!muskel || e.m.includes(muskel)) && passtEquipment(e, equipment)
      && (mitVersteckten || !anpassung(e.k)?.versteckt)
      && woerter.every((w) => e.s.includes(w) || anpassung(e.k)?.name?.toLowerCase().includes(w)))
    .map((e) => [e, rang(e, eingabe, woerter[0]), anpassung(e.k)?.favorit ? 0 : 1, ZULETZT[e.k] ?? ''])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || b[3].localeCompare(a[3]) || (eingabe ? a[0].de.length - b[0].de.length : a[0].de.localeCompare(b[0].de, 'de')))
    .slice(0, max).map(([e]) => e);
}

/** familien: Vorauswahl (z. B. Slot „Zusatz Beine“); „Alle Übungen“ hebt sie auf. */
export function UebungSuche({ id, familien = null, onWahl, platzhalter = 'Übung suchen …', autofokus = false }) {
  const [q, setQ] = useState('');
  const [alle, setAlle] = useState(!familien);
  const [aktiv, setAktiv] = useState(0);
  const [offen, setOffen] = useState(autofokus);
  const [filter, setFilter] = useState(false);
  const [muskel, setMuskel] = useState('');
  const [equipment, setEquipment] = useState('');
  const feld = useRef(null);
  useEffect(() => { if (autofokus) feld.current?.focus(); }, []);
  const fam = alle ? null : familien;
  const treffer = suche(katalogListe(), { q, familien: fam, muskel, equipment });
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
      <span class="muted" style="font-size:12.5px">${anzahl} Übungen${fam ? ' passend zum Platz' : ''}${q || muskel || equipment ? ` · ${treffer.length}${treffer.length === 60 ? '+' : ''} Treffer` : ''}</span>
      <span class="row" style="gap:6px">
        <button class="chip" aria-pressed=${String(filter || !!muskel || !!equipment)} aria-expanded=${String(filter)} onClick=${() => { setFilter(!filter); setOffen(true); }}>Filter${muskel || equipment ? ` (${[muskel, equipment].filter(Boolean).length})` : ''}</button>
        ${familien ? html`<button class="chip" aria-pressed=${String(alle)} onClick=${() => { setAlle(!alle); setOffen(true); }}>Alle Übungen</button>` : null}
      </span>
    </div>
    ${filter ? html`<div class="filter-zeile">
      <label class="auswahl"><span>Muskel</span><select value=${muskel} onChange=${(e) => { setMuskel(e.currentTarget.value); setOffen(true); }}>
        <option value="">alle</option>${Object.entries(MUSKEL_DE).sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}</select></label>
      <label class="auswahl"><span>Equipment</span><select value=${equipment} onChange=${(e) => { setEquipment(e.currentTarget.value); setOffen(true); }}>
        <option value="">alle</option>${EQUIPMENT_FILTER.map((k) => html`<option key=${k} value=${k}>${EQUIPMENT[k]}</option>`)}</select></label>
    </div>` : null}
    ${offen ? html`<div class="treffer" id=${`${id}-liste`} role="listbox">
      ${treffer.map((e, k) => {
        const fav = anpassung(e.k)?.favorit, zul = ZULETZT[e.k];
        return html`<button key=${e.k} id=${`${id}-${e.k}`} role="option" aria-selected=${String(k === aktiv)}
          onMouseDown=${(ev) => ev.preventDefault()} onClick=${() => waehle(e.k)}>
          <b>${fav ? html`<span class="stern" aria-label="Favorit">★</span> ` : null}${nameVon(e.k)}</b>
          <small>${andereSprache(e)}${e.eq ? ` · ${EQUIPMENT[e.eq] ?? e.eq}` : ''}${zul ? ` · zuletzt ${datumKurz(zul)}` : ''}${e.eigen ? ' · eigene' : ''}</small>
          <span class="tag row" style="gap:5px">${liftVon(e.k) !== 'andere' ? html`<i class="dot" style=${`background:${LIFT[liftVon(e.k)].farbe}`}></i>` : null}${FAMILIE[e.f] ?? e.f}</span></button>`;
      })}
      ${!treffer.length ? html`<p class="muted" style="margin:0;padding:14px">Nichts gefunden. Anderes Wort, Filter lösen${fam ? ' oder „Alle Übungen“ einschalten' : ''}.</p>` : null}
      ${neu && (q.trim().length >= 3 || !treffer.length) ? html`<button class="neu" onMouseDown=${(ev) => ev.preventDefault()} onClick=${neu}>
        <b>+ ${q.trim() ? `„${q.trim()}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</b><small>Mit Duplikatprüfung, danach für alle verfügbar</small></button>` : null}
    </div>` : null}
  </div>`;
}
