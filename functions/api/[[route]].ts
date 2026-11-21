import { Hono } from 'hono';
import { constantTimeEqual, issueAdminSession, verifyAdminSession, getVotingStatus } from './auth';
import { validateSubmission, normalizedFullName } from './votes';
import { VoteRequest } from './types';

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

async function submitVote(c: any, channel: 'qr' | 'tablet') {
  const body = await c.req.json<VoteRequest>().catch(() => null);
  if (!body) return json({ error: 'VALIDATION_ERROR', message: 'بيانات التصويت غير صالحة' }, 422);
  const invalid = validateSubmission(body);
  if (invalid.error) return json(invalid, 422);
  const status = await getVotingStatus(c.env.DB);
  if (status.state === 'closed') return json({ error: 'VOTING_CLOSED', message: 'التصويت مغلق حالياً' }, 403);
  if (status.state === 'not_started') return json({ error: 'VOTING_NOT_STARTED', message: 'لم يبدأ التصويت بعد' }, 403);

  const existing = await c.env.DB.prepare('SELECT id FROM voters WHERE request_id = ?').bind(body.requestId).first<{ id: string }>();
  if (existing) return json({ error: 'ALREADY_SAVED', message: 'تم حفظ التصويت مسبقاً' }, 200);

  for (const selection of body.selections) {
    const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ? AND section_id = ? AND is_active = 1').bind(selection.projectId, selection.sectionId).first<{ id: number }>();
    if (!project) return json({ error: 'VALIDATION_ERROR', message: 'المشروع غير صالح أو غير نشط لهذه الفئة' }, 422);
  }

  const normalized = normalizedFullName(body.name);
  const duplicate = await c.env.DB.prepare('SELECT id FROM voters WHERE normalized_name = ? AND voided = 0').bind(normalized).first<{ id: string }>();
  if (duplicate && body.confirmDuplicate !== true) return json({ error: 'DUPLICATE_NAME', message: 'هذا الاسم سبق أن صوّت. إذا كنت شخصاً مختلفاً بنفس الاسم يمكنك المتابعة' }, 409);

  const id = crypto.randomUUID();
  const fullName = [body.name.first, body.name.father, body.name.grandfather, body.name.family].join(' ');
  const statements = [
    c.env.DB.prepare('INSERT INTO voters(id,request_id,first_name,father_name,grandfather_name,family_name,full_name,normalized_name,channel,is_duplicate) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, body.requestId, body.name.first, body.name.father, body.name.grandfather, body.name.family, fullName, normalized, channel, duplicate ? 1 : 0),
    ...body.selections.map((selection: { sectionId: number; projectId: number }) => c.env.DB.prepare('INSERT INTO votes(voter_id,section_id,project_id) VALUES (?,?,?)').bind(id, selection.sectionId, selection.projectId)),
  ];
  await c.env.DB.batch(statements);
  return json({ error: 'OK', message: 'تم تسجيل صوتك' }, 201);
}

app.post('/api/votes', (c) => submitVote(c, 'qr'));
app.post('/api/kiosk/votes', async (c) => {
  if (!await verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? '')) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  return submitVote(c, 'tablet');
});

app.notFound((c) => json({ error: 'NOT_FOUND', message: 'المسار غير موجود' }, 404));
export const onRequest: PagesFunction<Bindings> = (context) => app.fetch(context.request, context.env, context);
