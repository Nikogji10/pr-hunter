// PR Hunter · Seitenmenü (☰, Wunsch 172) mit den Werkzeugen und Wischgesten (172/178):
// vom linken Rand nach rechts wischen öffnet das Menü (überall, auch im Training), sonst wechselt
// waagrechtes Wischen die Seite der unteren Leiste. Nicht in Fenstern, Eingaben und waagrecht scrollbaren Bereichen.
import { html, useEffect, useRef, I } from './basis.js';
import { RECHNER } from './rechner.js';

const RAND = 28;            // px vom linken Rand, ab denen ein Wisch das Menü öffnet
const MIN_WEG = 70;         // px waagrecht
const MAX_ZEIT = 700;       // ms

/** true, wenn ein Vorfahr waagrecht scrollt oder eine Eingabe/ein Regler ist – dort gehört das Wischen dem Element. */
function eigenesWischen(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.matches?.('input, textarea, select, [role="slider"], .sheet, .lupe, .zuschnitt, .ex, .kein-wisch')) return true;
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2) return true;
  }
  return false;
}

/** Wischgesten: links/rechts zum Seitenwechsel (wenn erlaubt), vom linken Rand zum Öffnen des Menüs. */
export function useWischen({ zurueck, weiter, menueAuf, seitenWechsel = true }) {
  const fn = useRef({});
  fn.current = { zurueck, weiter, menueAuf, seitenWechsel };
  useEffect(() => {
    let start = null;
    const an = (e) => {
      const t = e.touches[0];
      const rand = t.clientX <= RAND;
      // vom Rand immer (außer in Fenstern/Eingaben), sonst nur, wo das Element nicht selbst wischt (Satzkarten, Chip-Leisten …)
      start = e.touches.length === 1 && !document.querySelector('.sheet, .lupe, .seitenmenue.auf')
        && !(rand ? e.target.closest?.('input, textarea, select, [role="slider"]') : eigenesWischen(e.target))
        ? { x: t.clientX, y: t.clientY, zeit: Date.now(), rand } : null;
    };
    const ende = (e) => {
      if (!start) return;
      const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
      const s = start; start = null;
      if (Date.now() - s.zeit > MAX_ZEIT || Math.abs(dx) < MIN_WEG || Math.abs(dx) < 2 * Math.abs(dy)) return;
      const f = fn.current;
      if (s.rand && dx > 0) { f.menueAuf(); return; }
      if (!(typeof f.seitenWechsel === 'function' ? f.seitenWechsel() : f.seitenWechsel)) return;
      if (dx < 0) f.weiter?.(); else if (f.zurueck) f.zurueck(); else f.menueAuf();
    };
    addEventListener('touchstart', an, { passive: true });
    addEventListener('touchend', ende, { passive: true });
    return () => { removeEventListener('touchstart', an); removeEventListener('touchend', ende); };
  }, []);
}

export function MenueKnopf({ auf }) {
  return html`<button class="iconbtn menue-knopf" onClick=${auf} aria-label="Menü mit Rechnern öffnen"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></button>`;
}

const WERKZEUG_TEXT = {
  '1rm': 'Maximalkraft aus Gewicht × Wdh', scheiben: 'Was auf die Stange kommt', rpe: 'Gewicht für Ziel-Wdh und RPE', prozent: 'Prozent vom Max',
  koerper: 'Klimmzug und Dips mit Körpergewicht', warm: 'Aufwärmsätze bis zum Top-Satz', punkte: 'DOTS, IPF GL, Wilks', versuche: 'Wettkampfversuche planen',
  timer: 'Stoppuhr und Intervall-Timer',
};

/** Seitenmenü links: Werkzeuge (Rechner) – zieht sich nach links zu, Tipp daneben schließt. */
export function SeitenMenue({ auf, zu, waehle, einfach = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!auf) return;
    const st = { ...(history.state ?? {}), menue: true };
    history.pushState(st, '');
    const pop = () => zu(true);
    addEventListener('popstate', pop);
    // nach links wischen schließt
    let x0 = null;
    const an = (e) => { x0 = e.touches[0].clientX; };
    const ende = (e) => { if (x0 != null && e.changedTouches[0].clientX - x0 < -60) history.back(); x0 = null; };
    const el = ref.current;
    el?.addEventListener('touchstart', an, { passive: true }); el?.addEventListener('touchend', ende, { passive: true });
    return () => { removeEventListener('popstate', pop); el?.removeEventListener('touchstart', an); el?.removeEventListener('touchend', ende); };
  }, [auf]);
  if (!auf) return null;
  const schliessen = () => history.back();
  return html`<div class="seitenmenue auf" ref=${ref}>
    <div class="sm-hinter" onClick=${schliessen}></div>
    <nav class="sm-leiste" aria-label="Werkzeuge">
      <div class="sm-kopf"><span class="logo"><b>PR</b> Hunter</span><button class="iconbtn" onClick=${schliessen} aria-label="Menü schließen">${I.zu}</button></div>
      <span class="eyebrow sm-titel">Werkzeuge</span>
      ${[...RECHNER, ['timer', 'Timer']].filter(([k]) => !einfach || !['punkte', 'versuche'].includes(k)).map(([k, t]) => html`<button key=${k} class="sm-punkt" onClick=${() => waehle(k)}>
        <span class="sm-icon">${I.rechner}</span><span class="sm-text"><b>${t}</b><small>${WERKZEUG_TEXT[k]}</small></span><span class="sm-pfeil">›</span></button>`)}
      <span class="eyebrow sm-titel">Hilfe</span>
      <button class="sm-punkt" onClick=${() => waehle('begriffe')}><span class="sm-icon">?</span><span class="sm-text"><b>Begriffe erklärt</b><small>RPE, e1RM, Back-off, Deload …</small></span><span class="sm-pfeil">›</span></button>
      <span class="muted sm-tipp">Tipp: vom linken Rand nach rechts wischen öffnet dieses Menü überall.</span>
    </nav>
  </div>`;
}
