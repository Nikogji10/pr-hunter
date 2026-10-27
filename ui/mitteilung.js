// PR Hunter · Benachrichtigungen auf dem Handy, solange ein Training läuft und die App im Hintergrund ist.
// Grenzen einer PWA: Benachrichtigungen lassen sich nicht sekündlich aktualisieren (kein Live-Timer in der Leiste),
// und im Hintergrund drosseln Android und iOS die Zeitgeber. Deshalb steht in der Meldung die Uhrzeit, zu der die Pause
// endet; der Ton am Pausenende kommt, sobald das Handy den Zeitgeber laufen lässt (Android meist pünktlich, iPhone oft
// erst beim Öffnen). Ohne Service Worker (z. B. http im Test) bleibt alles aus.
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
export async function zeige(tag, titel, text, { laut = false, zeit = Date.now() } = {}) {
  if (!erlaubt()) return;
  const r = await anmeldung();
  if (!r) return;
  try {
    await r.showNotification(titel, { body: text, tag, renotify: laut, silent: !laut, timestamp: zeit, icon: 'icons/icon-192.png',
      badge: 'icons/favicon-32.png', vibrate: laut ? [180, 80, 180] : undefined, data: { url: location.href } });
  } catch { /* Gerät erlaubt es gerade nicht */ }
}

export async function schliesse(...tags) {
  const r = await anmeldung();
  if (!r?.getNotifications) return;
  try { for (const tag of tags) for (const n of await r.getNotifications({ tag })) n.close(); } catch { /* egal */ }
}

const uhrzeit = (ms) => new Date(ms).toLocaleTimeString(deEn('de-DE', 'en-GB'), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const uhrzeitKurz = (ms) => new Date(ms).toLocaleTimeString(deEn('de-DE', 'en-GB'), { hour: '2-digit', minute: '2-digit' });

/** Text der Trainings-Benachrichtigung: Titel, Beginn, erledigte Sätze, laufende Pause mit Endzeit. */
export function trainingsText(training, { fertig, gesamt, timer = null }) {
  const titel = `${deEn('Training läuft', 'Workout running')} · ${training.titel}`;
  const zeilen = [`${deEn('Seit', 'Since')} ${uhrzeitKurz(training.start)} · ${fertig}/${gesamt} ${deEn('Sätze', 'sets')}`];
  if (timer && timer.ende > Date.now()) zeilen.push(`${deEn('Pause bis', 'Rest until')} ${uhrzeit(timer.ende)} · ${deEn('nächster', 'next')}: ${timer.naechster}`);
  return { titel, text: zeilen.join('\n') };
}

export const pauseEndeText = (timer) => ({ titel: deEn('Pause vorbei – los!', 'Rest over – go!'), text: `${deEn('Nächster Satz', 'Next set')}: ${timer.naechster}` });
