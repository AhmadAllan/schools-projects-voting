export async function getSetting(db: D1Database, key: string, fallback = ''): Promise<string> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? fallback;
}

/** Project display image: external URL wins, else derive one from an uploaded image's id. */
export function displayImageUrl(imageUrl: string | null | undefined, imageId: number | null | undefined): string | null {
  if (imageUrl && imageUrl.trim()) return imageUrl;
  if (imageId != null) return `/api/images/${imageId}`;
  return null;
}
