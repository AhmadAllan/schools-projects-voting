export async function getSetting(db: D1Database, key: string, fallback = ''): Promise<string> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? fallback;
}
