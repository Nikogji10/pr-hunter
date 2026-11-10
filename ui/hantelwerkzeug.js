// PR Hunter · Hantelweg als Werkzeug im Rechner (Wunsch 278): Video ohne Training analysieren. Übung, Gewicht, Wdh und RPE
// stehen am Video (IndexedDB, werkzeug: true); die Tempo-Statistik nimmt diese Videos mit.
import { html, useState, useEffect, deEn, fmt, ZahlFeld, einheit, inKg, inAnzeige, liftName, datumKurz, I } from './basis.js';
import { HEUTE } from './stand.js';
import { HAUPT } from '../js/daten.js';
import { VideoKern, alleVideoMeta, KAMERA } from './satzvideo.js';

const LIFTE = ['squat', 'bench', 'dead'];
const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const beste = (v) => (v.analyse?.wdh?.length && !v.ungeprueft ? Math.max(...v.analyse.wdh.map((w) => w.mcv)) : null);

export function HantelWerkzeug() {
  const [lift, setLift] = useState('squat');
  const [kg, setKg] = useState(() => Math.round(inAnzeige(140) * 10) / 10);
  const [wdh, setWdh] = useState(3);
  const [rpe, setRpe] = useState(null);
  const [aktiv, setAktiv] = useState(null);               // { id } eines Videos oder { neu: true }
  const [liste, setListe] = useState([]);
  const lade = () => alleVideoMeta().then((l) => setListe(l.filter((v) => v.werkzeug).sort((a, b) => (b.erstellt ?? '').localeCompare(a.erstellt ?? '')))).catch(() => setListe([]));
  useEffect(() => { lade(); }, []);
  const oeffne = (v) => { setLift(v.lift ?? 'squat'); setKg(Math.round(inAnzeige(v.kg ?? 0) * 10) / 10); setWdh(v.wdh ?? 1); setRpe(v.rpe ?? null); setAktiv({ id: v.id }); };
  const satz = { kg: inKg(kg), wdh, rpe, extra: aktiv?.id ? { video: aktiv.id } : {} };
  return html`<section class="card pad stack">
      <span class="viz-t">${deEn('Hantelweg aus einem Video', 'Bar path from a video')}</span>
      <div class="seg" role="group" aria-label=${deEn('Übung', 'Exercise')}>${LIFTE.map((l) => html`<button key=${l} aria-pressed=${String(lift === l)} onClick=${() => setLift(l)}>${liftName(l)}</button>`)}</div>
      <div class="fields"><${ZahlFeld} id="hw-kg" label=${`${deEn('Gewicht', 'Weight')} (${einheit()})`} wert=${kg} setze=${setKg}/>
        <${ZahlFeld} id="hw-wdh" label=${deEn('Wdh', 'Reps')} wert=${wdh} setze=${(w) => setWdh(Math.max(1, Math.round(w || 1)))}/></div>
      <div class="filter einreihig" role="group" aria-label="RPE"><span class="muted" style="font-size:12.5px;align-self:center">RPE</span>
        <button class="chip" aria-pressed=${String(rpe == null)} onClick=${() => setRpe(null)}>–</button>
        ${RPE.map((r) => html`<button key=${r} class="chip" aria-pressed=${String(rpe === r)} onClick=${() => setRpe(r)}>${fmt(r)}</button>`)}</div>
      ${aktiv ? html`<${VideoKern} key=${aktiv.id ?? 'neu'} satz=${satz} uebungKey=${HAUPT[lift]} uebungName=${liftName(lift)} lift=${lift} eingebettet=${true}
          meta=${{ werkzeug: true, datum: HEUTE, key: HAUPT[lift], lift, kg: inKg(kg), wdh, rpe }}
          beiNeu=${(r) => { if (r) { if (!aktiv.id) setAktiv({ id: r.id }); } else setAktiv(null); lade(); }}/>`
        : html`<button class="btn btn-chalk btn-block" onClick=${() => setAktiv({ neu: true })}>${KAMERA} ${deEn('Video wählen', 'Choose video')}</button>`}
      ${aktiv ? html`<button class="btn btn-soft btn-block" onClick=${() => { setAktiv(null); lade(); }}>${deEn('Fertig', 'Done')}</button>` : null}
    </section>
    ${liste.length ? html`<section class="card pad stack">
      <span class="viz-t">${deEn('Frühere Videos', 'Earlier videos')}</span>
      <div class="hw-liste">${liste.map((v) => html`<button key=${v.id} class=${`hw-zeile ${aktiv?.id === v.id ? 'an' : ''}`} onClick=${() => oeffne(v)}>
        ${KAMERA}<span><b>${liftName(v.lift ?? 'squat')} · ${fmt(inAnzeige(v.kg ?? 0))} × ${v.wdh ?? '–'}${v.rpe != null ? ` @ ${fmt(v.rpe)}` : ''}</b>
        <small>${datumKurz((v.datum ?? v.erstellt ?? HEUTE).slice(0, 10))}</small></span>
        <b class="hw-ms">${beste(v) != null ? `${fmt(beste(v), 2)} m/s` : '–'}</b>${I.weiter}</button>`)}</div>
    </section>` : null}`;
}
