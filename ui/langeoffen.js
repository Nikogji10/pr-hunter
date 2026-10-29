// PR Hunter · Nachfrage bei sehr langem Training (Wunsch 153): nach 4 Stunden „Trainierst du noch?“ – sonst Ende eintragen
import { html, useState, Sheet } from './basis.js';

export const LANGE_MS = 4 * 3600 * 1000;

/** Fällig, wenn ein laufendes (nicht bearbeitetes) Training über 4 h offen ist und seit der letzten Antwort wieder 4 h vergangen sind. */
export const langeOffen = (t, jetzt = Date.now()) => !!t && !t.bearbeiten && jetzt - t.start > LANGE_MS && (!t.nachgefragt || jetzt - t.nachgefragt > LANGE_MS);

const zweistellig = (n) => String(n).padStart(2, '0');
const hhmm = (ms) => { const d = new Date(ms); return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`; };

/** Endzeit aus „HH:MM“ am Starttag (über Mitternacht: Folgetag). null, wenn ungültig oder nicht zwischen Start und jetzt. */
export function endeAus(text, start, jetzt = Date.now()) {
  const m = String(text).match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = new Date(start); d.setHours(+m[1], +m[2], 0, 0);
  let ms = d.getTime();
  if (ms <= start) ms += 24 * 3600 * 1000;
  return ms > start && ms <= jetzt ? ms : null;
}

export function LangeOffenSheet({ training, weiter, beenden }) {
  const [frage, setFrage] = useState(true);
  const vorschlag = Math.min(Date.now(), training.start + 90 * 60 * 1000);
  const [zeit, setZeit] = useState(hhmm(vorschlag));
  const dauer = Math.floor((Date.now() - training.start) / 60000);
  const ende = endeAus(zeit, training.start);
  return html`<${Sheet} zu=${weiter} label="Training noch offen">
    ${frage ? html`<div class="stack" style="gap:12px">
      <span class="eyebrow">Training noch offen</span>
      <h2 class="h2" style="margin:0">Trainierst du noch?</h2>
      <p class="muted" style="margin:0">${`Dein Training läuft seit ${Math.floor(dauer / 60)} h ${dauer % 60} min. Vielleicht hast du vergessen, es zu beenden.`}</p>
      <button class="btn btn-chalk btn-block" onClick=${weiter}>Ja, ich trainiere noch</button>
      <button class="btn btn-soft btn-block" onClick=${() => setFrage(false)}>Nein – Ende eintragen</button>
    </div>` : html`<div class="stack" style="gap:12px">
      <span class="eyebrow">Training beenden</span>
      <h2 class="h2" style="margin:0">Wann hast du aufgehört?</h2>
      <label class="field" for="lange-ende"><span class="label">${`Ende (Start ${hhmm(training.start)})`}</span>
        <input id="lange-ende" type="time" value=${zeit} onInput=${(e) => setZeit(e.currentTarget.value)}/></label>
      ${ende ? html`<span class="muted" style="font-size:13px">${`Dauer ${Math.floor((ende - training.start) / 3600000)} h ${Math.round(((ende - training.start) % 3600000) / 60000)} min`}</span>`
        : html`<span class="fehler" style="font-size:13px">Die Zeit muss zwischen Start und jetzt liegen.</span>`}
      <button class="btn btn-chalk btn-block" disabled=${!ende} onClick=${() => beenden(new Date(ende).toISOString())}>Speichern und beenden</button>
      <button class="link" style="justify-self:start" onClick=${() => setFrage(true)}>Zurück</button>
    </div>`}
  </${Sheet}>`;
}
