import { Hono } from 'hono';
import { buildSessionCookies, constantTimeEqual, issueAdminSession, verifyAdminSession, getVotingStatus } from './auth';
import { calculateProjectVotes, groupResultsBySection, VoteSource } from './vote-sources';
import { validateSubmission, normalizedFullName } from './votes';
import { VoteRequest } from './types';
import { getPublicBallot, publicResultsGate, withCacheHeaders } from './public';
import { normalizeProjectPatch, normalizeSectionPatch, validateSection, validateSchoolName, validateImageUpload } from './admin-content';
import { buildDeleteStatements, cascadePreview, DeleteData, DeleteKind, parseDeleteIds } from './admin-delete';
import { csvWithBom } from './admin-results';
import { displayImageUrl, imageResponseBody } from './db';

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
  const cookies = buildSessionCookies(token);
  return new Response(JSON.stringify({ error: 'OK', message: 'تم تسجيل الدخول' }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'Set-Cookie': cookies.login },
  });
});

app.post('/api/admin/logout', (c) => {
  const cookies = buildSessionCookies('');
  return new Response(JSON.stringify({ error: 'OK', message: 'تم تسجيل الخروج' }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'Set-Cookie': cookies.logout },
  });
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
  const sourceSetting = await c.env.DB.prepare('SELECT source FROM result_settings WHERE scope=?').bind('global').first<{ source: VoteSource }>();
  const source = sourceSetting?.source ?? 'digital';

  if (source === 'manual') {
    const winners = await c.env.DB.prepare(`SELECT se.id AS section_id,se.name AS section_name,p.id AS project_id,p.name AS project_name,
      p.image_url,p.image_id,sc.name AS school_name,0 AS votes
      FROM section_winners w JOIN sections se ON se.id=w.section_id
      JOIN projects p ON p.id=w.project_id JOIN schools sc ON sc.id=p.school_id
      WHERE se.is_active=1 AND p.is_active=1 ORDER BY se.sort_order ASC,se.id ASC`).all();
    const rows = (winners.results as Array<Record<string, any>>).map((row) => ({
      sectionId: row.section_id, sectionName: row.section_name, projectId: row.project_id,
      projectName: row.project_name, schoolName: row.school_name, imageUrl: displayImageUrl(row.image_url, row.image_id),
      votes: row.votes, announceInResults: 1,
    }));
    return new Response(JSON.stringify({ source, sections: groupResultsBySection(rows) }), { headers: withCacheHeaders() });
  }

  const ranking = await c.env.DB.prepare(`SELECT se.id AS section_id,se.name AS section_name,p.id AS project_id,p.name AS project_name,p.image_id,p.image_url,p.written_votes,p.announce_in_results,
    sc.name AS school_name, COUNT(v.id) AS digital_votes
    FROM sections se JOIN projects p ON p.section_id=se.id JOIN schools sc ON sc.id=p.school_id
    LEFT JOIN votes v ON v.project_id=p.id AND v.voter_id IN (SELECT id FROM voters WHERE voided=0)
    WHERE se.is_active=1 AND p.is_active=1 GROUP BY se.id,p.id ORDER BY se.sort_order ASC,p.id ASC`).all();
  const rows = (ranking.results as Array<Record<string, any>>).map((row) => ({
    sectionId: row.section_id, sectionName: row.section_name, projectId: row.project_id,
    projectName: row.project_name, schoolName: row.school_name, imageUrl: displayImageUrl(row.image_url, row.image_id),
    votes: calculateProjectVotes({ digitalVotes: row.digital_votes, writtenVotes: row.written_votes }, source),
    announceInResults: row.announce_in_results,
  }));
  return new Response(JSON.stringify({ source, sections: groupResultsBySection(rows) }), { headers: withCacheHeaders() });
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
  const image = await c.env.DB.prepare('SELECT mime,data FROM images WHERE id=?').bind(id).first<{ mime: string; data: unknown }>();
  if (!image) return json({ error: 'NOT_FOUND', message: 'الصورة غير موجودة' }, 404);
  return new Response(imageResponseBody(image.data), { headers: { 'content-type': image.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
});

app.post('/api/votes', (c) => submitVote(c, 'qr'));
app.post('/api/kiosk/votes', async (c) => {
  if (!await verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? '')) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  return submitVote(c, 'tablet');
});


async function requireAdmin(c: any) { return verifyAdminSession(c.req.raw, c.env.SESSION_SECRET ?? ''); }

app.get('/api/admin/sections', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT * FROM sections ORDER BY sort_order ASC,id ASC').all()).results); });
app.post('/api/admin/sections', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{name:string;description?:string;sort_order?:number}>(); const check=validateSection(body.name); if(!check.valid) return json({error:'VALIDATION_ERROR',message:'اسم الفئة مطلوب'},422); await c.env.DB.prepare('INSERT INTO sections(name,description,sort_order) VALUES (?,?,?)').bind(check.value,body.description??null,body.sort_order??0).run(); return json({error:'OK',message:'تمت الإضافة'},201); });
app.put('/api/admin/sections/:id', async (c) => {
  if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const patch = normalizeSectionPatch(body ?? {});
  if (!Number.isInteger(id) || !patch.valid || !Object.keys(patch.value).length) return json({error:'VALIDATION_ERROR',message:'بيانات القسم غير صالحة'},422);
  const entries = Object.entries(patch.value);
  const sets = entries.map(([key]) => `${key}=?`).join(', ');
  await c.env.DB.prepare(`UPDATE sections SET ${sets} WHERE id=?`).bind(...entries.map(([,value]) => value), id).run();
  return json({error:'OK',message:'تم تحديث القسم'});
});

app.get('/api/admin/schools', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT * FROM schools ORDER BY name').all()).results); });
app.post('/api/admin/schools', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{name:string}>(); if(!body.name?.trim()) return json({error:'VALIDATION_ERROR',message:'اسم المدرسة مطلوب'},422); await c.env.DB.prepare('INSERT INTO schools(name) VALUES (?)').bind(body.name.trim()).run(); return json({error:'OK',message:'تمت الإضافة'},201); });
app.put('/api/admin/schools/:id', async (c) => {
  if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const check = validateSchoolName(body.name ?? '');
  if (!Number.isInteger(id) || !check.valid) return json({error:'VALIDATION_ERROR',message:'اسم المدرسة مطلوب'},422);
  await c.env.DB.prepare('UPDATE schools SET name=? WHERE id=?').bind(check.value, id).run();
  return json({error:'OK',message:'تم تحديث المدرسة'});
});

app.get('/api/admin/projects', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare(`SELECT p.*,se.name AS section_name,sc.name AS school_name FROM projects p JOIN sections se ON se.id=p.section_id JOIN schools sc ON sc.id=p.school_id ORDER BY se.sort_order ASC,p.sort_order ASC,p.id ASC`).all()).results); });
app.post('/api/admin/projects', async (c) => {
  if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
  const body=await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const patch=normalizeProjectPatch(body ?? {});
  if (!patch.valid || !patch.value.name || !patch.value.description) return json({error:'VALIDATION_ERROR',message:'بيانات المشروع غير صالحة'},422);
  const sectionId=Number((body as any).section_id), schoolId=Number((body as any).school_id);
  if (!Number.isInteger(sectionId) || !Number.isInteger(schoolId)) return json({error:'VALIDATION_ERROR',message:'القسم والمدرسة مطلوبان'},422);
  const section=await c.env.DB.prepare('SELECT id FROM sections WHERE id=?').bind(sectionId).first();
  const school=await c.env.DB.prepare('SELECT id FROM schools WHERE id=?').bind(schoolId).first();
  if (!section || !school) return json({error:'VALIDATION_ERROR',message:'القسم أو المدرسة غير موجودة'},422);
  await c.env.DB.prepare('INSERT INTO projects(name,description,section_id,school_id,url,image_url,image_id) VALUES (?,?,?,?,?,?,?)')
    .bind(patch.value.name,patch.value.description,sectionId,schoolId,patch.value.url??null,patch.value.image_url??null,patch.value.image_id??null).run();
  return json({error:'OK',message:'تمت إضافة المشروع'},201);
});
app.put('/api/admin/projects/:id', async (c) => {
  if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const patch = normalizeProjectPatch(body ?? {});
  if (!Number.isInteger(id) || !patch.valid || !Object.keys(patch.value).length) return json({error:'VALIDATION_ERROR',message:'بيانات المشروع غير صالحة'},422);
  if (patch.value.section_id !== undefined) {
    const section = await c.env.DB.prepare('SELECT id FROM sections WHERE id=?').bind(patch.value.section_id).first();
    if (!section) return json({error:'VALIDATION_ERROR',message:'القسم أو المدرسة غير موجودة'},422);
  }
  if (patch.value.school_id !== undefined) {
    const school = await c.env.DB.prepare('SELECT id FROM schools WHERE id=?').bind(patch.value.school_id).first();
    if (!school) return json({error:'VALIDATION_ERROR',message:'القسم أو المدرسة غير موجودة'},422);
  }
  const entries = Object.entries(patch.value);
  const sets = entries.map(([key]) => `${key}=?`).join(', ');
  await c.env.DB.prepare(`UPDATE projects SET ${sets} WHERE id=?`).bind(...entries.map(([,value]) => value), id).run();
  return json({error:'OK',message:'تم تحديث المشروع'});
});

