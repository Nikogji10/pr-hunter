// PR Hunter · Benachrichtigungen auf dem Handy, solange ein Training läuft.
// Grenzen einer PWA: Benachrichtigungen lassen sich nicht sekündlich aktualisieren (kein Live-Timer in der Leiste),
// und im Hintergrund drosseln Android und iOS die Zeitgeber. Deshalb zählt die Pause in Schritten von ein paar Sekunden
// herunter, solange das Handy den Zeitgeber laufen lässt; der Ton am Pausenende kommt ebenso (Android meist pünktlich,
// iPhone oft erst beim Öffnen). Ohne Service Worker (z. B. http im Test) bleibt alles aus.
import { deEn } from './basis.js';

export const TAG_TRAINING = 'prh-training';
export const TAG_PAUSE = 'prh-pause';
export const moeglich = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const erlaubt = () => moeglich() && Notification.permission === 'granted';

/** Erlaubnis anfragen (nur nach einem Tippen erlaubt); true = erteilt. */
export async function erlaubnisHolen() {
  if (!moeglich()) return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

async function anmeldung() {
  try { return (await navigator.serviceWorker.getRegistration()) ?? null; } catch { return null; }
}

/** Benachrichtigung zeigen oder ersetzen (gleicher tag); laut = Ton und Vibration des Systems. */
// Ohne `icon`: Android zeigt es sonst rechts als großes Bild zusätzlich zum App-Symbol (Wunsch 67)
export async function zeige(tag, titel, text, { laut = false, zeit = Date.now(), bleibt = false } = {}) {
  if (!erlaubt()) return;
  const r = await anmeldung();
  if (!r) return;
  try {
    await r.showNotification(titel, { body: text, tag, renotify: laut, silent: !laut, timestamp: zeit, requireInteraction: bleibt,
      badge: 'icons/badge-96.png', vibrate: laut ? [180, 80, 180] : undefined, data: { url: location.href } });
  } catch { /* Gerät erlaubt es gerade nicht */ }
}

export async function schliesse(...tags) {
  const r = await anmeldung();
  if (!r?.getNotifications) return;
  try { for (const tag of tags) for (const n of await r.getNotifications({ tag })) n.close(); } catch { /* egal */ }
}


const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dauerText = (ms) => { const m = Math.floor(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };

/** Text der Trainings-Benachrichtigung: das Wichtigste im (fett und größer gezeigten) Titel – laufende Pause als
 *  Countdown, sonst die Trainingszeit; darunter Sätze und der nächste Satz. Wird im Hintergrund alle paar Sekunden neu
 *  gezeigt (sekündlich lässt Android eine Web-App nicht zählen). */
export function trainingsText(training, { fertig, gesamt, timer = null, jetzt = Date.now() }) {
  const pause = timer && timer.ende > jetzt;
  const titel = pause
    ? `${deEn('Pause', 'Rest')} ${mmss((timer.ende - jetzt) / 1000)} · ${deEn('Training', 'Workout')} ${dauerText(jetzt - training.start)}`
    : `${deEn('Training', 'Workout')} ${dauerText(jetzt - training.start)}`;
  const text = `${fertig}/${gesamt} ${deEn('Sätze', 'sets')}${pause ? ` · ${deEn('nächster', 'next')}: ${timer.naechster}` : ''}`;
  return { titel, text };
}

export const pauseEndeText = (timer) => ({ titel: deEn('Pause vorbei – los!', 'Rest over – go!'), text: `${deEn('Nächster Satz', 'Next set')}: ${timer.naechster}` });
