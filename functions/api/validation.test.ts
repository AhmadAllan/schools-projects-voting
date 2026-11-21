import { describe, expect, it } from 'vitest';
import { normalizeArabic, validateArabicNamePart, isValidUuid } from './validation';

describe('التحقق العربي', () => {
  it('يرفض الأرقام واللاتينية ويحافظ على الحقل من 3 أحرف عربية', () => {
    expect(validateArabicNamePart('محمد').valid).toBe(true);
    expect(validateArabicNamePart('محمد2').valid).toBe(false);
    expect(validateArabicNamePart('Mohamed').valid).toBe(false);
    expect(validateArabicNamePart('ا').valid).toBe(false);
  });

  it('يطبع متغيرات التشكيل والتطويل والمتغيرات الإملائية', () => {
    expect(normalizeArabic('  أَحْمَدْ ـ  ')).toBe('احمد');
    expect(normalizeArabic('عبد الله')).toBe('عبد الله');
    expect(normalizeArabic('ىَ')).toBe('ي');
  });

  it('يتحقق من UUID بصيغة صالحة فقط', () => {
    expect(isValidUuid('6f1c0c0e-4e4f-4a3a-a1b2-1234567890ab')).toBe(true);
    expect(isValidUuid('غير-معرف')).toBe(false);
  });
});
