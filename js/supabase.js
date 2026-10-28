// PR Hunter · Supabase-Client. vendor/supabase.js (UMD, 2.117.3) muss vorher als normales <script> geladen sein.
// Der publishable key darf öffentlich sein: Zugriff regeln Anmeldung und Row Level Security.
export const SUPABASE_URL = 'https://ichfzfvtuzakujcbiuhf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_UKoGtr3NdzzDZTvOAEoDnA_bmfUnT3r';

let client = null;
export function supabase() {
  if (!client) {
    if (!globalThis.supabase?.createClient) throw new Error('vendor/supabase.js ist nicht geladen');
    client = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'prh-anmeldung' },
    });
  }
  return client;
}

/**
 * Anmeldung per Code aus der E-Mail (kein Link: auf dem iPhone hat die installierte App einen eigenen Speicher,
 * ein Link würde in Safari landen). Neue Konten legt Supabase dabei an, solange Registrierungen erlaubt sind.
 */
export async function codeSenden(email) {
  const { error } = await supabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw new Error(meldung(error));
}

export async function codePruefen(email, code) {
  const { data, error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ''), type: 'email' });
  if (error) throw new Error(meldung(error));
  return data.session;
}

/** E-Mail-Adresse ändern (Wunsch 125): Supabase schickt Bestätigungslinks (je nach Einstellung an alte und neue
 *  Adresse); bis zur Bestätigung bleibt die alte Adresse gültig. Der Link führt zurück in die App. */
export async function emailAendern(email) {
  const neu = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neu)) throw new Error('Das sieht nicht nach einer E-Mail-Adresse aus.');
  const { error } = await supabase().auth.updateUser({ email: neu }, { emailRedirectTo: location.origin + location.pathname });
  if (error) throw new Error(meldung(error));
}

export async function sitzung() {
  const { data } = await supabase().auth.getSession();
  return data.session ?? null;
}

export const abmelden = () => { try { localStorage.removeItem('prh-feed'); } catch { /* egal */ } return supabase().auth.signOut(); };

/** Fehlermeldungen von Supabase auf Deutsch, soweit bekannt. */
function meldung(e) {
  const m = e?.message ?? String(e);
  if (/rate limit|too many|security purposes/i.test(m)) return 'Zu viele Versuche. Bitte eine Minute warten und dann erneut senden.';
  if (/expired|invalid|otp/i.test(m)) return 'Der Code stimmt nicht oder ist abgelaufen. Neuen Code anfordern.';
  if (/signups not allowed/i.test(m)) return 'Für diese E-Mail gibt es kein Konto, und neue Registrierungen sind gesperrt.';
  if (/fetch|network/i.test(m)) return 'Keine Verbindung. Für die Anmeldung braucht das Handy einmal Netz.';
  return m;
}
