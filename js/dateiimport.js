// PR Hunter · Datei-Import für Ausdauer (Wunsch 224): GPX und TCX (Garmin Connect, Wahoo, Strava-Export).
// Liest die Punkte (Zeit, Position, Höhe, Puls, Trittfrequenz, Watt) per Regex – ohne DOM, damit testbar – und macht
// daraus eine Einheit im Format von public.ausdauer (quelle 'datei').
import { kurveAusReihe, gewichteteLeistung } from './ausdauer.js';

const zahlAus = (block, namen) => { for (const n of namen) { const m = block.match(new RegExp(`<(?:\\w+:)?${n}>\\s*([-\\d.]+)\\s*</(?:\\w+:)?${n}>`)); if (m) return Number(m[1]); } return null; };
const textAus = (block, n) => block.match(new RegExp(`<(?:\\w+:)?${n}>\\s*([^<]+?)\\s*</(?:\\w+:)?${n}>`))?.[1] ?? null;

/** Punkte aus GPX (<trkpt lat lon>) oder TCX (<Trackpoint> mit <Position>). */
export function punkte(xml) {
  const aus = [];
  const gpx = [...xml.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g)];
  if (gpx.length) {
    for (const [, attr, inhalt] of gpx) {
      aus.push({ t: Date.parse(textAus(inhalt, 'time') ?? ''), lat: Number(attr.match(/lat="([-\d.]+)"/)?.[1]), lon: Number(attr.match(/lon="([-\d.]+)"/)?.[1]),
        ele: zahlAus(inhalt, ['ele']), hr: zahlAus(inhalt, ['hr', 'HeartRate']), cad: zahlAus(inhalt, ['cad', 'cadence']), w: zahlAus(inhalt, ['power', 'PowerInWatts', 'Watts']) });
    }
    return aus.filter((p) => Number.isFinite(p.t));
  }
  for (const [, inhalt] of xml.matchAll(/<Trackpoint>([\s\S]*?)<\/Trackpoint>/g)) {
    aus.push({ t: Date.parse(textAus(inhalt, 'Time') ?? ''), lat: zahlAus(inhalt, ['LatitudeDegrees']), lon: zahlAus(inhalt, ['LongitudeDegrees']),
      ele: zahlAus(inhalt, ['AltitudeMeters']), dist: zahlAus(inhalt, ['DistanceMeters']), hr: zahlAus(inhalt.replace(/<\/?HeartRateBpm>/g, ''), ['Value']),
      cad: zahlAus(inhalt, ['Cadence', 'RunCadence']), w: zahlAus(inhalt, ['Watts']) });
  }
  return aus.filter((p) => Number.isFinite(p.t));
}

const RAD = Math.PI / 180;
export function abstand(a, b) {
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return 0;
  const d = Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(d));
}

/** Sportart aus der Datei (GPX <type>, TCX Sport="Running|Biking") oder aus dem Tempo. */
export function sportAus(xml, kmh) {
  const typ = (xml.match(/<type>\s*([^<]+)<\/type>/)?.[1] ?? xml.match(/Sport="([^"]+)"/)?.[1] ?? '').toLowerCase();
  if (/run|lauf|jog/.test(typ)) return /trail/.test(typ) ? 'trail' : 'lauf';
  if (/bik|cycl|ride|rad/.test(typ)) return /mountain|mtb/.test(typ) ? 'mtb' : /virtual|indoor/.test(typ) ? 'rolle' : 'rennrad';
  return kmh > 17 ? 'rennrad' : 'lauf';
}

/** Ganze Datei → Einheit (ohne id); null, wenn keine Punkte. Pausen (> 10 s ohne Bewegung) zählen nicht zur Bewegungszeit. */
export function einheitAusDatei(xml, name = '') {
  const p = punkte(xml);
  if (p.length < 2) return null;
  let m = 0, s = 0, hoch = 0, letzteHoehe = p[0].ele;
  const watt = [], puls = p[0].hr ? [p[0].hr] : [], kad = p[0].cad ? [p[0].cad] : [];
  for (let i = 1; i < p.length; i++) {
    const dt = (p[i].t - p[i - 1].t) / 1000;
    const dm = p[i].dist != null && p[i - 1].dist != null ? Math.max(0, p[i].dist - p[i - 1].dist) : abstand(p[i - 1], p[i]);
    if (dt > 0 && dt <= 10 && (dm / dt > 0.5 || p[i].w > 0)) s += dt;          // in Bewegung
    m += dm;
    if (p[i].ele != null && letzteHoehe != null) { const dh = p[i].ele - letzteHoehe; if (Math.abs(dh) >= 2) { if (dh > 0) hoch += dh; letzteHoehe = p[i].ele; } }
    else if (p[i].ele != null) letzteHoehe = p[i].ele;
    for (let k = 0; k < Math.min(Math.round(dt), 10); k++) watt.push(p[i].w ?? 0);
    if (p[i].hr) puls.push(p[i].hr);
    if (p[i].cad) kad.push(p[i].cad);
  }
  const mittel = (l) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null);
  const mitWatt = watt.some((x) => x > 0);
  const kmh = s ? (m / 1000) / (s / 3600) : 0;
  const art = sportAus(xml, kmh), lauf = ['lauf', 'trail'].includes(art);
  const start = new Date(p[0].t).toISOString();
  const titel = (xml.match(/<name>\s*([^<]+)<\/name>/)?.[1] ?? name.replace(/\.(gpx|tcx)$/i, '')).trim() || null;
  return {
    quelle: 'datei', extern_id: `${start}|${Math.round(m)}`, art, datum: start.slice(0, 10), start, titel, typ: null,
    dauer_s: Math.round(s || (p.at(-1).t - p[0].t) / 1000), distanz_m: Math.round(m), hoehe_m: Math.round(hoch),
    puls_avg: mittel(puls), puls_max: puls.length ? Math.max(...puls) : null,
    watt_avg: mitWatt ? mittel(watt.filter((x) => x > 0)) : null, watt_np: mitWatt ? gewichteteLeistung(watt) : null, watt_max: mitWatt ? Math.max(...watt) : null, watt_echt: mitWatt ? true : null,
    kadenz: kad.length ? mittel(kad) * (lauf && mittel(kad) < 120 ? 2 : 1) : null,
    details: mitWatt ? { kurve: kurveAusReihe(watt) } : null, geloescht: false,
  };
}
