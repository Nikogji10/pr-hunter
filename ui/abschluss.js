// PR Hunter · Abschlusskarte nach „Training beenden → Speichern“ (Wünsche 70, 97): Dauer, Volumen, Sätze, Übungen,
// Rekorde und das ganze Training – jede Übung mit ihren Sätzen (gleiche kg × Wdh hintereinander zusammengefasst).
// Sätze und Gewichte lassen sich ausblenden (gemerkt pro Gerät). „Teilen“ zeichnet dieselbe Karte als Bild (Canvas,
// 1080 × 1350) und gibt sie ans Teilen-Menü des Handys; ohne Teilen-Funktion wird das Bild heruntergeladen.
import { html, useState, useEffect, I, deEn, fmt, datumLang, gw, gwE, einheit, tonnage, minutenText, nameVon, sprache } from './basis.js';
import { uebersetze } from './sprache.js';

const MIT_SAETZEN = 'prh-abschluss-saetze';

// Bewegtes Gewicht als Turm aus 25-kg-Scheiben neben einem Menschen (Wunsch 104): eine liegende Scheibe ≈ 6,5 cm, ein
// Mensch 1,80 m. Beide im selben Maßstab – je mehr Volumen, desto höher der Turm und desto kleiner wirkt der Mensch.
const SCHEIBE_CM = 6.5, SCHEIBE_D_CM = 45, MENSCH_CM = 180;      // Dicke und Durchmesser einer 25-kg-Scheibe
// 160: viele Scheiben verteilt auf mehrere Stapel nebeneinander (je höchstens 2 Menschen hoch, bis 6 Stapel), damit
// der Mensch sichtbar bleibt; der Text nennt weiter die Gesamthöhe.
const MAX_STAPEL = 6, STAPEL_MAX_CM = MENSCH_CM * 2;
export function stapelMasse(volumenKg, hoehePx) {
  const n = Math.max(1, Math.round(volumenKg / 25)), cm = n * SCHEIBE_CM;
  const stapel = Math.min(MAX_STAPEL, Math.max(1, Math.ceil(cm / STAPEL_MAX_CM)));
  const jeCm = cm / stapel;
  const skala = (hoehePx * 0.92) / Math.max(jeCm, MENSCH_CM);
  return { n, cm, stapel, turm: jeCm * skala, breite: SCHEIBE_D_CM * skala, mensch: MENSCH_CM * skala, scheibe: SCHEIBE_CM * skala, menschen: cm / MENSCH_CM };
}
const stapelText = (m) => deEn(`${m.n} × 25-kg-Scheiben übereinander: ${fmt(m.cm / 100, 1)} m – ${m.menschen >= 1 ? `so hoch wie ${fmt(m.menschen, 1)} Menschen` : 'noch kleiner als ein Mensch'}${m.stapel > 1 ? ` (hier in ${m.stapel} Stapeln)` : ''}`,
  `${m.n} × 25 kg plates stacked: ${fmt(m.cm / 100, 1)} m – ${m.menschen >= 1 ? `as tall as ${fmt(m.menschen, 1)} people` : 'still shorter than a person'}${m.stapel > 1 ? ` (shown as ${m.stapel} stacks)` : ''}`);
