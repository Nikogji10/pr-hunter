// PR Hunter · Satz-Video mit Hantelweg und Tempo (Wunsch 268). Rechenkern ohne Browser-Abhängigkeiten:
// 1. Scheibe verfolgen: Vorlagenvergleich (normierte Kreuzkorrelation) eines Ausschnitts um die angetippte Scheibenmitte,
//    Bild für Bild im Umkreis der letzten Position, grob (Schritt 2) und dann fein, Subpixel über eine Parabel.
// 2. Maßstab: Scheibendurchmesser (Standard 45 cm) ÷ angetippter Durchmesser in Pixeln.
// 3. Wiederholungen: Zickzack über die Höhe (Umkehrpunkte mit Mindesthub), konzentrisch = Tiefpunkt → Hochpunkt.
//    Tempo = mittlere konzentrische Geschwindigkeit (Hub ÷ Zeit), dazu Spitzentempo und Geschwindigkeitsverlust.
// 4. RPE-Abgleich: eigenes Profil je Lift (lineare Regression RPE ↔ Tempo der letzten Wiederholung).
// Richtwerte, kein Messgerät: Kamera schräg, Weitwinkel und Bewegungsunschärfe verfälschen die Werte.

export const SCHEIBE_M = 0.45;

/** Graustufen (Float32Array, Breite b, Höhe h) aus RGBA-Bilddaten. */
export function grau(rgba, b, h) {
  const g = new Float32Array(b * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}

/** Ausschnitt (Seitenlänge s, ungerade) um (cx, cy); null, wenn er aus dem Bild ragt. */
export function ausschnitt(bild, b, h, cx, cy, s) {
  const r = (s - 1) / 2, x0 = Math.round(cx) - r, y0 = Math.round(cy) - r;
  if (x0 < 0 || y0 < 0 || x0 + s > b || y0 + s > h) return null;
  const t = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) t[y * s + x] = bild[(y0 + y) * b + x0 + x];
  return t;
}

function normiert(t) {
  let m = 0; for (const v of t) m += v; m /= t.length;
  let q = 0; const n = new Float32Array(t.length);
  for (let i = 0; i < t.length; i++) { n[i] = t[i] - m; q += n[i] * n[i]; }
  return { n, norm: Math.sqrt(q) };
}

/** Normierte Kreuzkorrelation der Vorlage (normiert) an Position (cx, cy) – −1 … 1, null außerhalb. */
function ncc(bild, b, h, vorlage, s, cx, cy) {
  const r = (s - 1) / 2, x0 = cx - r, y0 = cy - r;
  if (x0 < 0 || y0 < 0 || x0 + s > b || y0 + s > h) return null;
  let summe = 0, q = 0, kreuz = 0;
  for (let y = 0; y < s; y++) { const z = (y0 + y) * b + x0; for (let x = 0; x < s; x++) summe += bild[z + x]; }
  const m = summe / (s * s);
  for (let y = 0; y < s; y++) {
    const z = (y0 + y) * b + x0, zt = y * s;
    for (let x = 0; x < s; x++) { const v = bild[z + x] - m; q += v * v; kreuz += v * vorlage.n[zt + x]; }
  }
  const nenner = Math.sqrt(q) * vorlage.norm;
  return nenner > 0 ? kreuz / nenner : 0;
}

/** Seitenlänge der Vorlage aus dem Scheibenradius in Pixeln: ungerade, 15–51. */
export const vorlagenGroesse = (radiusPx) => { const s = Math.max(15, Math.min(51, Math.round(radiusPx * 1.1))); return s % 2 ? s : s + 1; };

/**
 * Verfolger: start(bild, b, h, x, y, radiusPx) mit dem ersten Bild, dann schritt(bild) je weiteres Bild →
 * { x, y, guete } oder null (verloren). Vorlage = 70 % Original + 30 % letzter Treffer (Licht ändert sich, Drift bleibt klein).
 */
