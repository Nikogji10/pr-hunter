// PR Hunter · Jahresrückblick als Story (Wunsch 206): Vollbild, Folie für Folie wie eine Instagram-Story – Fortschritts-
// balken oben, Tippen rechts/links blättert, gedrückt halten pausiert, weiter von selbst nach ein paar Sekunden.
// Zahlen zählen hoch, jede Folie hat ihren eigenen Farbverlauf. Am Ende eine Zusammenfassung zum Teilen (Bild 1080 × 1920).
// Auf „Heute“ erscheint in der letzten Dezemberwoche eine Karte (mit X weg, gemerkt je Jahr); sonst über das Menü.
import { html, useState, useEffect, useRef, fmt, nameVon, LIFT, UebungsBild, deEn, sprache, I, vibriere, useWegwischen } from './basis.js';
import { titelVon } from '../js/rueckblick.js';

const DAUER = 6500;
const VERLAEUFE = [
  ['#FF3D6E', '#7A2CF5'], ['#FF8A00', '#E52E71'], ['#00C6A7', '#1E4DD8'], ['#F2C230', '#E8541E'], ['#8E2DE2', '#4A00E0'],
  ['#11998E', '#38EF7D'], ['#FC466B', '#3F5EFB'], ['#F7971E', '#FFD200'], ['#232526', '#E8113A'],
];
const en = () => sprache() === 'en';
const de2 = (paar) => paar[en() ? 1 : 0];

/** Zahl zählt beim Erscheinen hoch (ease-out). */
function Zahl({ wert, stellen = 0 }) {
  const [z, setZ] = useState(0);
  useEffect(() => {
    let f, t0 = null;
    const schritt = (t) => { t0 ??= t; const p = Math.min(1, (t - t0) / 1300); setZ(wert * (1 - (1 - p) ** 3)); if (p < 1) f = requestAnimationFrame(schritt); };
    f = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(f);
  }, [wert]);
  const lang = fmt(wert, stellen).length;                 // Endwert bestimmt die Größe, damit nichts über den Rand läuft
  return html`<span class="rb-zahl" style=${`font-size:min(108px, calc(84vw / ${Math.max(3, lang) * 0.72}))`}>${fmt(stellen ? Math.round(z * 10 ** stellen) / 10 ** stellen : Math.round(z), stellen)}</span>`;
}