// Mensch in Frontansicht, Arme schräg nach außen, Muskeln angedeutet (eigene Zeichnung, tools: Scratchpad-Skript);
// viewBox 0 0 60 100 – im Bild über Path2D genauso gezeichnet
const MENSCH_UMRISS = 'M30 1C29.2 1 28.22 1.17 27.6 1.6C26.98 2.03 26.55 2.8 26.3 3.6C26.05 4.4 26.05 5.5 26.1 6.4C26.15 7.3 26.32 8.23 26.6 9C26.88 9.77 27.57 10.3 27.8 11C28.03 11.7 28.47 12.6 28 13.2C27.53 13.8 26.08 14.2 25 14.6C23.92 15 22.57 15.27 21.5 15.6C20.43 15.93 19.38 16.07 18.6 16.6C17.82 17.13 17.37 17.83 16.8 18.8C16.23 19.77 15.8 21.03 15.2 22.4C14.6 23.77 13.87 25.57 13.2 27C12.53 28.43 11.93 29.6 11.2 31C10.47 32.4 9.53 34.13 8.8 35.4C8.07 36.67 7.5 37.8 6.8 38.6C6.1 39.4 5.2 39.57 4.6 40.2C4 40.83 3.37 41.67 3.2 42.4C3.03 43.13 3.23 44.17 3.6 44.6C3.97 45.03 4.83 45.2 5.4 45C5.97 44.8 6.47 43.97 7 43.4C7.53 42.83 8.03 42.23 8.6 41.6C9.17 40.97 9.67 40.6 10.4 39.6C11.13 38.6 12.17 36.93 13 35.6C13.83 34.27 14.63 32.97 15.4 31.6C16.17 30.23 16.83 28.57 17.6 27.4C18.37 26.23 19.57 24.33 20 24.6C20.43 24.87 20.03 27.43 20.2 29C20.37 30.57 20.72 32.17 21 34C21.28 35.83 21.73 38.33 21.9 40C22.07 41.67 22.12 42.67 22 44C21.88 45.33 21.43 46.33 21.2 48C20.97 49.67 20.65 51.67 20.6 54C20.55 56.33 20.68 59.5 20.9 62C21.12 64.5 21.75 67 21.9 69C22.05 71 21.98 72.17 21.8 74C21.62 75.83 20.83 77.67 20.8 80C20.77 82.33 21.23 85.5 21.6 88C21.97 90.5 22.9 93.27 23 95C23.1 96.73 21.43 97.7 22.2 98.4C22.97 99.1 26.7 99.6 27.6 99.2C28.5 98.8 27.7 97.87 27.6 96C27.5 94.13 27.17 90.67 27 88C26.83 85.33 26.53 82.5 26.6 80C26.67 77.5 27.3 74.83 27.4 73C27.5 71.17 27.1 71 27.2 69C27.3 67 27.7 63.33 28 61C28.3 58.67 28.67 56.25 29 55C29.33 53.75 29.67 53.5 30 53.5C30.33 53.5 30.67 53.75 31 55C31.33 56.25 31.7 58.67 32 61C32.3 63.33 32.7 67 32.8 69C32.9 71 32.5 71.17 32.6 73C32.7 74.83 33.33 77.5 33.4 80C33.47 82.5 33.17 85.33 33 88C32.83 90.67 32.5 94.13 32.4 96C32.3 97.87 31.5 98.8 32.4 99.2C33.3 99.6 37.03 99.1 37.8 98.4C38.57 97.7 36.9 96.73 37 95C37.1 93.27 38.03 90.5 38.4 88C38.77 85.5 39.23 82.33 39.2 80C39.17 77.67 38.38 75.83 38.2 74C38.02 72.17 37.95 71 38.1 69C38.25 67 38.88 64.5 39.1 62C39.32 59.5 39.45 56.33 39.4 54C39.35 51.67 39.03 49.67 38.8 48C38.57 46.33 38.12 45.33 38 44C37.88 42.67 37.93 41.67 38.1 40C38.27 38.33 38.72 35.83 39 34C39.28 32.17 39.63 30.57 39.8 29C39.97 27.43 39.57 24.87 40 24.6C40.43 24.33 41.63 26.23 42.4 27.4C43.17 28.57 43.83 30.23 44.6 31.6C45.37 32.97 46.17 34.27 47 35.6C47.83 36.93 48.87 38.6 49.6 39.6C50.33 40.6 50.83 40.97 51.4 41.6C51.97 42.23 52.47 42.83 53 43.4C53.53 43.97 54.03 44.8 54.6 45C55.17 45.2 56.03 45.03 56.4 44.6C56.77 44.17 56.97 43.13 56.8 42.4C56.63 41.67 56 40.83 55.4 40.2C54.8 39.57 53.9 39.4 53.2 38.6C52.5 37.8 51.93 36.67 51.2 35.4C50.47 34.13 49.53 32.4 48.8 31C48.07 29.6 47.47 28.43 46.8 27C46.13 25.57 45.4 23.77 44.8 22.4C44.2 21.03 43.77 19.77 43.2 18.8C42.63 17.83 42.18 17.13 41.4 16.6C40.62 16.07 39.57 15.93 38.5 15.6C37.43 15.27 36.08 15 35 14.6C33.92 14.2 32.47 13.8 32 13.2C31.53 12.6 31.97 11.7 32.2 11C32.43 10.3 33.12 9.77 33.4 9C33.68 8.23 33.85 7.3 33.9 6.4C33.95 5.5 33.95 4.4 33.7 3.6C33.45 2.8 33.02 2.03 32.4 1.6C31.78 1.17 30.8 1 30 1Z';
const MENSCH_LINIEN = 'M22.4 21.6Q25.8 25.6 29.6 23.8M37.6 21.6Q34.2 25.6 30.4 23.8M18.4 17.8Q19.6 21 21.4 23.2M41.6 17.8Q40.4 21 38.6 23.2M30 16L30 23.6M30 26L30 45M26.6 29.2Q30 30.2 33.4 29.2M26.4 33.4Q30 34.4 33.6 33.4M26.4 37.6Q30 38.6 33.6 37.6M23 30Q24.4 36 26 44M37 30Q35.6 36 34 44M23.4 44.6Q26.8 48.6 29.8 50.4M36.6 44.6Q33.2 48.6 30.2 50.4M22.6 53.6Q25.2 61 26.4 67.6M37.4 53.6Q34.8 61 33.6 67.6M21.4 57.6Q22.6 63.4 23.4 67.8M38.6 57.6Q37.4 63.4 36.6 67.8M24.2 76L24.9 93.4M35.8 76L35.1 93.4M11.4 33.6L7.8 39.4M48.6 33.6L52.2 39.4';
const MENSCH_FLECKEN = 'M22.4 71.2a2.2 2.7 0 1 1 4.4 0a2.2 2.7 0 1 1 -4.4 0ZM33.2 71.2a2.2 2.7 0 1 1 4.4 0a2.2 2.7 0 1 1 -4.4 0Z';
// 160: Plastik über ein seitliches Licht (hell links, Schatten rechts) zusätzlich zum Verlauf oben → unten
const MENSCH = html`<defs><linearGradient id="mensch-farbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D65A4E"/><stop offset="1" stop-color="#A0302C"/></linearGradient>
    <linearGradient id="mensch-licht" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
  <path d=${MENSCH_UMRISS} fill="url(#mensch-farbe)"/><path d=${MENSCH_UMRISS} fill="url(#mensch-licht)"/><path d=${MENSCH_FLECKEN} fill="#F2D4CA" opacity=".6"/>
  <path d=${MENSCH_LINIEN} fill="none" stroke="#F6DDD5" stroke-width=".55" stroke-linecap="round" opacity=".8"/>`;

