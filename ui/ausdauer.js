// PR Hunter · Ausdauer (Wünsche 222–229): Eintragen/Bearbeiten, Kachel auf „Heute“, Liste im Verlauf. Nur sichtbar, wenn in
// Einstellungen → Training „Ausdauer“ gewählt ist (Laufen, Rad oder beides).
import { html, useState, Sheet, Portal, deEn, sprache, datumLang, datumKurz, fmt, I } from './basis.js';
import { HEUTE } from './stand.js';
import { ARTEN, TYPEN, KURVE, art, sportVon, sportarten, sichtbar, paceSek, kmh, dauerText, paceText, dauerLesen, montag } from '../js/ausdauer.js';

const name = (x) => (sprache() === 'en' ? x.en : x.de);
const km = (m) => (m == null ? '–' : `${fmt(m / 1000, m >= 100000 ? 0 : 1)} km`);

/** Kurzzeile einer Einheit: „10,2 km · 52:10 · 5:07 /km“ bzw. „62 km · 2:05:00 · 29,8 km/h · 210 W“ */
export function kurz(a) {
  const teile = [a.distanz_m ? km(a.distanz_m) : null, a.dauer_s ? dauerText(a.dauer_s) : null];
  if (sportVon(a.art) === 'lauf') teile.push(paceSek(a) ? paceText(paceSek(a)) : null);
  else { teile.push(kmh(a) ? `${fmt(kmh(a), 1)} km/h` : null); if (a.watt_avg) teile.push(`${a.watt_avg} W`); }
  return teile.filter(Boolean).join(' · ');
}

