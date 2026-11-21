import { Hono } from 'hono';
import { constantTimeEqual, issueAdminSession, verifyAdminSession, getVotingStatus } from './auth';
import { validateSubmission, normalizedFullName } from './votes';
import { VoteRequest } from './types';
import { getPublicBallot, publicResultsGate, withCacheHeaders } from './public';
import { validateSection, validateProjectUrl, validateImageUpload } from './admin-content';

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
app.get('/api/public/ballot', async (c) => json(await getPublicBallot(c.env.DB)));
app.get('/api/public/results', async (c) => {
  const published = await c.env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('results_published').first<{value:string}>();
  const gate = publicResultsGate(published?.value ?? '0');
  if (!gate.allowed) return json({ error: gate.code, message: 'النتائج غير منشورة بعد' }, 403);
  const ranking = await c.env.DB.prepare(`SELECT se.id AS section_id,se.name AS section_name,p.id AS project_id,p.name AS project_name,p.image_id,p.image_url,
    sc.name AS school_name, COUNT(v.id) AS votes
    FROM sections se JOIN projects p ON p.section_id=se.id JOIN schools sc ON sc.id=p.school_id
    LEFT JOIN votes v ON v.project_id=p.id AND v.voter_id IN (SELECT id FROM voters WHERE voided=0)
    WHERE se.is_active=1 AND p.is_active=1 GROUP BY se.id,p.id ORDER BY se.sort_order ASC,votes DESC,p.id ASC`).all();
  return new Response(JSON.stringify(ranking.results), { headers: withCacheHeaders() });
});

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

app.get('/api/images/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return json({ error: 'NOT_FOUND', message: 'الصورة غير موجودة' }, 404);
  const image = await c.env.DB.prepare('SELECT mime,data FROM images WHERE id=?').bind(id).first<{ mime: string; data: ArrayBuffer }>();
  if (!image) return json({ error: 'NOT_FOUND', message: 'الصورة غير موجودة' }, 404);
  return new Response(image.data, { headers: { 'content-type': image.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
});

app.post('/api/votes', (c) => submitVote(c, 'qr'));
app.post('/api/kiosk/votes', async (c) => {
  if (!await verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? '')) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  return submitVote(c, 'tablet');
});


async function requireAdmin(c: any) { return verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? ''); }

app.get('/api/admin/sections', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT * FROM sections ORDER BY sort_order ASC,id ASC').all()).results); });
app.post('/api/admin/sections', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{name:string;description?:string;sort_order?:number}>(); const check=validateSection(body.name); if(!check.valid) return json({error:'VALIDATION_ERROR',message:'اسم الفئة مطلوب'},422); await c.env.DB.prepare('INSERT INTO sections(name,description,sort_order) VALUES (?,?,?)').bind(check.value,body.description??null,body.sort_order??0).run(); return json({error:'OK',message:'تمت الإضافة'},201); });

app.get('/api/admin/schools', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT * FROM schools ORDER BY name').all()).results); });
app.post('/api/admin/schools', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{name:string}>(); if(!body.name?.trim()) return json({error:'VALIDATION_ERROR',message:'اسم المدرسة مطلوب'},422); await c.env.DB.prepare('INSERT INTO schools(name) VALUES (?)').bind(body.name.trim()).run(); return json({error:'OK',message:'تمت الإضافة'},201); });

app.get('/api/admin/projects', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT * FROM projects ORDER BY sort_order ASC,id ASC').all()).results); });
app.post('/api/admin/projects', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{name:string;description:string;section_id:number;school_id:number;url?:string;image_url?:string}>(); if(!body.name?.trim()||!body.description?.trim()||!validateProjectUrl(body.url??'')) return json({error:'VALIDATION_ERROR',message:'بيانات المشروع غير صالحة'},422); await c.env.DB.prepare('INSERT INTO projects(name,description,section_id,school_id,url,image_url) VALUES (?,?,?,?,?,?)').bind(body.name.trim(),body.description.trim(),body.section_id,body.school_id,body.url??null,body.image_url??null).run(); return json({error:'OK',message:'تمت الإضافة'},201); });

app.get('/api/admin/settings', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT key,value FROM settings').all()).results); });
app.put('/api/admin/settings', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<Record<string,string>>(); const entries=Object.entries(body); if(entries.length){ await c.env.DB.batch(entries.map(([key,value])=>c.env.DB.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,String(value)))); } return json({error:'OK',message:'تم حفظ الإعدادات'}); });

app.post('/api/admin/images', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const form=await c.req.formData(); const file=form.get('file'); if(!(file instanceof File)||!validateImageUpload(file.type,file.size)) return json({error:'VALIDATION_ERROR',message:'الصورة يجب أن تكون PNG أو JPEG أو WebP وبحد 300 KB'},422); const data=new Uint8Array(await file.arrayBuffer()); const result=await c.env.DB.prepare('INSERT INTO images(mime,data) VALUES (?,?)').bind(file.type,data).run(); return json({id:result.meta.last_row_id},201); });

app.notFound((c) => json({ error: 'NOT_FOUND', message: 'المسار غير موجود' }, 404));
export const onRequest: PagesFunction<Bindings> = (context) => app.fetch(context.request, context.env, context);
