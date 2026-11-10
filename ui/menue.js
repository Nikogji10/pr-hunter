// PR Hunter · Seitenmenü (☰, Wunsch 172) mit den Werkzeugen und Wischgesten (172/178):
// vom linken Rand nach rechts wischen öffnet das Menü (überall, auch im Training), sonst wechselt
// waagrechtes Wischen die Seite der unteren Leiste. Nicht in Fenstern, Eingaben und waagrecht scrollbaren Bereichen.
import { html, useEffect, useRef, I, werkzeugIcon, ebeneEintragen } from './basis.js';
import { RECHNER } from './rechner.js';

const RAND = 28;            // px vom linken Rand, ab denen ein Wisch das Menü öffnet
const MIN_WEG = 70;         // px waagrecht
const MAX_ZEIT = 700;       // ms

/** true, wenn ein Vorfahr waagrecht scrollt oder eine Eingabe/ein Regler ist – dort gehört das Wischen dem Element. */
function eigenesWischen(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.matches?.('input, textarea, select, [role="slider"], .sheet, .lupe, .zuschnitt, .ex, .kein-wisch, .toast')) return true;
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2) return true;
  }
  return false;
}

/**
 * Wischgesten, die dem Finger folgen (wie Jefit): waagrechtes Ziehen verschiebt die Seite, die Nachbarseite schiebt sich
 * schon mit herein; vom linken Rand (oder auf der ersten Seite nach rechts) zieht sich das Seitenmenü mit auf.
 * zug: { start(art) → bool, bewege(art, dx), ende(art, erfolg) } mit art 'weiter' | 'zurueck' | 'menue'.
 */