/** Eintragen bzw. Bearbeiten. vorlage = vorhandene Einheit oder null. */
export function AusdauerSheet({ vorlage = null, wahl, speichern, loeschen, zu }) {
  const sports = sportarten(wahl);
  const [a, setA] = useState(() => vorlage ?? { id: crypto.randomUUID(), quelle: 'manuell', art: sports[0] === 'rad' ? 'rennrad' : 'lauf', datum: HEUTE, typ: 'locker' });
  const [dauer, setDauer] = useState(() => (vorlage?.dauer_s ? dauerText(vorlage.dauer_s) : ''));
  const [mehr, setMehr] = useState(!!(vorlage?.puls_avg || vorlage?.watt_avg || vorlage?.geraet || vorlage?.notiz));
  const setze = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const zahl = (k, faktor = 1) => (e) => { const v = e.currentTarget.value.replace(',', '.'); setze(k, v === '' ? null : Math.round(Number(v) * faktor * 100) / 100); };
  const s = dauerLesen(dauer), vorschau = { ...a, dauer_s: s };
  const rad = sportVon(a.art) === 'rad', fremd = a.quelle !== 'manuell';
  const ok = s > 0 && a.datum;
  return html`<${Sheet} zu=${zu} label=${deEn('Ausdauer eintragen', 'Log cardio')}>
    <div class="sheet-kopf"><h2 class="h2">${vorlage ? deEn('Einheit bearbeiten', 'Edit session') : rad && sports.length === 1 ? deEn('Radfahrt eintragen', 'Log ride') : !rad && sports.length === 1 ? deEn('Lauf eintragen', 'Log run') : deEn('Ausdauer eintragen', 'Log cardio')}</h2></div>
    ${fremd ? html`<p class="muted" style="margin:0;font-size:12.5px">${a.quelle === 'strava' ? deEn('Aus Strava – Änderungen gelten nur in PR Hunter.', 'From Strava – changes only apply in PR Hunter.') : deEn('Aus einer Datei importiert.', 'Imported from a file.')}</p>` : null}
    <div class="chips-zeile au-arten">${ARTEN.filter((x) => sports.includes(x.sport)).map((x) => html`<button key=${x.id} class="chip" aria-pressed=${String(a.art === x.id)} onClick=${() => setze('art', x.id)}>${x.icon} ${name(x)}</button>`)}</div>
    <div class="au-felder">
      <label class="field"><span class="label">${deEn('Datum', 'Date')}</span><input type="date" class="text" value=${a.datum} max=${HEUTE} onInput=${(e) => setze('datum', e.currentTarget.value)}/></label>
      <label class="field"><span class="label">${deEn('Dauer', 'Time')}</span><input class="text" inputmode="numeric" placeholder="0:45:00" value=${dauer} onInput=${(e) => setDauer(e.currentTarget.value)}/></label>
      <label class="field"><span class="label">${deEn('Distanz (km)', 'Distance (km)')}</span><input class="text" inputmode="decimal" placeholder=${rad ? '60' : '10'} value=${a.distanz_m != null ? String(Math.round(a.distanz_m) / 1000).replace('.', ',') : ''} onInput=${zahl('distanz_m', 1000)}/></label>
      <label class="field"><span class="label">${deEn('Höhenmeter', 'Elevation (m)')}</span><input class="text" inputmode="numeric" placeholder="0" value=${a.hoehe_m ?? ''} onInput=${zahl('hoehe_m')}/></label>
    </div>
    ${s > 0 && a.distanz_m ? html`<div class="au-vorschau">${kurz(vorschau)}</div>` : null}
    <div class="stack" style="gap:6px"><span class="eyebrow">${deEn('Art der Einheit', 'Session type')}</span>
      <div class="chips-zeile au-typen">${TYPEN.map((t) => html`<button key=${t.id} class="chip" aria-pressed=${String(a.typ === t.id)} onClick=${() => setze('typ', t.id)}>${name(t)}</button>`)}</div></div>
    <div class="stack" style="gap:6px"><span class="eyebrow">${deEn('Anstrengung (RPE)', 'Effort (RPE)')}</span>
      <div class="au-rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => html`<button key=${r} aria-pressed=${String(a.rpe === r)} onClick=${() => setze('rpe', a.rpe === r ? null : r)}>${r}</button>`)}</div></div>
    ${mehr ? html`<div class="au-felder">
        <label class="field"><span class="label">${deEn('Puls Ø', 'Avg HR')}</span><input class="text" inputmode="numeric" value=${a.puls_avg ?? ''} onInput=${zahl('puls_avg')}/></label>
        <label class="field"><span class="label">${deEn('Puls max', 'Max HR')}</span><input class="text" inputmode="numeric" value=${a.puls_max ?? ''} onInput=${zahl('puls_max')}/></label>
        ${rad ? html`<label class="field"><span class="label">${deEn('Watt Ø', 'Avg power')}</span><input class="text" inputmode="numeric" value=${a.watt_avg ?? ''} onInput=${zahl('watt_avg')}/></label>` : null}
        <label class="field"><span class="label">${rad ? deEn('Rad', 'Bike') : deEn('Schuh', 'Shoe')}</span><input class="text" maxlength="40" value=${a.geraet ?? ''} onInput=${(e) => setze('geraet', e.currentTarget.value || null)}/></label>
      </div>
      <label class="field"><span class="label">${deEn('Notiz', 'Note')}</span><input class="text" maxlength="300" value=${a.notiz ?? ''} onInput=${(e) => setze('notiz', e.currentTarget.value || null)}/></label>`
    : html`<button class="link" style="align-self:flex-start" onClick=${() => setMehr(true)}>${deEn('+ Puls, Watt, Schuh/Rad, Notiz', '+ Heart rate, power, shoe/bike, note')}</button>`}
    <button class="btn btn-chalk btn-block" disabled=${!ok} onClick=${() => { speichern({ ...a, dauer_s: s }); zu(); }}>${deEn('Speichern', 'Save')}</button>
    ${vorlage && loeschen ? html`<button class="btn btn-soft btn-block" onClick=${() => { loeschen(a); zu(); }}>${deEn('Löschen', 'Delete')}</button>` : null}
  <//>`;
}

