import { Hono } from 'hono';

interface Bindings { DB: D1Database; ADMIN_PASSWORD: string; SESSION_SECRET: string }
const app = new Hono<{ Bindings: Bindings }>();
app.notFound(() => new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'المسار غير موجود' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } }));
export const onRequest: PagesFunction<Bindings> = (context) => app.fetch(context.request, context.env, context);
