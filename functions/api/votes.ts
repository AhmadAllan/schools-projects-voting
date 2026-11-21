import { isValidUuid, normalizeArabic, validateArabicNamePart } from './validation';
import { NameParts, Selection, VoteRequest } from './types';

export function validateSubmission(body: VoteRequest) {
  if (!body || !isValidUuid(body.requestId ?? '')) return { error: 'VALIDATION_ERROR', message: 'معرف الطلب غير صالح' };
  if (!body.name) return { error: 'VALIDATION_ERROR', message: 'الاسم مطلوب' };
  for (const key of ['first', 'father', 'grandfather', 'family'] as (keyof NameParts)[]) {
    if (!validateArabicNamePart(body.name[key] ?? '').valid) return { error: 'VALIDATION_ERROR', field: key, message: 'يجب أن يتكوّن كل اسم من 3 أحرف عربية على الأقل' };
  }
  if (!Array.isArray(body.selections) || body.selections.length < 1 || body.selections.length > 3) {
    return { error: 'VALIDATION_ERROR', message: 'اختر مشروعاً واحداً على الأقل وبحد أقصى ثلاثة مشاريع' };
  }
  const sections = new Set<number>();
  for (const selection of body.selections as Selection[]) {
    if (!Number.isInteger(selection.sectionId) || !Number.isInteger(selection.projectId) || sections.has(selection.sectionId)) {
      return { error: 'VALIDATION_ERROR', message: 'اختيار فئة أو مشروع غير صالح' };
    }
    sections.add(selection.sectionId);
  }
  return {};
}

export function normalizedFullName(name: NameParts): string {
  return [name.first, name.father, name.grandfather, name.family].map(normalizeArabic).join(' ');
}