function Stapel({ volumen }) {
  const H = 170, m = stapelMasse(volumen, H);
  // Der Mensch startet so groß wie die Szene und schrumpft auf seinen Maßstab, während der Turm wächst
  const start = Math.min(4, (H * 0.92) / m.mensch);
  return html`<div class="ak-stapel">
    <div class="st-szene" style=${`height:${H + 14}px`}>
      <div class="st-boden" aria-hidden="true"></div>
      ${Array.from({ length: m.stapel }, (_, i) => html`<div key=${i} class="st-saeule" style=${`--b:${Math.max(6, m.breite).toFixed(1)}px;--d:${(0.3 + i * 0.18).toFixed(2)}s`}>
        <div class="st-turm" style=${`height:${m.turm}px;--scheibe:${Math.max(1.2, m.scheibe).toFixed(2)}px`}><i class="st-deckel"></i></div><i class="st-schatten"></i></div>`)}
      <div class="st-saeule mensch"><svg class="st-mensch" viewBox="0 0 60 100" style=${`height:${m.mensch}px;--start:${start.toFixed(3)}`}>${MENSCH}</svg><i class="st-schatten"></i></div>
    </div>
    <p class="st-text">${stapelText(m)}</p>
  </div>`;
}

/** Sätze in Reihenfolge, gleiche kg × Wdh hintereinander zusammengefasst: [{ kg, wdh, n }]. */
function folgeAus(saetze) {
  const f = [];
  for (const s of saetze) {
    const g = f.at(-1);
    if (g && g.kg === s.kg && g.wdh === s.wdh) g.n++; else f.push({ kg: s.kg ?? null, wdh: s.wdh ?? null, n: 1 });
  }
  return f;
}
const folgeText = (folge) => folge.map((g) => `${g.n > 1 ? `${g.n} × ` : ''}${g.kg != null ? gw(g.kg) : '–'} × ${g.wdh ?? '–'}`).join(' · ');

