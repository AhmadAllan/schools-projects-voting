export function validateSection(name: string) { const valid = typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100; return { valid, value: name?.trim() ?? '' }; }
export function validateProjectUrl(url: string) { if (!url) return true; try { const parsed = new URL(url); return parsed.protocol === 'http:' || parsed.protocol === 'https:'; } catch { return false; } }
export function validateImageUpload(mime: string, size: number) { return ['image/jpeg','image/png','image/webp'].includes(mime) && size > 0 && size <= 300_000; }
