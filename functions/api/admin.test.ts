import { describe, expect, it } from 'vitest';
import { validateSection, validateProjectUrl, validateImageUpload } from './admin-content';
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
});
