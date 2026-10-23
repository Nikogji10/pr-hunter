// PR Hunter · Hintergrundbild zuschneiden: Rahmen im Seitenverhältnis des Bildschirms, Bild darin verschieben (ein Finger)
// und zoomen (zwei Finger oder Regler). „Übernehmen“ rechnet genau diesen Ausschnitt in ein JPEG in Bildschirmauflösung.
import { html, useState, useRef, Sheet } from './basis.js';

/** Datei → Bild-Element (zum Zuschneiden). */
export async function bildLaden(datei) {
  const url = URL.createObjectURL(datei);
  return new Promise((ok, fehler) => {
    const i = new Image();
    i.onload = () => ok({ img: i, url });
    i.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Das Bild lässt sich nicht lesen.')); };
    i.src = url;
  });
}

/** Ausschnitt (Bildkoordinaten) → JPEG, längste Seite höchstens 1600 px. */
function ausschnittAlsJpeg(img, { x, y, b, h }, max = 1600) {
  const ziel = Math.min(max, Math.round(Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2)));
  const f = Math.min(1, ziel / Math.max(b, h));
  const c = document.createElement('canvas');
  c.width = Math.round(b * f); c.height = Math.round(h * f);
  c.getContext('2d').drawImage(img, x, y, b, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

export function Zuschnitt({ quelle, uebernehmen, zu }) {
  const { img } = quelle, iw = img.naturalWidth, ih = img.naturalHeight;
  const fh = Math.round(Math.min(innerHeight * 0.52, 460)), fb = Math.round(fh * innerWidth / innerHeight);
  const basis = Math.max(fb / iw, fh / ih);                 // Zoom 1 = Bild füllt den Rahmen gerade
  const [z, setZ] = useState({ zoom: 1, cx: iw / 2, cy: ih / 2 });
  const finger = useRef(new Map()), abstand = useRef(0);
  const begrenzt = ({ zoom, cx, cy }) => {
    zoom = Math.min(4, Math.max(1, zoom));
    const s = basis * zoom, hx = fb / 2 / s, hy = fh / 2 / s;
    return { zoom, cx: Math.min(iw - hx, Math.max(hx, cx)), cy: Math.min(ih - hy, Math.max(hy, cy)) };
  };
  const s = basis * z.zoom;
  const runter = (e) => { e.currentTarget.setPointerCapture(e.pointerId); finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); abstand.current = 0; };
  const bewege = (e) => {
    const f = finger.current, alt = f.get(e.pointerId);
    if (!alt) return;
    f.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (f.size === 1) {
      setZ((v) => begrenzt({ ...v, cx: v.cx - (e.clientX - alt.x) / (basis * v.zoom), cy: v.cy - (e.clientY - alt.y) / (basis * v.zoom) }));
    } else if (f.size === 2) {
      const [a, b] = [...f.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (abstand.current) { const q = d / abstand.current; setZ((v) => begrenzt({ ...v, zoom: v.zoom * q })); }
      abstand.current = d;
    }
  };
  const hoch = (e) => { finger.current.delete(e.pointerId); abstand.current = 0; };
  const fertig = () => {
    const b = fb / s, h = fh / s;
    uebernehmen(ausschnittAlsJpeg(img, { x: z.cx - b / 2, y: z.cy - h / 2, b, h }));
  };
  return html`<${Sheet} zu=${zu} label="Hintergrund zuschneiden">
    <div><h2 class="h2" style="margin:0">Ausschnitt wählen</h2>
      <span class="muted" style="font-size:12.5px">Der Rahmen hat die Form deines Bildschirms. Verschieben mit einem Finger, zoomen mit zwei oder dem Regler.</span></div>
    <div class="zuschnitt" style=${`width:${fb}px;height:${fh}px`}
      onPointerDown=${runter} onPointerMove=${bewege} onPointerUp=${hoch} onPointerCancel=${hoch}>
      <img src=${quelle.url} alt="" style=${`width:${iw}px;height:${ih}px;transform:translate(${fb / 2 - z.cx * s}px, ${fh / 2 - z.cy * s}px) scale(${s})`}/>
    </div>
    <label class="regler-zeile" for="z-zoom"><span class="eyebrow">Zoom</span><b>${Math.round(z.zoom * 100)} %</b>
      <input id="z-zoom" class="regler" type="range" min="100" max="400" step="5" value=${Math.round(z.zoom * 100)} style="grid-column:1 / -1"
        onInput=${(e) => setZ((v) => begrenzt({ ...v, zoom: Number(e.currentTarget.value) / 100 }))}/></label>
    <div class="row" style="gap:8px">
      <button class="btn btn-soft" style="flex:1" onClick=${zu}>Abbrechen</button>
      <button class="btn btn-chalk" style="flex:2" onClick=${fertig}>Übernehmen</button>
    </div>
  <//>`;
}