export function useWischen({ zurueck, weiter, menueAuf, seitenWechsel = true, zug = null }) {
  const fn = useRef({});
  fn.current = { zurueck, weiter, menueAuf, seitenWechsel, zug };
  useEffect(() => {
    let s = null, wache = null;
    // Geste abbrechen (Seite gleitet zurück): zweiter Finger, Zurück-Taste, App im Hintergrund – vorher blieben beide Seiten stehen
    const abbrechen = () => {
      clearInterval(wache);
      const art = s?.art;
      s = null;
      if (art) fn.current.zug.ende(art, false);
    };
    const an = (e) => {
      if (s?.art || (s && e.touches.length > 1)) { abbrechen(); return; }
      const t = e.touches[0];
      const rand = t.clientX <= RAND;
      // vom Rand immer (außer in Fenstern/Eingaben), sonst nur, wo das Element nicht selbst wischt (Satzkarten, Chip-Leisten …)
      s = e.touches.length === 1 && !document.querySelector('.sheet, .lupe, .seitenmenue.auf')
        && !(rand ? e.target.closest?.('input, textarea, select, [role="slider"]') : eigenesWischen(e.target))
        ? { x: t.clientX, y: t.clientY, zeit: Date.now(), rand, art: null, dx: 0, warteAnfang: !!fn.current.zug?.beschaeftigt?.() } : null;
    };
    const zieh = (e) => {
      if (!s) return;
      if (e.touches.length > 1) { abbrechen(); return; }
      const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      // Richtung früh festlegen (vor der Scroll-Schwelle des Browsers): waagrecht → senkrechtes Scrollen für diese Geste aus
      if (!s.waagrecht) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        if (Math.abs(dy) * 1.25 >= Math.abs(dx)) { s = null; return; }                  // eher senkrecht: Browser scrollt
        s.waagrecht = true;
      }
      if (e.cancelable) e.preventDefault();
      if (s.keine) return;                                                                // waagrecht, aber nichts zu wischen
      if (!s.art) {
        if (Math.abs(dx) < 12) return;
        const f = fn.current;
        const wechsel = typeof f.seitenWechsel === 'function' ? f.seitenWechsel() : f.seitenWechsel;
        const art = s.rand && dx > 0 ? 'menue' : !wechsel ? null : dx < 0 ? (f.weiter ? 'weiter' : null) : f.zurueck ? 'zurueck' : 'menue';
        // läuft die vorige Wisch-Animation noch, nicht verwerfen – bei der nächsten Bewegung erneut versuchen (schnelles Wischen)
        // Geste beginnt während einer laufenden Wisch-Animation: nicht mittendrin einsteigen, sondern einreihen (schnelles Mehrfach-Wischen)
        if (art && art !== 'menue' && (s.warteAnfang || f.zug?.beschaeftigt?.())) { s.wartet = art; s.dx = dx; return; }
        if (!art || !f.zug?.start(art)) { s.keine = true; return; }
        s.art = art;
        s.ab = dx;                                     // ab hier mitgehen – ohne Sprung um die 12-px-Schwelle
        // Sicherheitsnetz: kommt kein Loslassen an (Browser hat die Geste übernommen), nach 1,2 s ohne Bewegung beenden
        clearInterval(wache);
        wache = setInterval(() => { if (s?.art && Date.now() - s.letzte > 1200) ende(); }, 300);
      }
      s.letzte = Date.now();
      s.dx = dx;
      fn.current.zug.bewege(s.art, dx - (s.ab ?? 0));
    };
    const ende = () => {
      clearInterval(wache);
      // Geste lief komplett, während die vorige Animation noch lief: Wechsel danach nachholen (sehr schnelles Wischen)
      if (!s?.art) {
        if (s?.wartet) { const w = Math.abs(s.dx), v = w / Math.max(1, Date.now() - s.zeit); if (w > innerWidth * 0.25 || (w > 40 && v > 0.45)) fn.current.zug.nachholen?.(s.wartet); }
        s = null; return;
      }
      const dauer = Math.max(1, Date.now() - s.zeit), weg = Math.abs(s.dx);
      const richtig = s.art === 'weiter' ? s.dx < 0 : s.dx > 0;
      const erfolg = richtig && (weg > innerWidth * 0.33 || (weg > 40 && weg / dauer > 0.45));
      // Tempo nach dem Finger: Restweg ÷ Fingergeschwindigkeit, 80–160 ms (schnell wischen = schnell wechseln)
      const tempo = Math.abs(s.dx) / dauer, rest = Math.max(0, innerWidth - weg);
      fn.current.zug.ende(s.art, erfolg, erfolg ? Math.round(Math.min(100, Math.max(50, rest / Math.max(tempo, 1.2)))) : 100);
      s = null;
    };
    const weg = () => { if (s?.art) abbrechen(); };
    const sichtbarkeit = () => { if (document.hidden) weg(); };
    addEventListener('popstate', weg);
    document.addEventListener('visibilitychange', sichtbarkeit);
    addEventListener('touchstart', an, { passive: true });
    addEventListener('touchmove', zieh, { passive: false });
    addEventListener('touchend', ende, { passive: true });
    addEventListener('touchcancel', ende, { passive: true });
    return () => { removeEventListener('popstate', weg); document.removeEventListener('visibilitychange', sichtbarkeit); removeEventListener('touchstart', an); removeEventListener('touchmove', zieh); removeEventListener('touchend', ende); removeEventListener('touchcancel', ende); };
  }, []);
}

export function MenueKnopf({ auf }) {
  return html`<button class="iconbtn menue-knopf" onClick=${auf} aria-label="Menü mit Rechnern öffnen"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></button>`;
}

const WERKZEUG_TEXT = {
  '1rm': 'Maximalkraft aus Gewicht × Wdh', scheiben: 'Was auf die Stange kommt', rpe: 'Gewicht für Ziel-Wdh und RPE', prozent: 'Prozent vom Max',
  koerper: 'Klimmzug und Dips mit Körpergewicht', warm: 'Aufwärmsätze bis zum Top-Satz', punkte: 'DOTS, IPF GL, Wilks', versuche: 'Wettkampfversuche planen',
  timer: 'Stoppuhr und Intervall-Timer', wettkampf: 'Versuche abhaken, Total, Aufwärmen am Meet-Tag', video: 'Video: Hantelweg und Tempo',
};

