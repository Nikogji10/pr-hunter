// PR Hunter · Gruppen (Wunsch 218): eigene Freundes-Gruppen (z. B. „🏋️ Gym-Crew“) im Konto (einst.gruppen). Filtern Feed und
// Bestenliste, laden in Challenges die ganze Gruppe mit einem Tipp ein. Mitglieder müssen Freunde sein (Sichtbarkeit wie bisher).
import { html, useState, useEffect, deEn, Avatar, Sheet, I, zwischen } from './basis.js';
import { DIENSTE } from './stand.js';

const EMOJIS = ['🏋️', '💪', '🔥', '🏆', '⚡', '🦍', '👊', '🎯'];

/** Auswahl-Leiste: Alle · Gruppen. wert = Gruppen-Id oder null. */
export function GruppenFilter({ gruppen = [], wert, setWert }) {
  if (!gruppen.length) return null;
  return html`<div class="chips-zeile gruppen-filter">
    <button class="chip" aria-pressed=${String(!wert)} onClick=${() => setWert(null)}>${deEn('Alle', 'All')}</button>
    ${gruppen.map((g) => html`<button key=${g.id} class="chip" aria-pressed=${String(wert === g.id)} onClick=${() => setWert(g.id)}>${`${g.emoji} ${g.name}`}</button>`)}</div>`;
}
/** Gehört eine Person (Nutzer-Id) zur gewählten Gruppe? Ohne Auswahl: ja. */
export const inGruppe = (gruppen, id, nutzer) => { const g = (gruppen ?? []).find((x) => x.id === id); return !g || g.mitglieder.includes(nutzer); };

export function GruppenVerwaltung({ einst, setEinst }) {
  const [freunde, setFreunde] = useState(() => (zwischen.lies('freunde') ?? []).filter?.((x) => x.status === 'angenommen') ?? []);
  const [offen, setOffen] = useState(null);                 // Entwurf
  useEffect(() => { DIENSTE.ladeFreunde?.().then((f) => f && setFreunde(f.filter((x) => x.status === 'angenommen'))).catch(() => {}); }, []);
  const gruppen = einst.gruppen ?? [];
  const speichern = (g) => { setEinst({ ...einst, gruppen: [...gruppen.filter((x) => x.id !== g.id), g] }); setOffen(null); };
  const loeschen = (id) => { setEinst({ ...einst, gruppen: gruppen.filter((x) => x.id !== id) }); setOffen(null); };
  const name = (id) => freunde.find((f) => f.id === id)?.name ?? '?';
  return html`<section class="card pad stack">
    <div class="row between"><div><span class="viz-t">${deEn('Gruppen', 'Groups')}</span><div class="viz-u">${deEn('Feed, Bestenliste und Challenges nach Gruppe', 'Feed, leaderboard and challenges by group')}</div></div>
      <button class="btn btn-soft btn-sm" disabled=${!freunde.length} onClick=${() => setOffen({ id: `g-${Date.now()}`, name: '', emoji: EMOJIS[0], mitglieder: [] })}>${deEn('+ Gruppe', '+ Group')}</button></div>
    ${!gruppen.length ? html`<p class="muted" style="margin:0;font-size:13.5px">${freunde.length ? deEn('Fasse Freunde zusammen – z. B. eure Gym-Crew.', 'Group your friends – e.g. your gym crew.') : deEn('Erst Freunde hinzufügen, dann Gruppen bilden.', 'Add friends first, then build groups.')}</p>` : null}
    ${gruppen.map((g) => html`<button key=${g.id} class="gruppe-zeile" onClick=${() => setOffen(structuredClone(g))}>
      <span class="gruppe-emoji">${g.emoji}</span><span class="gruppe-text"><b>${g.name}</b><small class="muted">${g.mitglieder.map(name).join(', ') || '–'}</small></span><span class="ml-pfeil">›</span></button>`)}
    ${offen ? html`<${Sheet} zu=${() => setOffen(null)} label=${deEn('Gruppe', 'Group')}>
      <h2 class="h2">${deEn('Gruppe', 'Group')}</h2>
      <div class="chips-zeile">${EMOJIS.map((e) => html`<button key=${e} class="chip gruppe-emoji-wahl" aria-pressed=${String(offen.emoji === e)} onClick=${() => setOffen({ ...offen, emoji: e })}>${e}</button>`)}</div>
      <label class="field" for="gruppe-name"><span class="label">${deEn('Name', 'Name')}</span><input id="gruppe-name" class="text" type="text" maxlength="30" placeholder=${deEn('z. B. Gym-Crew', 'e.g. Gym crew')} value=${offen.name} onInput=${(e) => setOffen({ ...offen, name: e.currentTarget.value })}/></label>
      <span class="eyebrow">${deEn('Mitglieder', 'Members')}</span>
      <div class="chips-zeile" style="flex-wrap:wrap">${freunde.map((f) => html`<button key=${f.id} class="chip" aria-pressed=${String(offen.mitglieder.includes(f.id))}
        onClick=${() => setOffen({ ...offen, mitglieder: offen.mitglieder.includes(f.id) ? offen.mitglieder.filter((x) => x !== f.id) : [...offen.mitglieder, f.id] })}><${Avatar} bild=${f.avatar} name=${f.name} groesse=${20}/>${f.name}</button>`)}</div>
      <div class="row" style="gap:8px">${gruppen.some((x) => x.id === offen.id) ? html`<button class="btn btn-gefahr" onClick=${() => loeschen(offen.id)}>${I.papierkorb}</button>` : null}
        <button class="btn btn-chalk" style="flex:1" disabled=${!offen.name.trim() || !offen.mitglieder.length} onClick=${() => speichern({ ...offen, name: offen.name.trim() })}>${deEn('Speichern', 'Save')}</button></div>
    <//>` : null}
  </section>`;
}
