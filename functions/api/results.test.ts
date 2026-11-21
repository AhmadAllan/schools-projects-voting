import { describe, expect, it } from 'vitest';
import { calculateTie, csvWithBom } from './admin-results';
describe('النتائج والتصدير', () => {
  it('يعرف التعادل ويمنع الفوز بقيمة صفر', () => {
    expect(calculateTie([{votes:5},{votes:5}]).tie).toBe(true);
    expect(calculateTie([{votes:0},{votes:0}]).tie).toBe(false);
  });
  it('يضيف BOM إلى CSV ويحتفظ بالعربية', () => {
    expect(csvWithBom('القسم,المشروع\nالمواقع,مشروع واحد').charCodeAt(0)).toBe(0xfeff);
  });
});