export function verfolger({ suchFaktor = 0.6, minGuete = 0.45 } = {}) {
  let b, h, s, roh, vorlage, x, y, such;
  return {
    start(bild, breite, hoehe, sx, sy, radiusPx) {
      b = breite; h = hoehe; s = vorlagenGroesse(radiusPx); x = sx; y = sy;
      such = Math.max(6, Math.round(radiusPx * suchFaktor));
      roh = ausschnitt(bild, b, h, sx, sy, s);
      if (!roh) return false;
      vorlage = normiert(roh);
      return true;
    },
    schritt(bild) {
      const bx = Math.round(x), by = Math.round(y);
      let best = -2, px = bx, py = by;
      for (let dy = -such; dy <= such; dy += 2) for (let dx = -such; dx <= such; dx += 2) {
        const v = ncc(bild, b, h, vorlage, s, bx + dx, by + dy);
        if (v != null && v > best) { best = v; px = bx + dx; py = by + dy; }
      }
      const fein = {};
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const v = ncc(bild, b, h, vorlage, s, px + dx, py + dy);
        fein[`${dx},${dy}`] = v;
        if (v != null && v > best) best = v;
      }
      let fx = px, fy = py;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (fein[`${dx},${dy}`] === best) { fx = px + dx; fy = py + dy; }
      if (best < minGuete) return null;
      // Subpixel: Parabel durch die Nachbarn
      const nb = (dx, dy) => ncc(bild, b, h, vorlage, s, fx + dx, fy + dy);
      const sub = (a, m, c) => (a == null || c == null || a - 2 * m + c >= 0 ? 0 : Math.max(-0.5, Math.min(0.5, (a - c) / (2 * (a - 2 * m + c)))));
      x = fx + sub(nb(-1, 0), best, nb(1, 0));
      y = fy + sub(nb(0, -1), best, nb(0, 1));
      const neu = ausschnitt(bild, b, h, fx, fy, s);
      if (neu && best > 0.7) { const t = new Float32Array(roh.length); for (let i = 0; i < t.length; i++) t[i] = 0.7 * roh[i] + 0.3 * neu[i]; vorlage = normiert(t); }
      return { x, y, guete: best };
    },
  };
}

/** Gleitender Mittelwert (Fenster ungerade) über Werte ohne Lücken. */
export function glaette(werte, fenster = 3) {
  const r = (fenster - 1) / 2;
  return werte.map((_, i) => { let s = 0, n = 0; for (let k = i - r; k <= i + r; k++) if (k >= 0 && k < werte.length) { s += werte[k]; n++; } return s / n; });
}

/** Umkehrpunkte mit Mindesthub h: [{ i, art: 'tief' | 'hoch' }] im Wechsel. */
export function umkehrpunkte(y, h) {
  const aus = [];
  let lo = 0, hi = 0, richtung = 0;              // 1 = steigt (sucht Hochpunkt), −1 = fällt (sucht Tiefpunkt)
  for (let i = 1; i < y.length; i++) {
    if (!richtung) {
      if (y[i] > y[hi]) hi = i;
      if (y[i] < y[lo]) lo = i;
      if (y[hi] - y[lo] >= h) {
        if (lo < hi) { aus.push({ i: lo, art: 'tief' }); richtung = 1; } else { aus.push({ i: hi, art: 'hoch' }); richtung = -1; }
      }
    } else if (richtung === 1) {
      if (y[i] > y[hi]) hi = i;
      else if (y[hi] - y[i] >= h) { aus.push({ i: hi, art: 'hoch' }); richtung = -1; lo = i; }
    } else if (y[i] < y[lo]) lo = i;
    else if (y[i] - y[lo] >= h) { aus.push({ i: lo, art: 'tief' }); richtung = 1; hi = i; }
  }
  if (richtung === 1) aus.push({ i: hi, art: 'hoch' });
  else if (richtung === -1) aus.push({ i: lo, art: 'tief' });
  return aus;
}

/**
 * Wiederholungen aus der Bahn. punkte [{ t (s), x, y (Pixel, y nach unten) }], mProPx = Meter je Pixel.
 * Rückgabe { wdh: [{ von, bis, hub (m), mcv (m/s), spitze (m/s) }], verlust (% vom besten zum letzten Tempo) | null }.
 */