function folien(r, vorname) {
  const f = [];
  f.push({ id: 'start', inhalt: html`<div class="rb-mitte"><span class="rb-emoji gross">🎆</span><span class="rb-klein">${deEn('Dein Jahr', 'Your year')}</span>
    <b class="rb-jahr">${r.jahr}</b><span class="rb-text">${vorname ? deEn(`${vorname}, lass uns zurückschauen.`, `${vorname}, let's look back.`) : deEn('Lass uns zurückschauen.', 'Let\'s look back.')}</span></div>` });
  const mehr = r.vorjahr ? r.trainings - r.vorjahr.trainings : null;
  f.push({ id: 'trainings', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">🏋️</span><span class="rb-klein">${deEn('Du warst', 'You trained')}</span>
    <${Zahl} wert=${r.trainings}/><span class="rb-einheit">${deEn('Mal trainieren', 'times')}</span>
    <span class="rb-text">${deEn(`${r.stunden} Stunden unter der Stange.`, `${r.stunden} hours under the bar.`)}</span>
    ${mehr != null ? html`<span class=${`rb-pille ${mehr >= 0 ? 'auf' : ''}`}>${mehr >= 0 ? deEn(`+${mehr} mehr als ${r.jahr - 1}`, `+${mehr} more than ${r.jahr - 1}`) : deEn(`${mehr} gegenüber ${r.jahr - 1}`, `${mehr} vs ${r.jahr - 1}`)}</span>` : null}</div>` });
  f.push({ id: 'tonnen', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">🐘</span><span class="rb-klein">${deEn('Insgesamt bewegt', 'Total lifted')}</span>
    <${Zahl} wert=${r.tonnen} stellen=${1}/><span class="rb-einheit">${deEn('Tonnen', 'tonnes')}</span>
    <span class="rb-text">${r.elefanten >= 1 ? deEn(`So schwer wie ${fmt(r.elefanten, 1)} Elefanten.`, `As heavy as ${fmt(r.elefanten, 1)} elephants.`) : deEn(`So schwer wie ${r.autos} Autos.`, `As heavy as ${r.autos} cars.`)}</span>
    <span class="rb-klein">${deEn(`${fmt(r.saetze)} Sätze · ${fmt(r.wdh)} Wiederholungen`, `${fmt(r.saetze)} sets · ${fmt(r.wdh)} reps`)}</span></div>` });
  if (r.rekorde) f.push({ id: 'rekorde', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">🏆</span><span class="rb-klein">${deEn('Neue Rekorde', 'New PRs')}</span>
    <${Zahl} wert=${r.rekorde}/>
    <div class="rb-liste">${r.topPrs.map((p, i) => html`<div key=${i} class="rb-zeile" style=${`animation-delay:${0.6 + i * 0.25}s`}><span>${nameVon(p.key)}</span><b>${`+${fmt(p.e1rm - p.vorher, 1)} kg`}</b></div>`)}</div>
    <span class="rb-klein">${deEn('größte Sprünge im e1RM', 'biggest e1RM jumps')}</span></div>` });
  if (r.liebling) f.push({ id: 'liebling', inhalt: html`<div class="rb-mitte"><span class="rb-klein">${deEn('Deine Lieblingsübung', 'Your favourite exercise')}</span>
    <div class="rb-bild"><${UebungsBild} schluessel=${r.liebling} groesse=${150} zoom=${false}/></div>
    <b class="rb-name">${nameVon(r.liebling)}</b><span class="rb-text">${deEn(`${r.lieblingAnzahl}× im Jahr – von ${r.uebungen} verschiedenen Übungen.`, `${r.lieblingAnzahl}× this year – out of ${r.uebungen} different exercises.`)}</span></div>` });
  const maxT = Math.max(...r.monate.map((m) => m.tonnen), 0.001);
  f.push({ id: 'monate', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">📈</span><span class="rb-klein">${deEn('Dein stärkster Monat', 'Your strongest month')}</span>
    <b class="rb-name">${de2(r.monate[r.staerkster].name)}</b><span class="rb-text">${deEn(`${fmt(r.monate[r.staerkster].tonnen, 1)} t in ${r.monate[r.staerkster].trainings} Trainings`, `${fmt(r.monate[r.staerkster].tonnen, 1)} t in ${r.monate[r.staerkster].trainings} workouts`)}</span>
    <div class="rb-saeulen">${r.monate.map((m, i) => html`<div key=${i} class=${`rb-saeule ${i === r.staerkster ? 'top' : ''}`}><i style=${`height:${Math.max(3, (m.tonnen / maxT) * 100)}%;animation-delay:${i * 0.06}s`}></i><small>${de2(m.name).slice(0, 1)}</small></div>`)}</div></div>` });
  f.push({ id: 'gewohnheit', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">🔥</span><span class="rb-klein">${deEn('Längste Serie', 'Longest streak')}</span>
    <${Zahl} wert=${r.serie}/><span class="rb-einheit">${deEn('Wochen am Stück', 'weeks in a row')}</span>
    <div class="rb-kacheln"><div><small>${deEn('Lieblingstag', 'Favourite day')}</small><b>${de2(r.lieblingsTag)}</b></div>
      ${r.tageszeit ? html`<div><small>${deEn('Meistens', 'Mostly')}</small><b>${{ morgens: deEn('morgens ☀️', 'mornings ☀️'), mittags: deEn('mittags 🌤️', 'midday 🌤️'), abends: deEn('abends 🌙', 'evenings 🌙') }[r.tageszeit]}</b></div>` : null}
      ${r.laengste ? html`<div><small>${deEn('Längstes Training', 'Longest workout')}</small><b>${`${r.laengste} min`}</b></div>` : null}</div></div>` });
  if (r.lifts.length) f.push({ id: 'lifts', inhalt: html`<div class="rb-mitte"><span class="rb-emoji">💪</span><span class="rb-klein">${deEn('So viel stärker bist du', 'This much stronger')}</span>
    <div class="rb-lifts">${r.lifts.map((l, i) => html`<div key=${l.lift} class="rb-lift" style=${`animation-delay:${0.3 + i * 0.25}s`}><span>${LIFT[l.lift].name}</span>
      <div class="rb-lift-zahl"><small>${`${fmt(l.start, 1)} →`}</small><b>${fmt(l.best, 1)}</b></div><em>${l.plus > 0 ? `+${fmt(l.plus, 1)} kg` : '±0'}</em></div>`)}</div>
    <span class="rb-klein">${deEn('geschätztes 1RM, Jahresanfang → Bestwert', 'estimated 1RM, start of year → best')}</span></div>` });
  return f;
}

