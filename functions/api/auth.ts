import { getSetting } from './db';

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSessionCookies(token: string) {
  return {
    login: `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
    logout: 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  };
}

export async function issueAdminSession(secret: string, now = Date.now()) {
  const payload = JSON.stringify({ exp: now + 12 * 60 * 60 * 1000 });
  const encoded = btoa(payload);
  const signature = await hmac(secret, encoded);
  return `${encoded}.${signature}`;
}

export async function verifyAdminSession(request: Request, secret: string, now = Date.now()) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;
  const [encoded, signature] = match[1].split('.');
  if (!encoded || !signature) return false;
  const expected = await hmac(secret, encoded);
  if (!constantTimeEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(atob(encoded)) as { exp: number };
    return typeof payload.exp === 'number' && payload.exp > now;
  } catch { return false; }
}

export async function getVotingStatus(db: D1Database, now = new Date()) {
  const mode = await getSetting(db, 'voting_mode', 'closed');
  if (mode === 'open') return { state: 'open' as const, opensAt: null, closesAt: null };
  if (mode === 'closed') return { state: 'closed' as const, opensAt: null, closesAt: null };
  const opensAt = await getSetting(db, 'voting_start');
  const closesAt = await getSetting(db, 'voting_end');
  const timestamp = now.getTime();
  if (!opensAt || timestamp < Date.parse(opensAt)) return { state: 'not_started' as const, opensAt, closesAt };
  if (!closesAt || timestamp > Date.parse(closesAt)) return { state: 'closed' as const, opensAt, closesAt };
  return { state: 'open' as const, opensAt, closesAt };
}
