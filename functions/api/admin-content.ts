export function validateSection(name: string) { const valid = typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100; return { valid, value: name?.trim() ?? '' }; }
export function validateProjectUrl(url: string) { if (!url) return true; try { const parsed = new URL(url); return parsed.protocol === 'http:' || parsed.protocol === 'https:'; } catch { return false; } }
export function validateImageUpload(mime: string, size: number) { return ['image/jpeg','image/png','image/webp'].includes(mime) && size > 0 && size <= 300_000; }

export interface SectionPatch {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: 0 | 1;
}

/** يحوّل جسم الطلب إلى تعديل جزئي آمن للأقسام ويرفض أي قيمة غير صالحة. */
export function normalizeSectionPatch(body: Record<string, unknown>): { valid: boolean; value: SectionPatch } {
  const patch: SectionPatch = {};
  if (body.name !== undefined) {
    const check = validateSection(String(body.name));
    if (!check.valid) return { valid: false, value: {} };
    patch.name = check.value;
  }
  if (body.description !== undefined) patch.description = String(body.description).trim() || null;
  if (body.sort_order !== undefined) {
    const order = Number(body.sort_order);
    if (!Number.isInteger(order) || order < 0) return { valid: false, value: {} };
    patch.sort_order = order;
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active ? 1 : 0;
  return { valid: true, value: patch };
}

export interface ProjectPatch {
  name?: string;
  description?: string;
  url?: string | null;
  image_url?: string | null;
  image_id?: number | null;
  section_id?: number;
  school_id?: number;
  is_active?: 0 | 1;
}

/** يحوّل جسم الطلب إلى تعديل جزئي آمن للمشاريع ويرفض أي قيمة غير صالحة. */
export function normalizeProjectPatch(body: Record<string, unknown>): { valid: boolean; value: ProjectPatch } {
  const patch: ProjectPatch = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 200) return { valid: false, value: {} };
    patch.name = name;
  }
  if (body.description !== undefined) {
    const description = String(body.description).trim();
    if (!description) return { valid: false, value: {} };
    patch.description = description;
  }
  if (body.url !== undefined) {
    const url = String(body.url).trim();
    if (url ? !validateProjectUrl(url) : false) return { valid: false, value: {} };
    patch.url = url || null;
  }
  if (body.image_url !== undefined) {
    const imageUrl = String(body.image_url).trim();
    if (imageUrl && !validateProjectUrl(imageUrl)) return { valid: false, value: {} };
    patch.image_url = imageUrl || null;
  }
  if (body.image_id !== undefined) {
    if (body.image_id === null || body.image_id === '') { patch.image_id = null; }
    else {
      const imageId = Number(body.image_id);
      if (!Number.isInteger(imageId) || imageId <= 0) return { valid: false, value: {} };
      patch.image_id = imageId;
    }
  }
  if (body.section_id !== undefined) {
    const sectionId = Number(body.section_id);
    if (!Number.isInteger(sectionId) || sectionId <= 0) return { valid: false, value: {} };
    patch.section_id = sectionId;
  }
  if (body.school_id !== undefined) {
    const schoolId = Number(body.school_id);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return { valid: false, value: {} };
    patch.school_id = schoolId;
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active ? 1 : 0;
  return { valid: true, value: patch };
}