export function Rueckblick({ r, vorname, zu }) {
  const liste = folien(r, vorname).concat([{ id: 'ende', ende: true }]);
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const [status, setStatus] = useState(null);
  const start = useRef(Date.now()), rest = useRef(DAUER), [, takt] = useState(0);
  const ende = i === liste.length - 1;
  useEffect(() => { start.current = Date.now(); rest.current = DAUER; }, [i]);
  useEffect(() => {
    if (pause || ende) return;
    start.current = Date.now();
    const iv = setInterval(() => takt((x) => x + 1), 100), t = setTimeout(() => setI((x) => Math.min(liste.length - 1, x + 1)), rest.current);
    return () => { clearInterval(iv); clearTimeout(t); rest.current = Math.max(0, rest.current - (Date.now() - start.current)); };
  }, [i, pause, ende]);
  useEffect(() => { const esc = (e) => { if (e.key === 'Escape') zu(); }; addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, []);
  const anteil = (n) => (n < i ? 1 : n > i ? 0 : ende ? 1 : Math.min(1, 1 - (rest.current - (pause ? 0 : Date.now() - start.current)) / DAUER));
  const tippe = (e) => {
    if (e.target.closest('button')) return;
    const x = e.clientX / innerWidth;
    vibriere(10);
    setI((n) => (x < 0.33 ? Math.max(0, n - 1) : Math.min(liste.length - 1, n + 1)));
  };
  const [a, b] = VERLAEUFE[i % VERLAEUFE.length];
  const teilen = async () => {
    setStatus('…');
    try {
      const blob = await bildAus(r);
      const datei = new File([blob], `pr-hunter-${r.jahr}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [datei] })) { await navigator.share({ files: [datei], title: `PR Hunter ${r.jahr}` }); setStatus(null); return; }
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: datei.name }).click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus(deEn('Bild gespeichert', 'Image saved'));
    } catch (e) { setStatus(e?.name === 'AbortError' ? null : deEn('Teilen ging nicht – mach einfach einen Screenshot.', 'Sharing failed – just take a screenshot.')); }
  };
  const titel = titelVon(r);
  return html`<div class="rueckblick" role="dialog" aria-modal="true" aria-label=${deEn(`Jahresrückblick ${r.jahr}`, `Year in review ${r.jahr}`)}
    style=${`--rb-a:${a};--rb-b:${b}`} onClick=${tippe} onPointerDown=${(e) => { if (!e.target.closest('button')) setPause(true); }} onPointerUp=${() => setPause(false)} onPointerLeave=${() => setPause(false)}>
    <div class="rb-hintergrund"></div><div class="rb-glanz"></div>
    <div class="rb-oben"><div class="rb-balken">${liste.map((_, n) => html`<div key=${n}><i style=${`width:${anteil(n) * 100}%`}></i></div>`)}</div>
      <div class="row between"><span class="rb-logo">PR <b>Hunter</b> · ${r.jahr}</span><button class="rb-zu" onClick=${zu} aria-label="Schließen">${I.zu}</button></div></div>
    <div class="rb-folie" key=${liste[i].id}>
      ${ende ? html`<div class="rb-mitte"><span class="rb-klein">${deEn(`Dein Titel ${r.jahr}`, `Your ${r.jahr} title`)}</span><b class="rb-titel">${de2(titel)}</b>
        <div class="rb-zusammen">
          <div><small>${deEn('Trainings', 'Workouts')}</small><b>${r.trainings}</b></div><div><small>${deEn('Stunden', 'Hours')}</small><b>${r.stunden}</b></div>
          <div><small>${deEn('Tonnen', 'Tonnes')}</small><b>${fmt(r.tonnen, 1)}</b></div><div><small>${deEn('Rekorde', 'PRs')}</small><b>${r.rekorde}</b></div>
          <div><small>${deEn('Serie', 'Streak')}</small><b>${`${r.serie} ${deEn('Wo.', 'wk')}`}</b></div><div><small>${deEn('Liebling', 'Favourite')}</small><b class="klein">${r.liebling ? nameVon(r.liebling) : '–'}</b></div></div>
        <span class="rb-text">${deEn('Bis nächstes Jahr – stärker als je zuvor. 💪', 'See you next year – stronger than ever. 💪')}</span>
        <div class="row rb-knoepfe"><button class="btn rb-btn-hell" onClick=${() => setI(0)}>${deEn('Nochmal', 'Replay')}</button>
          <button class="btn rb-btn" onClick=${teilen}>${I.teilen} ${deEn('Teilen', 'Share')}</button></div>
        ${status ? html`<span class="rb-klein">${status}</span>` : null}</div>` : liste[i].inhalt}
    </div>
    ${!ende ? html`<span class="rb-hinweis">${pause ? deEn('Pausiert', 'Paused') : ''}</span>` : null}
  </div>`;
}

/** Zusammenfassung als Bild (Hochformat für Story/Status). */
async function bildAus(r) {
  const B = 1080, H = 1920, c = Object.assign(document.createElement('canvas'), { width: B, height: H }), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, B, H); g.addColorStop(0, '#FF3D6E'); g.addColorStop(0.55, '#7A2CF5'); g.addColorStop(1, '#14082E');
  x.fillStyle = g; x.fillRect(0, 0, B, H);
  for (let k = 0; k < 18; k++) { x.fillStyle = `rgba(255,255,255,${0.03 + (k % 4) * 0.015})`; x.beginPath(); x.arc((k * 397) % B, (k * 631) % H, 40 + (k * 53) % 160, 0, 7); x.fill(); }
  const schrift = (gr, dick = 900) => `${dick} ${gr}px Archivo, "Arial Black", system-ui, sans-serif`;
  x.fillStyle = '#fff'; x.textAlign = 'center';
  x.font = schrift(44, 800); x.fillText('PR HUNTER', B / 2, 150);
  x.font = schrift(64, 700); x.fillText(en() ? 'MY YEAR' : 'MEIN JAHR', B / 2, 300);
  x.font = schrift(260); x.fillText(String(r.jahr), B / 2, 530);
  x.font = schrift(64, 800); x.fillText(de2(titelVon(r)).toUpperCase(), B / 2, 660);
  const felder = [[en() ? 'WORKOUTS' : 'TRAININGS', String(r.trainings)], [en() ? 'HOURS' : 'STUNDEN', String(r.stunden)], [en() ? 'TONNES' : 'TONNEN', fmt(r.tonnen, 1)],
    [en() ? 'PRS' : 'REKORDE', String(r.rekorde)], [en() ? 'STREAK' : 'SERIE', `${r.serie} ${en() ? 'WK' : 'WO.'}`], [en() ? 'DAYS' : 'TAGE', String(r.tage)]];
  felder.forEach(([l, w], n) => {
    const sx = n % 2 ? B / 2 + 20 : 80, sy = 760 + Math.floor(n / 2) * 260;
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.roundRect(sx, sy, B / 2 - 100, 220, 36); x.fill();
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = schrift(36, 700); x.textAlign = 'left'; x.fillText(l, sx + 40, sy + 70);
    x.fillStyle = '#fff'; x.font = schrift(100); x.fillText(w, sx + 40, sy + 180);
  });
  x.textAlign = 'center'; x.fillStyle = '#fff';
  if (r.liebling) { x.font = schrift(36, 700); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(en() ? 'FAVOURITE EXERCISE' : 'LIEBLINGSÜBUNG', B / 2, 1600); x.fillStyle = '#fff'; x.font = schrift(56, 800); x.fillText(nameVon(r.liebling).slice(0, 30), B / 2, 1675); }
  x.font = schrift(34, 700); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(en() ? 'Stronger than ever 💪' : 'Stärker als je zuvor 💪', B / 2, 1820);
  return new Promise((ok, nein) => c.toBlob((b) => (b ? ok(b) : nein(new Error('Bild'))), 'image/png'));
}

/** Kleiner Hinweis auf „Heute“ (ab 18.12.): einmalig – wegwischen, ✕ oder Öffnen blendet ihn für dieses Jahr aus. */
export function RueckblickKarte({ jahr, oeffnen, weg }) {
  const w = useWegwischen(weg);
  return html`<section class="card rb-hinweis kein-wisch" ...${w.props} role="button" tabIndex="0"
    onClick=${(e) => { if (e.target.closest('.rb-hinweis-zu') || !w.geklickt()) return; weg(); oeffnen(); }}>
    <span class="rb-hinweis-icon" aria-hidden="true">🎆</span>
    <span class="rb-hinweis-text"><b>${deEn(`Dein Jahresrückblick ${jahr} ist da`, `Your ${jahr} year in review is here`)}</b></span>
    <button class="rb-hinweis-zu" onClick=${(e) => { e.stopPropagation(); w.ausblenden(1); }} aria-label="Ausblenden">${I.zu}</button>
  </section>`;
}