/** يجمع بيانات المعاينة: أسماء العناصر المختارة والمشاريع المرتبطة بها وأصواتها — دون كتابة شيء. */
async function deletePreviewData(db: D1Database, kind: DeleteKind, ids: number[]) {
  const marks = ids.map(() => '?').join(',');
  const projectFilter = kind === 'sections' ? `p.section_id IN (${marks})` : kind === 'schools' ? `p.school_id IN (${marks})` : `p.id IN (${marks})`;
  const projectsQuery = `SELECT p.id,p.name,p.section_id,p.school_id,se.name AS section_name,sc.name AS school_name FROM projects p JOIN sections se ON se.id=p.section_id JOIN schools sc ON sc.id=p.school_id WHERE ${projectFilter}`;
  const projects = (await db.prepare(projectsQuery).bind(...ids).all()).results as unknown as DeleteData['projects'];
  const sections = kind === 'sections' ? (await db.prepare(`SELECT id,name FROM sections WHERE id IN (${marks})`).bind(...ids).all()).results as unknown as DeleteData['sections'] : [];
  const schools = kind === 'schools' ? (await db.prepare(`SELECT id,name FROM schools WHERE id IN (${marks})`).bind(...ids).all()).results as unknown as DeleteData['schools'] : [];
  const projectIds = projects.map((project) => project.id);
  const votes = projectIds.length
    ? (await db.prepare(`SELECT project_id FROM votes WHERE project_id IN (${projectIds.map(() => '?').join(',')})`).bind(...projectIds).all()).results as unknown as DeleteData['votes']
    : [];
  const data: DeleteData = { sections, schools, projects, votes, winners: [], manualProjectId: null };
  return { data, projectIds };
}

