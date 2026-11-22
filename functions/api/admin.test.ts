import { describe, expect, it } from 'vitest';
import { normalizeProjectPatch, normalizeSectionPatch, validateSection, validateProjectUrl, validateImageUpload, validateSchoolName } from './admin-content';
describe('إدارة المحتوى', () => {
  it('يتحقق من القسم وعنوان المشروع ونوع الصورة وحجمها', () => {
    expect(validateSection('المواقع').valid).toBe(true);
    expect(validateSection(' ').valid).toBe(false);
    expect(validateProjectUrl('https://example.com')).toBe(true);
    expect(validateProjectUrl('javascript:alert(1)')).toBe(false);
    expect(validateImageUpload('image/png', 200_000)).toBe(true);
    expect(validateImageUpload('text/plain', 200_000)).toBe(false);
    expect(validateImageUpload('image/jpeg', 301_000)).toBe(false);
  });

  it('يبني تعديلًا جزئيًا آمنًا للقسم', () => {
    expect(normalizeSectionPatch({ is_active: false, description: '  وصف جديد  ' })).toEqual({
      valid: true,
      value: { description: 'وصف جديد', is_active: 0 },
    });
    expect(normalizeSectionPatch({ name: '   ' }).valid).toBe(false);
    expect(normalizeSectionPatch({ sort_order: 'abc' }).valid).toBe(false);
  });

  it('يبني تعديلًا جزئيًا آمنًا للمشروع', () => {
    expect(normalizeProjectPatch({ is_active: true, image_id: 7, url: 'not a url' }).valid).toBe(false);
    expect(normalizeProjectPatch({ is_active: true, image_id: 7, url: '' })).toEqual({
      valid: true,
      value: { is_active: 1, image_id: 7, url: null },
    });
    expect(normalizeProjectPatch({ name: '  مشروع  ' })).toEqual({
      valid: true,
      value: { name: 'مشروع' },
    });
    expect(normalizeProjectPatch({ image_id: 'x' }).valid).toBe(false);
  });

  it('يقبل نقل المشروع بين قسم ومدرسة صحيحين', () => {
    expect(normalizeProjectPatch({ section_id: 3, school_id: 5 })).toEqual({
      valid: true,
      value: { section_id: 3, school_id: 5 },
    });
    expect(normalizeProjectPatch({ section_id: 'x' }).valid).toBe(false);
    expect(normalizeProjectPatch({ school_id: 0 }).valid).toBe(false);
    expect(normalizeProjectPatch({ school_id: 2.5 }).valid).toBe(false);
  });

  it('يتحقق من اسم المدرسة للتعديل', () => {
    expect(validateSchoolName('  مدرسة الأمل  ')).toEqual({ valid: true, value: 'مدرسة الأمل' });
    expect(validateSchoolName(' ').valid).toBe(false);
    expect(validateSchoolName('x'.repeat(151)).valid).toBe(false);
  });
});
