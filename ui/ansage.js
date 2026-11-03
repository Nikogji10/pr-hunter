// PR Hunter · Sprachansagen in der Pause (Wunsch 193): „Noch 30 Sekunden“, am Ende „Nächster Satz: Bankdrücken,
// 120 Kilo, 5 Wiederholungen“ – über die Sprachausgabe des Handys (in die Kopfhörer). Nur bei offener App; im
// Hintergrund lassen die meisten Handys Web-Apps nicht sprechen.
import { useEffect, useRef, sprache, fmt, einheit } from './basis.js';

export const sprachausgabe = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function sag(text) {
  if (!sprachausgabe()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = sprache() === 'en' ? 'en-US' : 'de-DE'; u.rate = 1.05;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* Gerät spricht nicht */ }
}

const en = () => sprache() === 'en';
export function naechsterText(t) {
  if (!t?.naechsterUebung) return en() ? 'Rest over.' : 'Pause vorbei.';
  const last = t.naechsterKg > 0 ? `, ${fmt(t.naechsterKg)} ${einheit() === 'lb' ? (en() ? 'pounds' : 'Pfund') : (en() ? 'kilos' : 'Kilo')}` : '';
  const wdh = t.naechsterWdh > 0 ? `, ${t.naechsterWdh} ${en() ? 'reps' : 'Wiederholungen'}` : '';
  return `${en() ? 'Rest over. Next set' : 'Pause vorbei. Nächster Satz'}: ${t.naechsterUebung}${last}${wdh}.`;
}

/** Ansagen zum laufenden Pausen-Timer (an = Einstellung). */
export function useAnsagen(timer, an) {
  const gesagt = useRef({});
  useEffect(() => {
    if (!an || !timer || timer.fertig) return;
    const id = `${timer.ende}`;
    if (gesagt.current.id !== id) gesagt.current = { id };
    const iv = setInterval(() => {
      const rest = (timer.ende - Date.now()) / 1000;
      if (timer.dauer > 40 && rest <= 30 && rest > 25 && !gesagt.current.d30) { gesagt.current.d30 = true; sag(en() ? '30 seconds left.' : 'Noch 30 Sekunden.'); }
      if (rest <= 0 && !gesagt.current.ende) { gesagt.current.ende = true; sag(naechsterText(timer)); clearInterval(iv); }
    }, 400);
    return () => clearInterval(iv);
  }, [an, timer?.ende, timer?.fertig]);
}