for (const kind of ['sections', 'schools', 'projects'] as const) {
  app.post(`/api/admin/${kind}/delete-preview`, async (c) => {
    if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    const check = parseDeleteIds(body);
    if (!check.valid) return json({error:'VALIDATION_ERROR',message:'قائمة معرفات غير صالحة'},422);
    const { data } = await deletePreviewData(c.env.DB, kind, check.ids);
    return json({ error: 'OK', ...cascadePreview(kind, check.ids, data) });
  });

  app.post(`/api/admin/${kind}/delete-bulk`, async (c) => {
    if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    const check = parseDeleteIds(body);
    if (!check.valid) return json({error:'VALIDATION_ERROR',message:'قائمة معرفات غير صالحة'},422);
    const { data, projectIds } = await deletePreviewData(c.env.DB, kind, check.ids);
    const preview = cascadePreview(kind, check.ids, data);
    const statements = buildDeleteStatements(kind, check.ids, projectIds);
    if (statements.length) await c.env.DB.batch(statements.map((statement) => c.env.DB.prepare(statement.sql).bind(...statement.bind)));
    return json({ error: 'OK', deleted: { sections: kind === 'sections' ? preview.items.length : 0, schools: kind === 'schools' ? preview.items.length : 0, projects: projectIds.length, votes: preview.votes } });
  });
}


app.get('/api/admin/settings', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT key,value FROM settings').all()).results); });
app.put('/api/admin/settings', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<Record<string,string>>(); const entries=Object.entries(body); if(entries.length){ await c.env.DB.batch(entries.map(([key,value])=>c.env.DB.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,String(value)))); } return json({error:'OK',message:'تم حفظ الإعدادات'}); });