export function wiederholungen(punkte, mProPx) {
  if (punkte.length < 5 || !(mProPx > 0)) return { wdh: [], verlust: null };
  const t = punkte.map((p) => p.t);
  const hoehe = glaette(punkte.map((p) => -p.y * mProPx), 3);
  const spanne = Math.max(...hoehe) - Math.min(...hoehe);
  const ump = umkehrpunkte(hoehe, Math.max(0.05, spanne * 0.25));
  const kandidaten = [];
  for (let k = 0; k + 1 < ump.length; k++) {
    if (ump[k].art !== 'tief' || ump[k + 1].art !== 'hoch') continue;
    // Start = letzter Punkt höchstens 1 cm über dem Tiefpunkt (Pause am Boden zählt nicht), Ende = erster Punkt
    // höchstens 1 cm unter dem Hochpunkt (Wackeln im Lockout zählt nicht)
    const tol = 0.01, ua = ump[k].i, ue = ump[k + 1].i;
    let a = ua, e = ue;
    for (let i = ua; i <= ue; i++) if (hoehe[i] <= hoehe[ua] + tol) a = i;
    for (let i = ue; i >= a; i--) if (hoehe[i] >= hoehe[ue] - tol) e = i;
    const hub = hoehe[ue] - hoehe[ua], dauer = t[e] - t[a];
    if (!(dauer > 0) || !(e > a)) continue;
    let spitze = 0;
    for (let i = a + 1; i <= e; i++) spitze = Math.max(spitze, (hoehe[i] - hoehe[i - 1]) / (t[i] - t[i - 1] || Infinity));
    kandidaten.push({ von: t[a], bis: t[e], hub, mcv: (hoehe[e] - hoehe[a]) / dauer, spitze, ia: a, ie: e });
  }
  const groesster = Math.max(0, ...kandidaten.map((w) => w.hub));
  const wdh = kandidaten.filter((w) => w.hub >= Math.max(0.1, groesster * 0.5))
    .map((w) => ({ ...w, mcv: Math.round(w.mcv * 100) / 100, spitze: Math.round(w.spitze * 100) / 100, hub: Math.round(w.hub * 100) / 100 }));
  const beste = Math.max(0, ...wdh.map((w) => w.mcv));
  const verlust = wdh.length >= 2 && beste > 0 ? Math.round(((beste - wdh.at(-1).mcv) / beste) * 100) : null;
  return { wdh, verlust };
}

/**
 * RPE aus dem Tempo der letzten Wiederholung über das eigene Profil (Paare { v, rpe } derselben Lift-Familie).
 * Mindestens 4 Paare mit Spanne (RPE ≥ 1, Tempo ≥ 0,05 m/s) und fallender Gerade (schneller = leichter), sonst null.
 * Rückgabe { rpe (auf 0,5), n } oder { rpe: null, n, fehlen }.
 */
export function rpeAusTempo(v, paare, { minimum = 4 } = {}) {
  const p = paare.filter((x) => x.v > 0 && x.rpe >= 5 && x.rpe <= 10);
  const n = p.length;
  if (!(v > 0) || n < minimum) return { rpe: null, n, fehlen: Math.max(0, minimum - n) };
  const mv = p.reduce((a, x) => a + x.v, 0) / n, mr = p.reduce((a, x) => a + x.rpe, 0) / n;
  let sxy = 0, sxx = 0;
  for (const x of p) { sxy += (x.v - mv) * (x.rpe - mr); sxx += (x.v - mv) ** 2; }
  const rpeSpanne = Math.max(...p.map((x) => x.rpe)) - Math.min(...p.map((x) => x.rpe));
  const vSpanne = Math.max(...p.map((x) => x.v)) - Math.min(...p.map((x) => x.v));
  if (rpeSpanne < 1 || vSpanne < 0.05 || !(sxx > 0) || sxy >= 0) return { rpe: null, n, fehlen: 0 };
  const steigung = sxy / sxx, wert = mr + steigung * (v - mv);
  return { rpe: Math.max(5, Math.min(10, Math.round(wert * 2) / 2)), n };
}

/** Hinweis-Schlüssel zum RPE-Abgleich: 'schwerer' (Tempo sagt mehr als eingetragen), 'leichter', 'passt' oder null. */
export function rpeVergleich(eingetragen, ausTempo) {
  if (eingetragen == null || ausTempo == null) return null;
  const d = ausTempo - eingetragen;
  return d >= 1 ? 'schwerer' : d <= -1 ? 'leichter' : 'passt';
}
