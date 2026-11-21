import { Hono } from 'hono';
import { constantTimeEqual, issueAdminSession, verifyAdminSession, getVotingStatus } from './auth';

interface Bindings { DB: D1Database; ADMIN_PASSWORD: string; SESSION_SECRET: string }
const app = new Hono<{ Bindings: Bindings }>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

app.post('/api/admin/login', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const attempts = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE ip = ? AND attempted_at >= ?').bind(ip, cutoff).first<{ count: number }>();
  if ((attempts?.count ?? 0) >= 5) return json({ error: 'TOO_MANY_ATTEMPTS', message: 'تم تجاوز عدد محاولات الدخول' }, 429);

  const body = await c.req.json<{ password?: string }>().catch(() => ({}));
  if (!body.password || !constantTimeEqual(body.password, c.env.ADMIN_PASSWORD ?? '')) {
    await c.env.DB.prepare('INSERT INTO login_attempts(ip) VALUES (?)').bind(ip).run();
    return json({ error: 'INVALID_PASSWORD', message: 'كلمة المرور غير صحيحة' }, 401);
  }
  const token = await issueAdminSession(c.env.SESSION_SECRET ?? '');
  c.header('Set-Cookie', `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
  return json({ error: 'OK', message: 'تم تسجيل الدخول' });
});

app.post('/api/admin/logout', (c) => {
  c.header('Set-Cookie', 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  return json({ error: 'OK', message: 'تم تسجيل الخروج' });
});

app.get('/api/admin/me', async (c) => {
  const allowed = await verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? '');
  return allowed ? json({ authenticated: true }) : json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
});

app.get('/api/public/status', async (c) => json(await getVotingStatus(c.env.DB)));
app.notFound((c) => json({ error: 'NOT_FOUND', message: 'المسار غير موجود' }, 404));

export const onRequest: PagesFunction<Bindings> = (context) => app.fetch(context.request, context.env, context);