app.post('/api/admin/images', async (c) => { if (!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const form=await c.req.formData(); const file=form.get('file'); if(!(file instanceof File)||!validateImageUpload(file.type,file.size)) return json({error:'VALIDATION_ERROR',message:'الصورة يجب أن تكون PNG أو JPEG أو WebP وبحد 300 KB'},422); const data=new Uint8Array(await file.arrayBuffer()); const result=await c.env.DB.prepare('INSERT INTO images(mime,data) VALUES (?,?)').bind(file.type,data).run(); return json({id:result.meta.last_row_id},201); });


app.get('/api/admin/votes', async (c) => {
  if (!await requireAdmin(c)) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  const setting = await c.env.DB.prepare('SELECT source FROM result_settings WHERE scope = ?').bind('global').first<{ source: VoteSource }>();
  const projects = await c.env.DB.prepare(`SELECT p.id,p.section_id,p.name,p.written_votes,p.announce_in_results,
    se.name AS section_name,sc.name AS school_name,
    COUNT(vr.id) AS digital_votes
    FROM projects p JOIN sections se ON se.id=p.section_id JOIN schools sc ON sc.id=p.school_id
    LEFT JOIN votes v ON v.project_id=p.id
    LEFT JOIN voters vr ON vr.id=v.voter_id AND vr.voided=0
    GROUP BY p.id,p.section_id,p.name,p.written_votes,p.announce_in_results,se.sort_order,se.name,sc.name
    ORDER BY se.sort_order ASC,p.sort_order ASC,p.id ASC`).all();
  const rows = (projects.results as Array<{ id:number; section_id:number; name:string; section_name:string; school_name:string; written_votes:number; announce_in_results:number; digital_votes:number }>).map((p) => {
    const source = (setting?.source ?? 'digital') as VoteSource;
    return { ...p, source, final_votes: calculateProjectVotes({ digitalVotes: p.digital_votes, writtenVotes: p.written_votes }, source) };
  });
  const winners = await c.env.DB.prepare('SELECT section_id,project_id FROM section_winners').all();
  const winnerMap = Object.fromEntries((winners.results as Array<{ section_id:number; project_id:number }>).map((row) => [row.section_id, row.project_id]));
  return json({ source: setting?.source ?? 'digital', projects: rows, winners: winnerMap });
});

app.put('/api/admin/votes/source', async (c) => {
  if (!await requireAdmin(c)) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  const body = await c.req.json<{ source?: VoteSource }>().catch(() => ({}));
  if (!body.source || !['digital','written','combined','manual'].includes(body.source)) return json({ error: 'VALIDATION_ERROR', message: 'مصدر النتائج غير صالح' }, 422);
  await c.env.DB.prepare('INSERT INTO result_settings(scope,source) VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET source=excluded.source').bind('global', body.source).run();
  return json({ error: 'OK', message: 'تم تحديث مصدر النتائج' });
});

app.put('/api/admin/votes/:id', async (c) => {
  if (!await requireAdmin(c)) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ writtenVotes?: number; announceInResults?: boolean }>().catch(() => ({}));
  if (!Number.isInteger(id) || (body.writtenVotes !== undefined && (!Number.isInteger(body.writtenVotes) || body.writtenVotes < 0))) return json({ error: 'VALIDATION_ERROR', message: 'بيانات الأصوات غير صالحة' }, 422);
  if (body.writtenVotes !== undefined) await c.env.DB.prepare('UPDATE projects SET written_votes=? WHERE id=?').bind(body.writtenVotes, id).run();
  if (body.announceInResults !== undefined) await c.env.DB.prepare('UPDATE projects SET announce_in_results=? WHERE id=?').bind(body.announceInResults ? 1 : 0, id).run();
  return json({ error: 'OK', message: 'تم حفظ أصوات المشروع' });
});

app.get('/api/admin/voters', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); return json((await c.env.DB.prepare('SELECT id,full_name,channel,is_duplicate,voided,void_reason,created_at FROM voters ORDER BY created_at DESC').all()).results); });
app.post('/api/admin/voters/:id/void', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{reason?:string}>(); await c.env.DB.prepare('UPDATE voters SET voided=1,void_reason=? WHERE id=?').bind(body.reason??'تم الإلغاء',c.req.param('id')).run(); return json({error:'OK',message:'تم إلغاء أصوات الناخب'}); });
app.post('/api/admin/voters/:id/restore', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); await c.env.DB.prepare('UPDATE voters SET voided=0,void_reason=NULL WHERE id=?').bind(c.req.param('id')).run(); return json({error:'OK',message:'تمت استعادة أصوات الناخب'}); });

