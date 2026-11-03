// PR Hunter · Aufwärm-Routine vor dem ersten Satz (Wunsch 203; Einstellung „Aufwärm-Routine“ = einst.mobility, standardmäßig aus):
// kurze Mobility-Abfolge passend zum Tag – Hüfte bei Kniebeuge/Kreuzheben/Beinen, Schulter und Brustwirbelsäule bei
// Drücken/Ziehen, sonst gemischt. Timer je Übung, weiter von selbst; jederzeit überspringbar.
import { html, useState, useEffect, liftVon, uebung, piep, vibriere, mmss, deEn, sprache, useTakt } from './basis.js';

// [Deutsch, Englisch, Sekunden]
const ALLGEMEIN = [['Hampelmann oder lockeres Seilspringen', 'Jumping jacks or easy rope skipping', 60], ['Katze-Kuh im Vierfüßlerstand', 'Cat-cow on all fours', 40]];
const HUEFTE = [['Weltbeste Dehnung (je Seite 20 s)', 'World\'s greatest stretch (20 s per side)', 40], ['Hüftkreisen im Vierfüßlerstand', 'Quadruped hip circles', 40],
  ['Tiefe Hocke halten, Knie nach außen drücken', 'Hold a deep squat, push the knees out', 45], ['Glute Bridge', 'Glute bridge', 40], ['Beinschwingen vor/zurück und seitlich', 'Leg swings front/back and sideways', 40]];
const OBEN = [['Armkreisen vorwärts und rückwärts', 'Arm circles forwards and backwards', 40], ['Band Pull-Aparts (oder Arme weit öffnen)', 'Band pull-aparts (or open the arms wide)', 40],
  ['Brustwirbelsäule drehen im Vierfüßlerstand (je Seite)', 'Thoracic rotations on all fours (each side)', 45], ['Schulter-Dislocates mit Band oder Stab', 'Shoulder dislocates with band or stick', 40],
  ['Liegestütz langsam, oben Schulterblätter auseinander', 'Slow push-ups, spread the shoulder blades at the top', 40]];

const BEIN = new Set(['squat', 'dead']);
/** Abfolge für die Übungen des Tages (5–8 min). */
export function routineFuer(keys) {
  const lifts = keys.map((k) => liftVon(k)), m = keys.flatMap((k) => uebung(k)?.m ?? []);
  const unten = lifts.some((l) => BEIN.has(l)) || m.some((x) => /quad|hamstring|glute|calves|adductor/i.test(x));
  const oben = lifts.includes('bench') || m.some((x) => /chest|shoulder|lats|middle back|triceps|biceps/i.test(x));
  // kurz halten (03.11.): eine allgemeine und drei passende Übungen, ca. 3 min
  const teile = unten && oben ? [HUEFTE[0], HUEFTE[2], OBEN[2]] : unten ? [HUEFTE[0], HUEFTE[2], HUEFTE[1]] : oben ? [OBEN[0], OBEN[2], OBEN[3]] : [HUEFTE[0], OBEN[0], OBEN[2]];
  return [ALLGEMEIN[0], ...teile];
}

export function AufwaermRoutine({ keys, fertig }) {
  const liste = routineFuer(keys), en = sprache() === 'en';
  const [i, setI] = useState(-1);                    // -1 = Übersicht, sonst laufende Übung
  const [ende, setEnde] = useState(null);
  useTakt(i >= 0, 250);
  const start = (n) => { if (n >= liste.length) { piep(); vibriere([80, 60, 80]); fertig(); return; } setI(n); setEnde(Date.now() + liste[n][2] * 1000); };
  const rest = ende ? Math.max(0, Math.ceil((ende - Date.now()) / 1000)) : 0;
  useEffect(() => { if (i >= 0 && rest <= 0) { piep(); start(i + 1); } }, [i >= 0 && rest <= 0]);
  const gesamt = Math.round(liste.reduce((a, x) => a + x[2], 0) / 60);
  if (i < 0) {
    return html`<section class="card pad stack aufwaerm-routine">
      <div class="row between"><div><span class="eyebrow">${deEn(`Aufwärm-Routine · ca. ${gesamt} min`, `Warm-up routine · about ${gesamt} min`)}</span>
        <h2 class="h2" style="margin:2px 0 0">${deEn('Erst mobil, dann schwer', 'Mobile first, then heavy')}</h2></div><span class="ar-icon" aria-hidden="true">🤸</span></div>
      <ol class="ar-liste">${liste.map(([de, e, s], n) => html`<li key=${n}><span>${en ? e : de}</span><small class="muted">${`${s} s`}</small></li>`)}</ol>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${fertig}>${deEn('Überspringen', 'Skip')}</button>
        <button class="btn btn-chalk" style="flex:1.5" onClick=${() => start(0)}>${deEn('Starten', 'Start')}</button></div>
    </section>`;
  }
  const [de, e, s] = liste[i];
  return html`<section class="card pad stack aufwaerm-routine laeuft">
    <div class="row between"><span class="eyebrow">${`${i + 1} / ${liste.length}`}</span><button class="link" onClick=${fertig}>${deEn('Beenden', 'Finish')}</button></div>
    <b class="ar-name">${en ? e : de}</b>
    <div class="ar-zeit"><b>${mmss(rest)}</b><div class="ar-balken"><i style=${`width:${Math.round((1 - rest / s) * 100)}%`}></i></div></div>
    ${liste[i + 1] ? html`<span class="muted" style="font-size:12.5px">${`${deEn('Danach', 'Next')}: ${en ? liste[i + 1][1] : liste[i + 1][0]}`}</span>` : null}
    <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${i === 0} onClick=${() => start(i - 1)}>${deEn('Zurück', 'Back')}</button>
      <button class="btn btn-chalk" style="flex:1.5" onClick=${() => start(i + 1)}>${i + 1 < liste.length ? deEn('Weiter', 'Next') : deEn('Fertig', 'Done')}</button></div>
  </section>`;
}
