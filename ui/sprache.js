// PR Hunter · Englische Oberfläche. Die Komponenten schreiben deutsch; hier wird das fertig Gezeichnete übersetzt:
// Textknoten und die Attribute aria-label, title, placeholder – auch in Fenstern, Hinweisen und Meldungen. Ein
// MutationObserver übersetzt alles, was Preact neu zeichnet, noch vor dem Malen. Zurück auf Deutsch stellt die gemerkten
// Originale wieder her. Übungsnamen kommen schon englisch aus dem Katalog; Nutzertexte (Notizen, Namen) treffen kein Wort.
import { EN, EN_MUSTER } from './en.js';

const ATTRIBUTE = ['aria-label', 'title', 'placeholder'];
const texte = new WeakMap();      // Textknoten → { de, en }
const attribute = new WeakMap();  // Element → { [attr]: { de, en } }
let aktiv = false, beobachter = null;

const muster = EN_MUSTER.map(([de, en]) => {
  const teile = de.split(/\{\d\}/);
  const quelle = teile.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
  return { re: new RegExp(`^${quelle}$`), vorne: teile[0], en };
});

/** Deutscher Text → englisch (Leerraum bleibt), oder null, wenn unbekannt. */
export function uebersetze(text) {
  const t = text.trim();
  if (t.length < 2 || !/[A-Za-zÄÖÜäöüß]/.test(t)) return null;
  let e = EN.get(t);
  if (e == null) {
    for (const m of muster) {
      if (m.vorne && !t.startsWith(m.vorne)) continue;
      const r = m.re.exec(t);
      if (r) { e = m.en.replace(/\{(\d)\}/g, (_, i) => uebersetze(r[+i + 1]) ?? r[+i + 1]); break; }
    }
  }
  if (e == null && t.includes(' · ')) {                     // „Kniebeuge · Bankdrücken“: Teile einzeln
    const teile = t.split(' · ').map((x) => uebersetze(x) ?? x);
    if (teile.join(' · ') !== t) e = teile.join(' · ');
  }
  if (e == null) return null;
  return text.slice(0, text.length - text.trimStart().length) + e + text.slice(text.trimEnd().length);
}

function text(n) {
  const alt = texte.get(n);
  if (alt && n.data === alt.en) return;
  const en = uebersetze(n.data);
  if (en != null && en !== n.data) { texte.set(n, { de: n.data, en }); n.data = en; } else texte.delete(n);
}
function attribut(el, name) {
  const v = el.getAttribute(name);
  if (v == null) return;
  const alle = attribute.get(el) ?? {}, alt = alle[name];
  if (alt && v === alt.en) return;
  const en = uebersetze(v);
  if (en != null && en !== v) { alle[name] = { de: v, en }; attribute.set(el, alle); el.setAttribute(name, en); }
}
const auslassen = (el) => el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.getAttribute('translate') === 'no';
// Textfelder: Platzhalter übersetzen, den Inhalt (Nutzertext) nie
const imTextfeld = (n) => n.nodeType === 3 && n.parentNode?.tagName === 'TEXTAREA';

/** Teilbaum durchgehen: übersetzen (aktiv) oder Originale zurückschreiben. */
function durchgehen(wurzel, zurueck = false) {
  const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.nodeType === 1 && auslassen(n)) || imTextfeld(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = (wurzel.nodeType === 1 && auslassen(wurzel)) || imTextfeld(wurzel) ? null : w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 3) {
      if (!zurueck) text(n);
      else { const alt = texte.get(n); if (alt && n.data === alt.en) n.data = alt.de; texte.delete(n); }
    } else if (!zurueck) {
      for (const a of ATTRIBUTE) if (n.hasAttribute(a)) attribut(n, a);
    } else {
      const alle = attribute.get(n);
      if (alle) for (const [a, { de, en }] of Object.entries(alle)) if (n.getAttribute(a) === en) n.setAttribute(a, de);
      attribute.delete(n);
    }
  }
}

const beobachten = () => new MutationObserver((liste) => {
  if (!aktiv) return;
  for (const m of liste) {
    if (m.type === 'characterData') { if (!imTextfeld(m.target)) text(m.target); }
    else if (m.type === 'attributes') attribut(m.target, m.attributeName);
    else for (const n of m.addedNodes) if (n.isConnected) durchgehen(n);
  }
});

/** Sprache der Oberfläche setzen ('de' | 'en'). */
export function setzeSprache(sprache) {
  const neu = sprache === 'en';
  document.documentElement.lang = neu ? 'en' : 'de';
  if (neu === aktiv) return;
  aktiv = neu;
  if (aktiv) {
    beobachter ??= beobachten();
    beobachter.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTE });
    durchgehen(document.body);
  } else {
    beobachter?.disconnect();
    durchgehen(document.body, true);
  }
}
