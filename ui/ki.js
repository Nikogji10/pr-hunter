// PR Hunter · Frag die KI (Wunsch 221, Variante 1): Kachel auf „Heute“ → Fenster: Frage stellen (oder Idee antippen),
// Zeitraum wählen, „Frage + Daten kopieren“, dann ChatGPT, Gemini oder Claude öffnen und einfügen. Nichts wird verschickt.
import { html, useState, Sheet, Portal, deEn, sprache, nameVon, kopiere, uebung, MUSKEL_DE } from './basis.js';
import { useMemo } from '../vendor/htm-preact.js';
import { HEUTE, E1RM_AKTUELL, KOERPERGEWICHT } from './stand.js';
import { HAUPT } from '../js/daten.js';
import { normiere } from '../js/insights.js';
import { aktiveBeschwerden, REGIONEN } from '../js/beschwerden.js';
import { kiText, BEISPIELE, KI_ZIELE, appLink } from '../js/kidaten.js';

// Android: Intent ohne neues Fenster (sonst ging erst die App und zusätzlich der Browser auf); sonst normaler Link im neuen Tab
const ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

const Funkeln = () => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" fill="currentColor"/>
  <path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" opacity=".75"/><path d="M5 16l.6 1.5 1.5.6-1.5.6L5 20.2l-.6-1.5-1.5-.6 1.5-.6z" fill="currentColor" opacity=".55"/></svg>`;

/** Kachel auf „Heute“. */
export function KiKachel({ trainings, einst, block, prog }) {
  const [offen, setOffen] = useState(false);
  return html`<button class="ki-kachel" onClick=${() => setOffen(true)}>
      <span class="ki-icon"><${Funkeln}/></span>
      <span class="ki-text"><b>${deEn('Frag die KI', 'Ask AI')}</b><small>${deEn('Deine Frage + deine Trainingsdaten – kostenlos in ChatGPT, Gemini oder Claude', 'Your question + your training data – free in ChatGPT, Gemini or Claude')}</small></span>
      <span class="ki-pfeil" aria-hidden="true">›</span>
    </button>
    ${offen ? html`<${Portal}><${KiFenster} zu=${() => setOffen(false)} trainings=${trainings} einst=${einst} block=${block} prog=${prog}/><//>` : null}`;
}

