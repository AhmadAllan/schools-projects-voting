import { describe, expect, it } from 'vitest';
import { displayImageUrl } from './db';

describe('رابط صورة المشروع', () => {
  it('يمرر الرابط الخارجي كما هو حتى مع وجود صورة مرفوعة', () => {
    expect(displayImageUrl('https://example.com/p.png', 3)).toBe('https://example.com/p.png');
  });

  it('يشتق رابط الصورة المرفوعة من المعرف', () => {
    expect(displayImageUrl(null, 7)).toBe('/api/images/7');
  });

  it('يعيد null عندما لا توجد صورة بأي شكل', () => {
    expect(displayImageUrl(null, null)).toBeNull();
    expect(displayImageUrl(undefined, undefined)).toBeNull();
    expect(displayImageUrl('', undefined)).toBeNull();
  });
});
