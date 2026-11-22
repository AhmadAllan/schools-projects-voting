import { describe, expect, it } from 'vitest';
import { displayImageUrl, imageResponseBody } from './db';

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

describe('جسم استجابة الصورة', () => {
  it('يحوّل مصفوفة الأرقام القادمة من D1 إلى بايتات صالحة', () => {
    const body = imageResponseBody([0xff, 0xd8, 0xff, 0xe0]);
    expect(body).toBeInstanceOf(Uint8Array);
    expect(Array.from(body as Uint8Array)).toEqual([255, 216, 255, 224]);
  });

  it('يمرر البايتات المطبوعة كما هي', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(imageResponseBody(bytes)).toBe(bytes);
  });

  it('يتعامل مع ArrayBuffer القادم من بيئة أخرى', () => {
    const buffer = new ArrayBuffer(2);
    expect(Array.from(imageResponseBody(buffer) as Uint8Array)).toEqual([0, 0]);
  });
});