app.get('/api/admin/results', async (c) => {
  if (!await requireAdmin(c)) return json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' }, 401);
  const setting = await c.env.DB.prepare('SELECT source FROM result_settings WHERE scope=?').bind('global').first<{ source: VoteSource }>();
  const source = setting?.source ?? 'digital';

  if (source === 'manual') {
    const winners = await c.env.DB.prepare(`SELECT se.id AS section_id,se.name AS section_name,p.id AS project_id,p.name AS project_name,
      p.image_url,p.image_id,sc.name AS school_name,0 AS votes
      FROM section_winners w JOIN sections se ON se.id=w.section_id
      JOIN projects p ON p.id=w.project_id JOIN schools sc ON sc.id=p.school_id
      WHERE se.is_active=1 AND p.is_active=1 ORDER BY se.sort_order ASC,se.id ASC`).all();
    const rows = (winners.results as Array<Record<string, any>>).map((row) => ({
      sectionId: row.section_id, sectionName: row.section_name, projectId: row.project_id,
      projectName: row.project_name, schoolName: row.school_name, imageUrl: displayImageUrl(row.image_url, row.image_id),
      votes: row.votes, announceInResults: 1,
    }));
    return json({ source, sections: groupResultsBySection(rows) });
  }

  const ranking = await c.env.DB.prepare(`SELECT se.id AS section_id,se.name AS section_name,p.id AS project_id,p.name AS project_name,
    p.image_url,p.written_votes,p.announce_in_results,sc.name AS school_name,COUNT(v.id) AS digital_votes
    FROM sections se JOIN projects p ON p.section_id=se.id JOIN schools sc ON sc.id=p.school_id
    LEFT JOIN votes v ON v.project_id=p.id AND v.voter_id IN (SELECT id FROM voters WHERE voided=0)
    WHERE se.is_active=1 AND p.is_active=1 GROUP BY se.id,p.id ORDER BY se.sort_order ASC,p.id ASC`).all();
  const rows = (ranking.results as Array<Record<string, any>>).map((row) => ({
    sectionId: row.section_id, sectionName: row.section_name, projectId: row.project_id,
    projectName: row.project_name, schoolName: row.school_name, imageUrl: displayImageUrl(row.image_url, row.image_id),
    votes: calculateProjectVotes({ digitalVotes: row.digital_votes, writtenVotes: row.written_votes }, source),
    announceInResults: row.announce_in_results,
  }));
  return json({ source, rows, sections: groupResultsBySection(rows) });
});
app.put('/api/admin/winners/:sectionId', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{project_id:number}>(); await c.env.DB.prepare('INSERT INTO section_winners(section_id,project_id) VALUES (?,?) ON CONFLICT(section_id) DO UPDATE SET project_id=excluded.project_id').bind(Number(c.req.param('sectionId')),body.project_id).run(); return json({error:'OK',message:'تم اختيار الفائز'}); });
app.delete('/api/admin/winners/:sectionId', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); await c.env.DB.prepare('DELETE FROM section_winners WHERE section_id=?').bind(Number(c.req.param('sectionId'))).run(); return json({error:'OK',message:'تم إلغاء الفائز اليدوي'}); });

async function csvExport(c:any, kind:'results'|'voters') { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); let csv=''; if(kind==='results') csv='القسم,المشروع,المدرسة,الأصوات\r\n'; else csv='الاسم الكامل,القناة,الوقت,مكرر,ملغى\r\n'; return new Response(csvWithBom(csv),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${kind}.csv"`}}); }
app.get('/api/admin/export/results.csv',(c)=>csvExport(c,'results')); app.get('/api/admin/export/voters.csv',(c)=>csvExport(c,'voters'));

app.post('/api/admin/reset', async (c) => { if(!await requireAdmin(c)) return json({error:'UNAUTHORIZED',message:'يجب تسجيل الدخول'},401); const body=await c.req.json<{scope?:'votes'|'everything';confirm?:string}>(); if(body.confirm!== 'تأكيد') return json({error:'CONFIRMATION_REQUIRED',message:'اكتب تأكيد للمتابعة'},422); if(body.scope==='everything'){ await c.env.DB.batch([c.env.DB.prepare('DELETE FROM votes'),c.env.DB.prepare('DELETE FROM voters'),c.env.DB.prepare('DELETE FROM section_winners'),c.env.DB.prepare('DELETE FROM projects'),c.env.DB.prepare('DELETE FROM sections'),c.env.DB.prepare('DELETE FROM schools')]); } else { await c.env.DB.batch([c.env.DB.prepare('DELETE FROM votes'),c.env.DB.prepare('DELETE FROM voters'),c.env.DB.prepare('DELETE FROM section_winners')]); } return json({error:'OK',message:'تمت إعادة الضبط'}); });

app.notFound((c) => json({ error: 'NOT_FOUND', message: 'المسار غير موجود' }, 404));
export const onRequest: PagesFunction<Bindings> = (context) => app.fetch(context.request, context.env, context);
