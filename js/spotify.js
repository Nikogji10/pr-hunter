// PR Hunter · Spotify-Steuerung (Wunsch 267, 09.11.2026): Anmeldung per OAuth mit PKCE direkt im Browser (kein Server,
// kein Secret), Wiedergabe abfragen und steuern über die Spotify Web API. Die Schlüssel bleiben nur auf diesem Gerät
// (localStorage) – sie gehen nicht ins Konto.
// Spotify-Regeln (Stand Feb. 2026): Entwickler-App im Entwicklungsmodus, Besitzer braucht Premium, höchstens 5 Nutzer,
// jeder muss im Spotify-Dashboard (User Management) eingetragen sein. Steuern geht nur mit Premium.

/** Client-ID der Spotify-App (developer.spotify.com → Dashboard). Leer = in den Einstellungen eintragen. */
export const SPOTIFY_CLIENT_ID = '';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const K = 'prh-spotify', K_START = 'prh-spotify-start', K_ID = 'prh-spotify-id';
const lies = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const schreib = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } };

/** Rücksprung-Adresse – genau so in der Spotify-App unter „Redirect URIs“ eintragen. */
export const rueckAdresse = () => `${location.origin}${location.pathname}`;
export const clientId = () => lies(K_ID) || SPOTIFY_CLIENT_ID;
export const setzeClientId = (id) => schreib(K_ID, id?.trim() || null);
export const verbunden = () => !!lies(K)?.refresh;
export const trennen = () => schreib(K, null);

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const zufall = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** Zur Spotify-Anmeldung (die Seite verlässt die App kurz und kommt mit ?code=… zurück). */
export async function verbinden() {
  const id = clientId();
  if (!id) throw new Error('Client-ID fehlt.');
  const verifier = zufall(64), state = zufall(16);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  schreib(K_START, { verifier, state, id, ziel: location.hash });
  const q = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: rueckAdresse(), scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: challenge, state });
  location.assign(`https://accounts.spotify.com/authorize?${q}`);
}

async function tokenAnfrage(daten) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(daten) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || `Spotify ${r.status}`);
  return j;
}
const merke = (j, alt = {}) => { const t = { access: j.access_token, refresh: j.refresh_token || alt.refresh, ablauf: Date.now() + (j.expires_in ?? 3600) * 1000, id: alt.id }; schreib(K, t); return t; };

/**
 * Rückkehr von der Anmeldung: Code gegen Schlüssel tauschen. Läuft einmal beim Laden; die Adresse wird sofort bereinigt
 * (vor dem Verlauf der App). Rückgabe: null (kein Rücksprung), { ok: true } oder { fehler }.
 */
export function rueckkehr() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), fehler = q.get('error'), state = q.get('state');
  const start = lies(K_START);
  if ((!code && !fehler) || !start || state !== start.state) return Promise.resolve(null);
  history.replaceState(history.state, '', `${location.pathname}${start.ziel || location.hash}`);
  schreib(K_START, null);
  if (fehler) return Promise.resolve({ fehler: fehler === 'access_denied' ? 'abgelehnt' : fehler });
  return tokenAnfrage({ grant_type: 'authorization_code', code, redirect_uri: rueckAdresse(), client_id: start.id, code_verifier: start.verifier })
    .then((j) => { merke(j, { id: start.id }); return { ok: true }; }).catch((e) => ({ fehler: e.message }));
}

let erneuern = null;
async function zugang(neu = false) {
  const t = lies(K);
  if (!t?.refresh) throw new Error('nicht verbunden');
  if (!neu && t.access && t.ablauf > Date.now() + 30000) return t.access;
  erneuern ??= tokenAnfrage({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.id || clientId() })
    .then((j) => merke(j, t).access)
    .catch((e) => { if (/invalid_grant|revoked/i.test(e.message)) trennen(); throw e; })
    .finally(() => { erneuern = null; });
  return erneuern;
}

async function api(method, pfad, body = null, nochmal = true) {
  const r = await fetch(`https://api.spotify.com/v1${pfad}`, { method, headers: { Authorization: `Bearer ${await zugang()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (r.status === 401 && nochmal) { await zugang(true); return api(method, pfad, body, false); }
  if (r.status === 204 || r.status === 202) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(j?.error?.message || `Spotify ${r.status}`); e.status = r.status; e.grund = j?.error?.reason; throw e; }
  return j;
}

/** Spotify-App öffnen, ohne die Wiedergabe zu ändern (ein Titel-Link würde den Titel neu starten). */
export const spotifyOeffnen = () => { location.href = 'spotify:'; };

/** Wiedergabe: null = kein aktives Gerät, sonst { spielt, titel, kuenstler, bild, dauer, position, zeit, geraet, link }. */
export async function wiedergabe() {
  const p = await api('GET', '/me/player?additional_types=episode');
  if (!p) return null;
  const it = p.item;
  return { spielt: !!p.is_playing, titel: it?.name ?? null, kuenstler: it ? (it.artists ?? []).map((a) => a.name).join(', ') || it.show?.name || '' : '',
    bild: (it?.album?.images ?? it?.images ?? []).at(-2)?.url ?? (it?.album?.images ?? it?.images ?? [])[0]?.url ?? null,
    dauer: it?.duration_ms ?? 0, position: p.progress_ms ?? 0, zeit: Date.now(), geraet: p.device?.name ?? null, link: it?.uri ?? null,
    shuffle: !!p.shuffle_state, wiederholen: p.repeat_state ?? 'off' };
}

/** Nächster Titel in der Warteschlange: { titel, kuenstler } oder null. */
export async function naechsterTitel() {
  const q = await api('GET', '/me/player/queue');
  const it = q?.queue?.[0];
  return it ? { titel: it.name, kuenstler: (it.artists ?? []).map((a) => a.name).join(', ') || it.show?.name || '' } : null;
}

/** Steuern: 'play' | 'pause' | 'next' | 'previous' | 'seek' (wert = Position in ms) | 'shuffle' (true/false) | 'repeat' ('off'|'context'|'track'). Ohne aktives Gerät startet 'play' auf dem zuletzt genutzten. */
export async function steuern(was, wert = null) {
  try {
    if (was === 'seek') return await api('PUT', `/me/player/seek?position_ms=${Math.max(0, Math.round(wert))}`);
    if (was === 'shuffle') return await api('PUT', `/me/player/shuffle?state=${wert ? 'true' : 'false'}`);
    if (was === 'repeat') return await api('PUT', `/me/player/repeat?state=${wert}`);
    if (was === 'play') return await api('PUT', '/me/player/play');
    if (was === 'pause') return await api('PUT', '/me/player/pause');
    return await api('POST', `/me/player/${was}`);
  } catch (e) {
    if (e.status !== 404 || was !== 'play') throw e;
    const g = (await api('GET', '/me/player/devices'))?.devices ?? [];
    const ziel = g.find((d) => d.type === 'Smartphone') ?? g[0];
    if (!ziel) { const f = new Error('kein Gerät'); f.status = 404; throw f; }
    return api('PUT', '/me/player', { device_ids: [ziel.id], play: true });
  }
}