/** Zusammenfassung aus dem gerade beendeten Training (nur abgehakte Sätze). */
export function abschlussAus(t, ende = Date.now()) {
  const karten = t.karten.filter((k) => k.key && k.gruppen.some((g) => g.saetze.some((s) => s.erledigt)));
  const erledigt = (k) => k.gruppen.flatMap((g) => g.saetze.filter((s) => s.erledigt));
  const saetze = karten.flatMap(erledigt);
  return {
    titel: t.titel, datum: t.datum, minuten: Math.max(1, Math.round((ende - t.start) / 60000)),
    saetze: saetze.length, uebungen: karten.length, volumen: saetze.reduce((a, s) => a + (s.kg || 0) * (s.wdh || 0), 0),
    prs: karten.flatMap((k) => erledigt(k).filter((s) => s.pr).map((s) => ({ key: k.key, kg: s.kg, wdh: s.wdh, e1rm: s.e1rm }))),
    liste: karten.map((k) => ({ key: k.key, pr: erledigt(k).some((s) => s.pr), folge: folgeAus(erledigt(k)) })),
  };
}

// Motivation nach dem Training (02.11.): Überschrift je Anlass und bis zu drei kurze Rückmeldungen
const LOB = [['Stark gemacht', 'Good job'], ['Sauber abgeliefert', 'Well delivered'], ['Wieder ein Schritt nach vorn', 'Another step forward'],
  ['Training erledigt – stark', 'Workout done – strong'], ['Das war gute Arbeit', 'That was solid work'], ['Durchgezogen', 'You saw it through']];