/** Seitenmenü links: Werkzeuge (Rechner) – zieht sich nach links zu, Tipp daneben schließt. */
export function SeitenMenue({ auf, zu, waehle, einfach = false, vorschau = false, ohneEinblenden = false, rueckblickJahr = null }) {
  const ref = useRef(null), ohneRef = useRef(null);
  const offen = auf && !vorschau;
  useEffect(() => {
    if (!offen) return;
    const st = { ...(history.state ?? {}), menue: true };
    const pop = () => zu(true);
    const ohne = ebeneEintragen(st, pop);           // 254: ohne Antippen (Wischen) kein Eintrag
    ohneRef.current = ohne;
    if (!ohne) addEventListener('popstate', pop);
    // nach links ziehen schließt – die Leiste folgt dem Finger
    const el = ref.current, leiste = () => el?.querySelector('.sm-leiste'), hinter = () => el?.querySelector('.sm-hinter');
    let x0 = null, dx = 0;
    const an = (e) => { x0 = e.touches[0].clientX; dx = 0; leiste()?.classList.add('zieht'); hinter()?.classList.add('zieht'); };
    const zieh = (e) => {
      if (x0 == null) return;
      dx = Math.min(0, e.touches[0].clientX - x0) / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
      const l = leiste(); if (!l) return;
      l.style.transform = `translateX(${dx}px)`;
      hinter().style.opacity = String(Math.max(0, 1 + dx / l.offsetWidth));
    };
    const ende = () => {
      if (x0 == null) return;
      x0 = null;
      const l = leiste(), h = hinter();
      l?.classList.remove('zieht'); h?.classList.remove('zieht');
      if (l && dx < -Math.min(90, l.offsetWidth * 0.3)) { l.style.transform = 'translateX(-100%)'; h.style.opacity = '0'; setTimeout(() => (ohneRef.current ? zu(true) : history.back()), 180); }
      else if (l) { l.style.transform = ''; h.style.opacity = ''; }
    };
    el?.addEventListener('touchstart', an, { passive: true }); el?.addEventListener('touchmove', zieh, { passive: true });
    el?.addEventListener('touchend', ende, { passive: true }); el?.addEventListener('touchcancel', ende, { passive: true });
    return () => {
      removeEventListener('popstate', pop); ohne?.(); ohneRef.current = null;
      for (const [n, f] of [['touchstart', an], ['touchmove', zieh], ['touchend', ende], ['touchcancel', ende]]) el?.removeEventListener(n, f);
    };
  }, [offen]);
  if (!auf) return null;
  const schliessen = () => (ohneRef.current ? zu(true) : history.back());
  return html`<div class=${`seitenmenue auf ${vorschau ? 'vorschau' : ''} ${ohneEinblenden ? 'ohne-ein' : ''}`} ref=${ref}>
    <div class="sm-hinter" onClick=${schliessen}></div>
    <nav class="sm-leiste" aria-label="Werkzeuge">
      <div class="sm-kopf"><span class="logo"><b>PR</b> Hunter</span><button class="iconbtn" onClick=${schliessen} aria-label="Menü schließen">${I.zu}</button></div>
      <span class="eyebrow sm-titel">Werkzeuge</span>
      ${[...RECHNER, ['timer', 'Timer']].filter(([k]) => !einfach || !['punkte', 'versuche', 'wettkampf'].includes(k)).map(([k, t]) => html`<button key=${k} class="sm-punkt" onClick=${() => waehle(k)}>
        <span class="sm-icon">${werkzeugIcon(k)}</span><span class="sm-text"><b>${t}</b><small>${WERKZEUG_TEXT[k]}</small></span><span class="sm-pfeil">›</span></button>`)}
      ${rueckblickJahr ? html`<span class="eyebrow sm-titel">Rückblick</span>
      <button class="sm-punkt" onClick=${() => { zu(); setTimeout(() => dispatchEvent(new CustomEvent('prh-rueckblick', { detail: { jahr: rueckblickJahr } })), 120); }}>
        <span class="sm-icon">🎆</span><span class="sm-text"><b>${`Jahresrückblick ${rueckblickJahr}`}</b><small>Dein Trainingsjahr als Story</small></span><span class="sm-pfeil">›</span></button>` : null}
      ${!vorschau ? html`<span class="eyebrow sm-titel">Coach</span>
      <button class="sm-punkt" onClick=${() => waehle('coach')}><span class="sm-icon">📋</span><span class="sm-text"><b>Coach-Modus</b><small>Athleten betreuen, Trainings sehen, Pläne schicken</small></span><span class="sm-pfeil">›</span></button>` : null}
      <span class="eyebrow sm-titel">Hilfe</span>
      <button class="sm-punkt" onClick=${() => waehle('begriffe')}><span class="sm-icon">?</span><span class="sm-text"><b>Begriffe erklärt</b><small>RPE, e1RM, Back-off, Deload …</small></span><span class="sm-pfeil">›</span></button>
      <span class="muted sm-tipp">Tipp: vom linken Rand nach rechts wischen öffnet dieses Menü überall.</span>
    </nav>
  </div>`;
}
