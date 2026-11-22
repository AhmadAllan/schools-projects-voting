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

/**
 * Normalizes a D1 BLOB value into a binary response body.
 * D1 returns BLOB columns as a plain number Array in local dev and as a typed
 * buffer in other runtimes; a plain Array is not a valid Response body and
 * would silently produce an empty 200 response.
 */
export function imageResponseBody(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data)) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(0);
}