/** m: { vorname, woche, ziel, serie, schnitt (Ø Volumen der letzten Trainings), erstes, blockFertig } – alles optional. */
export function motivationAus(a, m = {}) {
  const en = sprache() === 'en';
  const name = m.vorname ? `, ${m.vorname}` : '';
  const lob = LOB[(a.minuten + a.saetze + Number(String(a.datum).slice(-2))) % LOB.length][en ? 1 : 0];
  const titel = m.blockFertig ? deEn(`Block geschafft${name}!`, `Block complete${name}!`)
    : a.prs.length ? deEn(`Rekordtag${name}!`, `PR day${name}!`)
    : m.erstes ? deEn(`Erstes Training im Log${name}!`, `First workout logged${name}!`)
    : m.abzeichen?.length ? deEn(`Neues Abzeichen${name}!`, `New badge${name}!`)
    : m.ziel && m.woche === m.ziel ? deEn(`Wochenziel geschafft${name}!`, `Weekly goal reached${name}!`)
    : `${lob}${name}!`;
  const zeilen = [];
  if (m.abzeichen?.length) zeilen.push(deEn(`Neues Abzeichen: ${m.abzeichen.map((x) => `${x.icon} ${x.text[0]}`).join(', ')}`, `New badge: ${m.abzeichen.map((x) => `${x.icon} ${x.text[1]}`).join(', ')}`));
  if (m.blockFertig) zeilen.push(deEn('Alle Trainings des Blocks erledigt – Zeit für den Test oder den nächsten Block.', 'Every workout of the block done – time to test or start the next block.'));
  if (a.prs.length) zeilen.push(deEn(`${a.prs.length === 1 ? 'Ein neuer Rekord' : `${a.prs.length} neue Rekorde`} – das Training zahlt sich aus.`, `${a.prs.length === 1 ? 'A new PR' : `${a.prs.length} new PRs`} – the work is paying off.`));
  if (m.ziel && m.woche != null) zeilen.push(m.woche >= m.ziel
    ? (m.woche === m.ziel ? deEn(`${m.woche} von ${m.ziel} Trainings diese Woche – Ziel erreicht.`, `${m.woche} of ${m.ziel} workouts this week – goal reached.`)
      : deEn(`Schon ${m.woche} Trainings diese Woche – über dem Ziel.`, `Already ${m.woche} workouts this week – above your goal.`))
    : deEn(`Training ${m.woche} von ${m.ziel} diese Woche – noch ${m.ziel - m.woche} bis zum Ziel.`, `Workout ${m.woche} of ${m.ziel} this week – ${m.ziel - m.woche} to go.`));
  if (m.serie >= 2) zeilen.push(deEn(`Serie: ${m.serie} Wochen in Folge.`, `Streak: ${m.serie} weeks in a row.`));
  if (m.schnitt > 0 && a.volumen > 0 && zeilen.length < 3) {
    const d = (a.volumen / m.schnitt - 1) * 100;
    zeilen.push(d >= 5 ? deEn(`Volumen ${fmt(d, 0)} % über deinem Schnitt.`, `Volume ${fmt(d, 0)} % above your average.`)
      : d <= -15 ? deEn('Leichter als sonst – Erholung gehört dazu.', 'Lighter than usual – recovery is part of it.')
      : deEn('Volumen im gewohnten Bereich – Konstanz macht stark.', 'Volume right where it usually is – consistency builds strength.'));
  }
  return { titel, zeilen: zeilen.slice(0, 3) };
}

