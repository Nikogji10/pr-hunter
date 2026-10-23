// PR Hunter · Datenstand der Oberfläche. app.js setzt ihn (echte Trainings über js/daten.js oder Beispieldaten),
// die Ansichten lesen ihn beim Rendern. ES-Module geben `let`-Exporte als Live-Bindings weiter.
export { plusTage, kanon, letzterWert, ersterWert } from '../js/daten.js';

export let HEUTE = new Date().toISOString().slice(0, 10);
export let URLAUB = null;                      // { von, bis, name } oder null
export let wochen = [];
export let e1rmWoche = { squat: [], bench: [], dead: [] };
export let volumenWoche = [];
export let trainingsTage = {};
export let REKORDE = { squat: [], bench: [], dead: [] };
export let PR_FEED = [];
export let LETZTES = {};
export let BEST_E1RM = {};
export let E1RM_AKTUELL = {};
export let ZULETZT = {};                       // key → Datum des letzten Trainings mit dieser Übung
export let KOERPERGEWICHT = null;
export let KOERPERVERLAUF = [];                // [{ datum, kg }] aufsteigend
export let DEMO = false;
export let trainingAm = () => null;
export let verlaufUebung = () => null;
export let rekordeVon = () => ({ wdh: Array(10).fill(null), e1rm: null });

export function setzeStand(s) {
  ({ HEUTE, URLAUB = null, wochen, e1rmWoche, volumenWoche, trainingsTage, REKORDE, PR_FEED, LETZTES, BEST_E1RM, E1RM_AKTUELL,
    ZULETZT = {}, KOERPERGEWICHT = null, KOERPERVERLAUF = [], DEMO = false, trainingAm, verlaufUebung,
    rekordeVon = () => ({ wdh: Array(10).fill(null), e1rm: null }) } = s);
}

// #################################################################
// Dienste der App-Hülle (speichern, laden, anlegen), von app.js gesetzt; in der Demo bleiben sie leer
// #################################################################
export const DIENSTE = {
  speichereAnpassung: null,     // (key, anpassung) → Promise
  ladeUebungDetails: null,      // (key) → Promise<{ bilder, anleitung, m2 }>
  uebungAnlegen: null,          // (formular) → Promise<katalogEintrag>
  uebungAendern: null,          // (id, formular) → Promise<katalogEintrag>
  aehnliche: null,              // (name) → Promise<[{ key, name_de, name_en, matched, score }]>
  neueUebungStarten: null,      // (suchtext, beiWahl) → öffnet das Formular
  darfAendern: () => false,     // (katalogEintrag) → Ersteller oder Admin
};
export function setzeDienste(d) { Object.assign(DIENSTE, d); }

/** Lokales Datum (nicht UTC) als JJJJ-MM-TT. */
export function heuteLokal(jetzt = new Date()) {
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
}
export const imUrlaub = (d) => !!URLAUB && d >= URLAUB.von && d <= URLAUB.bis;