/** Detailansicht: die wichtigsten Zahlen oben, alles Weitere (Splits, Bestzeiten, Leistung, Zonen, Runden) aufklappbar. */
export function AusdauerDetail({ a, wahl, speichern, loeschen, zu }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  if (bearbeiten) return html`<${AusdauerSheet} vorlage=${a} wahl=${wahl} speichern=${speichern} loeschen=${loeschen} zu=${zu}/>`;
  const rad = sportVon(a.art) === 'rad', d = a.details ?? {};
  const typ = TYPEN.find((x) => x.id === a.typ);
  const kacheln = [
    [deEn('Distanz', 'Distance'), a.distanz_m ? km(a.distanz_m) : null],
    [deEn('Zeit', 'Time'), a.dauer_s ? dauerText(a.dauer_s) : null],
    rad ? [deEn('Tempo', 'Speed'), kmh(a) ? `${fmt(kmh(a), 1)} km/h` : null] : [deEn('Pace', 'Pace'), paceSek(a) ? paceText(paceSek(a)) : null],
    [deEn('Höhenmeter', 'Elevation'), a.hoehe_m ? `${fmt(a.hoehe_m, 0)} m` : null],
    [deEn('Puls Ø', 'Avg HR'), a.puls_avg ? `${a.puls_avg}${a.puls_max ? ` / ${a.puls_max}` : ''}` : null],
    rad ? [deEn('Watt Ø', 'Avg power'), a.watt_avg ? `${a.watt_avg} W${a.watt_echt === false ? ' ≈' : ''}` : null] : [deEn('Kadenz', 'Cadence'), a.kadenz ? `${fmt(a.kadenz, 0)} spm` : null],
    rad ? [deEn('Gewichtet', 'Weighted'), a.watt_np ? `${a.watt_np} W` : null] : null,
    rad ? [deEn('Arbeit', 'Work'), a.kj ? `${fmt(a.kj, 0)} kJ` : null] : null,
    rad ? [deEn('Kadenz', 'Cadence'), a.kadenz ? `${fmt(a.kadenz, 0)} rpm` : null] : null,
    ['RPE', a.rpe ? fmt(a.rpe) : null],
  ].filter((k) => k && k[1]);
  const bereich = (titel, inhalt) => (inhalt ? html`<details class="au-bereich"><summary>${titel}</summary>${inhalt}</details>` : null);
  const splits = d.splits?.length ? html`<div class="au-tabelle"><div class="au-zeile kopf"><span>km</span><span>${rad ? 'km/h' : 'Pace'}</span><span>${deEn('Puls', 'HR')}</span><span>${deEn('Höhe', 'Elev.')}</span></div>
    ${d.splits.map((s, i) => html`<div key=${i} class="au-zeile"><span>${s.km ?? i + 1}</span><span>${rad ? (s.s && s.m ? fmt((s.m / 1000) / (s.s / 3600), 1) : '–') : (s.s && s.m ? dauerText(s.s / (s.m / 1000)) : '–')}</span>
      <span>${s.puls ?? '–'}</span><span>${s.hm != null ? `${s.hm > 0 ? '+' : ''}${Math.round(s.hm)}` : '–'}</span></div>`)}</div>` : null;
  const best = d.best?.length ? html`<div class="au-tabelle">${d.best.map((b, i) => html`<div key=${i} class="au-zeile zwei"><span>${b.name ?? km(b.m)}</span><b>${dauerText(b.s)}</b></div>`)}</div>` : null;
  const kurve = d.kurve && Object.keys(d.kurve).length ? html`<div class="au-tabelle">${KURVE.filter(([s]) => d.kurve[s]).map(([s, n]) => html`<div key=${s} class="au-zeile zwei"><span>${n}</span><b>${d.kurve[s]} W</b></div>`)}</div>` : null;
  const zonen = d.zonen?.length ? html`<div class="au-zonen">${d.zonen.map((z, i) => html`<div key=${i} class="au-zone"><span>${z.name}</span>
    <i style=${`width:${Math.round((z.s / Math.max(1, ...d.zonen.map((x) => x.s))) * 100)}%;background:${['#94A3B8', '#22C55E', '#EAB308', '#F97316', '#EF4444'][i] ?? '#94A3B8'}`}></i><small>${dauerText(z.s)}</small></div>`)}</div>` : null;
  const runden = d.runden?.length > 1 ? html`<div class="au-tabelle"><div class="au-zeile kopf"><span>#</span><span>${deEn('Strecke', 'Dist.')}</span><span>${deEn('Zeit', 'Time')}</span><span>${deEn('Puls', 'HR')}</span></div>
    ${d.runden.map((s, i) => html`<div key=${i} class="au-zeile"><span>${i + 1}</span><span>${s.m ? km(s.m) : '–'}</span><span>${s.s ? dauerText(s.s) : '–'}</span><span>${s.puls ?? '–'}</span></div>`)}</div>` : null;
  return html`<${Sheet} zu=${zu} label=${a.titel || name(art(a.art))}>
    <div class="sheet-kopf au-detail-kopf"><span class="au-detail-sym">${art(a.art).icon}</span>
      <div><h2 class="h2">${a.titel || name(art(a.art))}</h2><small class="muted">${[datumLang(a.datum), typ ? name(typ) : null, a.quelle === 'strava' ? 'Strava' : a.quelle === 'datei' ? deEn('Datei', 'File') : null].filter(Boolean).join(' · ')}</small></div></div>
    <div class="au-kacheln">${kacheln.map(([k, v]) => html`<div key=${k}><small>${k}</small><b>${v}</b></div>`)}</div>
    ${bereich(deEn('Kilometer-Splits', 'Splits'), splits)}
    ${bereich(deEn('Bestzeiten', 'Best efforts'), best)}
    ${bereich(deEn('Leistungskurve', 'Power curve'), kurve)}
    ${bereich(deEn('Zeit in Zonen', 'Time in zones'), zonen)}
    ${bereich(deEn('Runden', 'Laps'), runden)}
    ${a.geraet || a.notiz ? html`<div class="au-notiz">${a.geraet ? html`<span>${rad ? '🚲' : '👟'} ${a.geraet}</span>` : null}${a.notiz ? html`<p>${a.notiz}</p>` : null}</div>` : null}
    <div class="row" style="gap:8px">
      ${a.quelle === 'strava' && a.extern_id ? html`<a class="btn btn-soft" style="flex:1" href=${`https://www.strava.com/activities/${a.extern_id}`} target="_blank" rel="noopener noreferrer">Strava ↗</a>` : null}
      <button class="btn btn-soft" style="flex:1" onClick=${() => setBearbeiten(true)}>${deEn('Bearbeiten', 'Edit')}</button></div>
  <//>`;
}