export function Abschluss({ daten: a, zu }) {
  const mot = motivationAus(a, a.motivation);
  // kurz „Stark gemacht!“ groß zeigen, dann die Karte (Tippen überspringt)
  const [intro, setIntro] = useState('an');
  useEffect(() => {
    const t1 = setTimeout(() => setIntro('weg'), 1500), t2 = setTimeout(() => setIntro(null), 1850);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const [status, setStatus] = useState(null);
  const [mitSaetzen, setMitSaetzen] = useState(() => { try { return localStorage.getItem(MIT_SAETZEN) !== '0'; } catch { return true; } });
  const umschalten = () => { const neu = !mitSaetzen; setMitSaetzen(neu); try { localStorage.setItem(MIT_SAETZEN, neu ? '1' : '0'); } catch { /* egal */ } };
  const teilen = async () => {
    setStatus('…');
    try {
      const blob = await bildAus(a, mitSaetzen);
      const datei = new File([blob], `pr-hunter-${a.datum}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [datei] })) { await navigator.share({ files: [datei], title: 'PR Hunter' }); setStatus(null); return; }
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: datei.name });
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('Bild gespeichert');
    } catch (e) { setStatus(e?.name === 'AbortError' ? null : 'Teilen ging nicht – mach einfach einen Screenshot.'); }
  };
  return html`<div class="abschluss" role="dialog" aria-modal="true" aria-label="Training geschafft">
    ${intro ? html`<div class=${`ak-intro ${intro === 'weg' ? 'weg' : ''}`} onClick=${() => setIntro(null)}>
      <div class="ak-intro-haken">${I.check}</div><b>${mot.titel}</b>${mot.zeilen[0] ? html`<span>${mot.zeilen[0]}</span>` : null}</div>` : null}
    <article class=${`abschluss-karte ${a.prs.length ? 'mit-pr' : ''}`}>
      <div class="ak-kopf"><span class="ak-logo">PR <b>Hunter</b></span><span class="muted">${datumLang(a.datum)}</span></div>
      <div class="ak-lob"><b>${mot.titel}</b>${mot.zeilen.map((z, i) => html`<span key=${i}>${z}</span>`)}</div>
      <div><div class="eyebrow ak-geschafft">Training geschafft</div><h2 class="ak-titel">${a.titel}</h2></div>
      <div class="ak-zahlen">
        <div><span class="eyebrow">Dauer</span><b>${minutenText(a.minuten)}</b></div>
        <div><span class="eyebrow">Volumen</span><b>${tonnage(a.volumen)}</b></div>
        <div><span class="eyebrow">Sätze</span><b>${a.saetze}</b></div>
        <div><span class="eyebrow">Übungen</span><b>${a.uebungen}</b></div>
      </div>
      <${Stapel} volumen=${a.volumen}/>
      ${a.prs.length ? html`<div class="ak-prs"><span class="medaille">PR</span><div><b>${a.prs.length === 1 ? '1 neuer Rekord' : `${a.prs.length} neue Rekorde`}</b>
        <div class="ak-pr-liste">${a.prs.map((p, i) => html`<span key=${i}>${nameVon(p.key)} · ${gwE(p.kg)} × ${p.wdh}</span>`)}</div></div></div>` : null}
      <div class="row between"><span class="eyebrow">Training</span>
        <button class="chip ak-schalter" aria-pressed=${String(mitSaetzen)} onClick=${umschalten}>${mitSaetzen ? 'Sätze ausblenden' : 'Sätze zeigen'}</button></div>
      <ul class=${`ak-liste ${mitSaetzen ? 'mit-saetzen' : ''}`}>${a.liste.map((u, i) => html`<li key=${i}>
        <span class="ak-name">${nameVon(u.key)}${u.pr ? html` <span class="tag gold">PR</span>` : null}</span>
        ${mitSaetzen ? html`<span class="ak-saetze">${folgeText(u.folge)}</span>` : html`<span class="muted ak-anzahl">${u.folge.reduce((n, g) => n + g.n, 0)} ×</span>`}</li>`)}</ul>
    </article>
    ${status ? html`<p class="muted" style="margin:0;text-align:center">${status}</p>` : null}
    <div class="row ak-knoepfe"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Fertig</button>
      <button class="btn btn-chalk" style="flex:1.4" onClick=${teilen}>${I.teilen} Teilen</button></div>
  </div>`;
}

/** Dieselbe Karte als PNG (Hochformat 4:5, passt in Story und Chat). Farben aus dem aktuellen Design. */
async function bildAus(a, mitSaetzen) {
  // 176: Höhe wächst mit der Zahl der Übungen, damit nichts als „+ n weitere“ abgeschnitten wird (mindestens 4:5)
  const B = 1080, H = Math.max(1350, 800 + (a.prs.length ? 70 : 0) + a.liste.length * (mitSaetzen ? 96 : 62) + 130);
  const c = Object.assign(document.createElement('canvas'), { width: B, height: H });
  const titel = sprache() === 'en' ? uebersetze(a.titel) ?? a.titel : a.titel;   // „Woche 4 · …“ stand im englischen Bild deutsch
  const x = c.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const farbe = (n, ersatz) => css.getPropertyValue(n).trim() || ersatz;
  const acc = farbe('--acc', '#D7263D'), ink = farbe('--ink', '#F4F2EE'), muted = farbe('--muted', '#9AA1AB'), gold = farbe('--gold', '#F2C14E');
  const schrift = farbe('--f', 'sans-serif');
  try { await document.fonts?.ready; } catch { /* egal */ }
  x.fillStyle = '#0B0B0F'; x.fillRect(0, 0, B, H);
  const glanz = x.createRadialGradient(B * 0.2, 0, 0, B * 0.2, 0, B * 1.1);
  glanz.addColorStop(0, acc); glanz.addColorStop(1, 'transparent');
  x.globalAlpha = 0.55; x.fillStyle = glanz; x.fillRect(0, 0, B, H); x.globalAlpha = 1;
  const text = (t, px, py, { groesse = 40, gewicht = 800, f = ink, align = 'left' } = {}) => {
    x.font = `${gewicht} ${groesse}px ${schrift}`; x.fillStyle = f; x.textAlign = align; x.fillText(t, px, py);
  };
  const kuerze = (t, breite) => { let s = t; while (x.measureText(s).width > breite && s.length > 4) s = s.slice(0, -2) + '…'; return s; };
  // 176: erst die Schrift verkleinern (bis 60 %), erst dann kürzen – „1 h 4…“ war abgeschnitten
  const passend = (t, breite, groesse, gewicht) => { let g = groesse; x.font = `${gewicht} ${g}px ${schrift}`;
    while (x.measureText(t).width > breite && g > groesse * 0.6) { g -= 2; x.font = `${gewicht} ${g}px ${schrift}`; }
    return { t: kuerze(t, breite), g }; };
  text('PR', 80, 120, { groesse: 50, gewicht: 900 }); x.font = `900 50px ${schrift}`;
  text('HUNTER', 80 + x.measureText('PR ').width, 120, { groesse: 50, gewicht: 900, f: acc });
  text(datumLang(a.datum), B - 80, 120, { groesse: 32, gewicht: 600, f: muted, align: 'right' });
  text(deEn('TRAINING GESCHAFFT', 'WORKOUT DONE'), 80, 215, { groesse: 32, gewicht: 800, f: acc });
  const ti = passend(titel.toUpperCase(), B - 160, 66, 900);
  text(ti.t, 80, 290, { groesse: ti.g, gewicht: 900 });
  const kacheln = [[deEn('DAUER', 'DURATION'), minutenText(a.minuten)], [deEn('VOLUMEN', 'VOLUME'), tonnage(a.volumen)], [deEn('SÄTZE', 'SETS'), String(a.saetze)], [deEn('ÜBUNGEN', 'EXERCISES'), String(a.uebungen)]];
  kacheln.forEach(([k, v], i) => {
    const kx = 80 + i * 235, ky = 340;
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.beginPath(); x.roundRect?.(kx, ky, 215, 150, 26); x.fill();
    text(k, kx + 24, ky + 50, { groesse: 24, gewicht: 700, f: muted });
    const w = passend(v, 175, 50, 900);
    text(w.t, kx + 24, ky + 118, { groesse: w.g, gewicht: 900 });
  });
  // Turm aus 25-kg-Scheiben neben einem Menschen, rechts der Text
  const m = stapelMasse(a.volumen, 200), boden = 730;
  const sb = Math.max(4, m.breite), luecke = Math.max(4, sb * 0.25);
  const sch = Math.max(1.5, m.scheibe);
  const breiteAlle = m.stapel * sb + (m.stapel - 1) * luecke;
  const links = Math.max(90, 160 - breiteAlle / 2);
  for (let k = 0; k < m.stapel; k++) {
    const sx = links + k * (sb + luecke);
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.ellipse(sx + sb / 2 + 4, boden + 2, sb * 0.7, Math.max(3, sb * 0.12), 0, 0, Math.PI * 2); x.fill();
    const seite = x.createLinearGradient(sx, 0, sx + sb, 0);
    seite.addColorStop(0, '#F0485C'); seite.addColorStop(0.35, '#D7263D'); seite.addColorStop(1, '#6E0D1B');
    for (let h = 0; h < m.turm; h += sch) {
      x.fillStyle = seite; x.fillRect(sx, boden - Math.min(m.turm, h + sch), sb, Math.min(sch, m.turm - h) - (sch > 4 ? 1.5 : 0));
    }
    x.fillStyle = '#FF6B7D'; x.beginPath(); x.ellipse(sx + sb / 2, boden - m.turm, sb / 2, Math.max(1.5, sb * 0.1), 0, 0, Math.PI * 2); x.fill();
  }
  const sx = links + breiteAlle - sb;
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.ellipse(sx + sb + Math.max(12, m.mensch * 0.15) + m.mensch * 0.3, boden + 2, m.mensch * 0.28, Math.max(3, m.mensch * 0.04), 0, 0, Math.PI * 2); x.fill();
  x.save(); x.translate(sx + sb + Math.max(12, m.mensch * 0.15), boden - m.mensch); x.scale(m.mensch / 100, m.mensch / 100);
  const haut = x.createLinearGradient(0, 0, 0, 100); haut.addColorStop(0, '#D65A4E'); haut.addColorStop(1, '#A0302C');
  x.fillStyle = haut; x.fill(new Path2D(MENSCH_UMRISS));
  x.globalAlpha = 0.6; x.fillStyle = '#F2D4CA'; x.fill(new Path2D(MENSCH_FLECKEN));
  x.globalAlpha = 0.8; x.strokeStyle = '#F6DDD5'; x.lineWidth = 0.55; x.lineCap = 'round'; x.stroke(new Path2D(MENSCH_LINIEN)); x.restore();
  x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(80, boden, B - 160, 3);
  x.font = `700 30px ${schrift}`;
  const zeilen = stapelText(m).split(': ');
  const tx = Math.max(330, Math.round(sx + sb + Math.max(12, m.mensch * 0.15) + m.mensch * 0.62 + 30));
  const z0 = passend(zeilen[0], B - 80 - tx, 30, 800), z1 = passend(zeilen[1] ?? '', B - 80 - tx, 30, 600);
  text(z0.t, tx, 610, { groesse: z0.g, gewicht: 800 });
  text(z1.t, tx, 655, { groesse: z1.g, gewicht: 600, f: muted });
  let y = 800;
  if (a.prs.length) {
    text(`★ ${a.prs.length === 1 ? deEn('1 NEUER REKORD', '1 NEW PR') : `${a.prs.length} ${deEn('NEUE REKORDE', 'NEW PRS')}`}`, 80, y, { groesse: 40, gewicht: 900, f: gold });
    y += 70;
  }
  // Übungen: mit Sätzen zwei Zeilen je Übung, sonst eine; was nicht passt, als „+ n weitere“
  const zeile = mitSaetzen ? 96 : 62;
  const zeigen = a.liste;
  for (const u of zeigen) {
    const n = passend(nameVon(u.key), mitSaetzen ? B - 160 : 700, 38, 700);
    text(n.t, 80, y, { groesse: n.g, gewicht: 700, f: u.pr ? gold : ink });
    if (mitSaetzen) {
      const s = passend(`${folgeText(u.folge)} ${einheit()}`, B - 160, 32, 600);
      text(s.t, 80, y + 42, { groesse: s.g, gewicht: 600, f: u.pr ? gold : muted });
    } else {
      text(`${u.folge.reduce((n, g) => n + g.n, 0)} ${deEn('Sätze', 'sets')}`, B - 80, y, { groesse: 34, gewicht: 700, f: muted, align: 'right' });
    }
    y += zeile;
  }
  text('PR HUNTER', B / 2, H - 60, { groesse: 26, gewicht: 600, f: muted, align: 'center' });
  return new Promise((ok, fehler) => c.toBlob((b) => (b ? ok(b) : fehler(new Error('Bild ging nicht'))), 'image/png'));
}