function KiFenster({ zu, trainings, einst, block, prog }) {
  const art = einst.trainingsart === 'einfach' ? 'bb' : 'pl';          // Bodybuilding/Krafttraining oder Powerlifting
  const [frage, setFrage] = useState(() => { try { return sessionStorage.getItem('prh-ki-frage') ?? ''; } catch { return ''; } });
  const [wochen, setWochen] = useState(8);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState(false);
  const setze = (f) => { setFrage(f); setKopiert(false); try { sessionStorage.setItem('prh-ki-frage', f); } catch { /* egal */ } };
  const einheiten = useMemo(() => normiere(trainings), [trainings]);
  const profil = () => {
    const wo = prog?.weeks?.length ?? 0;
    const woche = block?.start ? Math.max(1, Math.floor((Date.parse(`${HEUTE}T00:00:00Z`) - Date.parse(`${block.start}T00:00:00Z`)) / (7 * 864e5)) + 1) : null;
    const regName = (id) => { const r = REGIONEN.find(([k]) => k === id); return r ? (sprache() === 'en' ? r[2] : r[1]) : id; };
    return { trainingsart: einst.trainingsart, koerpergewicht: einst.koerpergewicht ?? KOERPERGEWICHT, wettkampfDatum: einst.wettkampfDatum, gewichtsklasse: einst.gewichtsklasse,
      block: block && prog ? { name: prog.name ?? '', woche: wo ? Math.min(wo, woche) : woche, wochen: wo } : null,
      e1rm: Object.fromEntries(Object.entries(HAUPT).map(([l, k]) => [l, E1RM_AKTUELL[k] ?? null])),
      beschwerden: aktiveBeschwerden(einst.beschwerden, HEUTE).map((b) => ({ region: regName(b.region), bis: b.bis })), gewichtZiel: einst.gewichtZiel };
  };
  const text = () => kiText({ frage, einheiten, heute: HEUTE, wochen, profil: profil(), name: (k) => nameVon(k, k), sprache: sprache(), art,
    muskeln: (k) => (uebung(k)?.m ?? []).map((m) => (sprache() === 'en' ? m : MUSKEL_DE[m] ?? m)) });
  const anzahl = einheiten.filter((e) => e.datum >= new Date(Date.parse(`${HEUTE}T00:00:00Z`) - wochen * 7 * 864e5).toISOString().slice(0, 10)).length;
  const laenge = useMemo(() => text().length, [einheiten, wochen, frage]);
  const kopieren = async () => { const ok = await kopiere(text()); setKopiert(ok); setFehler(!ok); };
  const schritt = kopiert ? 3 : frage.trim() ? 2 : 1;
  return html`<${Sheet} zu=${zu} label=${deEn('Frag die KI', 'Ask AI')}>
    <div class="ki-kopf"><span class="ki-icon gross"><${Funkeln}/></span>
      <div><h2 class="h2" style="margin:0">${deEn('Frag die KI', 'Ask AI')}</h2><span class="muted" style="font-size:13px">${deEn('Kostenlos mit ChatGPT, Gemini oder Claude', 'Free with ChatGPT, Gemini or Claude')}</span></div></div>
    <ol class="ki-schritte">${[[deEn('Frage stellen', 'Ask'), deEn('oder eine Idee antippen', 'or tap an idea')], [deEn('Kopieren', 'Copy'), deEn('Frage + Daten zusammen', 'question + data together')],
      [deEn('Einfügen', 'Paste'), deEn('ins Feld tippen → Einfügen', 'tap the field → Paste')]].map(([t, u], i) => html`<li key=${i} class=${schritt > i + 1 ? 'fertig' : schritt === i + 1 ? 'jetzt' : ''}>
      <i>${schritt > i + 1 ? '✓' : i + 1}</i><b>${t}</b><small>${u}</small></li>`)}</ol>
    <label class="ki-feld"><span class="eyebrow">${deEn('Deine Frage', 'Your question')}</span>
      <textarea rows="3" maxlength="1000" placeholder=${deEn('z. B. Warum geht meine Bank seit Wochen nicht hoch?', 'e.g. Why has my bench not gone up for weeks?')} value=${frage} onInput=${(e) => setze(e.currentTarget.value)}></textarea></label>
    <div class="ki-ideen">${BEISPIELE[art].map(([de, en, fDe, fEn], i) => html`<button key=${i} class="chip" aria-pressed=${String(frage === deEn(fDe, fEn))} onClick=${() => setze(deEn(fDe, fEn))}>${deEn(de, en)}</button>`)}</div>
    <div class="stack" style="gap:6px"><span class="eyebrow">${deEn('Daten aus den letzten', 'Data from the last')}</span>
      <div class="seg">${[[4, '4 Wochen', '4 weeks'], [8, '8 Wochen', '8 weeks'], [13, '3 Monate', '3 months'], [26, '6 Monate', '6 months']].map(([w, de, en]) => html`<button key=${w} aria-pressed=${String(wochen === w)} onClick=${() => { setWochen(w); setKopiert(false); }}>${deEn(de, en)}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${art === 'pl' ? deEn(`${anzahl} Trainings mit Sätzen, RPE und Notizen, dazu e1RM-Verlauf, Block und Körpergewicht · ≈ ${laenge.toLocaleString('de-DE')} Zeichen`, `${anzahl} workouts with sets, RPE and notes, plus e1RM trend, block and bodyweight · ≈ ${laenge.toLocaleString('en-GB')} characters`)
        : deEn(`${anzahl} Trainings mit Sätzen, RPE und Notizen, dazu Sätze je Muskel, Fortschritt je Übung und Körpergewicht · ≈ ${laenge.toLocaleString('de-DE')} Zeichen`, `${anzahl} workouts with sets, RPE and notes, plus sets per muscle, progress per exercise and bodyweight · ≈ ${laenge.toLocaleString('en-GB')} characters`)}</span></div>
    <button class=${`btn btn-chalk btn-block ki-kopieren ${kopiert ? 'ok' : ''}`} disabled=${!frage.trim()} onClick=${kopieren}>
      ${kopiert ? deEn('✓ Kopiert – jetzt KI öffnen und einfügen', '✓ Copied – now open the AI and paste') : deEn('Frage + Daten kopieren', 'Copy question + data')}</button>
    ${fehler ? html`<p class="fehler" style="margin:0;font-size:13px">${deEn('Kopieren hat der Browser blockiert – unten unter „Was wird kopiert?“ den Text markieren und kopieren.', 'The browser blocked copying – select and copy the text under “What gets copied?” below.')}</p>` : null}
    <div class=${`ki-ziele ${kopiert ? 'bereit' : ''}`}>${KI_ZIELE.map((z) => html`<a key=${z.id} class=${`ki-ziel ${z.id}`} href=${ANDROID ? appLink(z) : z.url} target=${ANDROID ? undefined : '_blank'} rel="noopener noreferrer"><i></i><span>${z.name}</span><small>${deEn('öffnen', 'open')} ↗</small></a>`)}</div>
    <details class="ki-vorschau"><summary>${deEn('Was wird kopiert?', 'What gets copied?')}</summary><pre>${frage.trim() ? text() : deEn('Erst eine Frage stellen.', 'Ask a question first.')}</pre></details>
    <p class="ki-hinweis">${deEn('Nichts wird automatisch verschickt. Kopiert werden nur deine eigenen Trainings – keine Namen von Freunden, keine E-Mail. Die KI kann sich irren: Bei Schmerzen lieber ärztlich abklären.', 'Nothing is sent automatically. Only your own workouts are copied – no friends’ names, no email. AI can be wrong: with pain, see a doctor.')}</p>
  <//>`;
}