/** Kachel auf „Heute“: Woche in Zahlen, letzte Einheit, Eintragen. */
export function AusdauerKarte({ liste, wahl, speichern, loeschen }) {
  const [offen, setOffen] = useState(null);                       // null | 'neu' | Einheit
  const l = sichtbar(liste, wahl), mo = montag(HEUTE);
  const woche = l.filter((a) => a.datum >= mo && a.datum <= HEUTE);
  const summe = (sport) => woche.filter((a) => sportVon(a.art) === sport).reduce((s, a) => ({ km: s.km + (a.distanz_m ?? 0) / 1000, s: s.s + (a.dauer_s ?? 0), n: s.n + 1 }), { km: 0, s: 0, n: 0 });
  const letzte = [...l].sort((a, b) => (b.datum + (b.start ?? '')).localeCompare(a.datum + (a.start ?? '')))[0];
  return html`<section class="card au-karte">
    <div class="au-kopf"><span class="eyebrow">${deEn('Ausdauer · diese Woche', 'Cardio · this week')}</span>
      <button class="au-plus" aria-label=${deEn('Ausdauer eintragen', 'Log cardio')} onClick=${() => setOffen('neu')}>${I.plus ?? '+'}</button></div>
    <div class="au-woche">${sportarten(wahl).map((sp) => { const x = summe(sp); return html`<div key=${sp} class=${`au-sport ${sp}`}>
      <span class="au-sym" aria-hidden="true">${sp === 'lauf' ? '🏃' : '🚴'}</span>
      <div><b>${fmt(x.km, x.km >= 100 ? 0 : 1)}<small> km</small></b><span>${x.n ? `${x.n}× · ${dauerText(x.s)}` : deEn('noch nichts', 'nothing yet')}</span></div></div>`; })}</div>
    ${letzte ? html`<button class="au-letzte" onClick=${() => setOffen(letzte)}><span>${art(letzte.art).icon}</span>
      <span class="au-letzte-text"><b>${letzte.titel || name(art(letzte.art))}</b><small>${`${datumKurz(letzte.datum)} · ${kurz(letzte)}`}</small></span><span class="muted">›</span></button>` : null}
    ${offen ? html`<${Portal}>${offen === 'neu' ? html`<${AusdauerSheet} wahl=${wahl} speichern=${speichern} loeschen=${loeschen} zu=${() => setOffen(null)}/>` : html`<${AusdauerDetail} a=${offen} wahl=${wahl} speichern=${speichern} loeschen=${loeschen} zu=${() => setOffen(null)}/>`}<//>` : null}
  </section>`;
}

/** Verlauf: letzte Einheiten, Antippen zum Bearbeiten. */
export function AusdauerListe({ liste, wahl, speichern, loeschen }) {
  const [offen, setOffen] = useState(null);
  const [n, setN] = useState(8);
  const l = sichtbar(liste, wahl).sort((a, b) => (b.datum + (b.start ?? '')).localeCompare(a.datum + (a.start ?? '')));
  return html`<section class="card pad">
    <div class="row between" style="margin-bottom:4px"><span class="eyebrow">${deEn('Ausdauer', 'Cardio')}</span>
      <button class="btn btn-soft btn-sm" onClick=${() => setOffen('neu')}>${deEn('+ Eintragen', '+ Log')}</button></div>
    <div class="liste">${l.slice(0, n).map((a) => html`<button key=${a.id} onClick=${() => setOffen(a)}>
      <div class="datum-box"><b>${a.datum.slice(8, 10)}</b><span>${datumLang(a.datum).slice(0, 2)}</span></div>
      <div style="min-width:0"><div style="font-weight:700">${art(a.art).icon} ${a.titel || name(art(a.art))}${a.quelle === 'strava' ? html` <small class="au-quelle">Strava</small>` : null}</div>
        <div class="muted" style="font-size:13px">${kurz(a)}</div></div>
      <span class="muted" style="font-size:13px">${a.typ ? name(TYPEN.find((t) => t.id === a.typ) ?? TYPEN[0]) : ''}</span></button>`)}
      ${l.length ? null : html`<p class="muted" style="margin:0;font-size:14px">${deEn('Noch keine Läufe oder Radfahrten.', 'No runs or rides yet.')}</p>`}</div>
    ${l.length > n ? html`<button class="link" onClick=${() => setN(n + 20)}>${deEn('Ältere', 'Older')}</button>` : null}
    ${offen ? html`<${Portal}>${offen === 'neu' ? html`<${AusdauerSheet} wahl=${wahl} speichern=${speichern} loeschen=${loeschen} zu=${() => setOffen(null)}/>` : html`<${AusdauerDetail} a=${offen} wahl=${wahl} speichern=${speichern} loeschen=${loeschen} zu=${() => setOffen(null)}/>`}<//>` : null}
  </section>`;
}
