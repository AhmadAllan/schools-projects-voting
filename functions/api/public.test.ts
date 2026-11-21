import { describe, expect, it } from 'vitest';
import { publicResultsGate, withCacheHeaders } from './public';

describe('واجهة النتائج العامة', () => {
  it('تحجب النتائج ما لم يُنشر الحدث', () => {
    expect(publicResultsGate('0')).toEqual({ allowed: false, code: 'RESULTS_NOT_PUBLISHED' });
    expect(publicResultsGate('1').allowed).toBe(true);
  });

  it('يمنع تخزين نتائج الإعلان مؤقتًا ويحافظ على JSON UTF-8', () => {
    expect(withCacheHeaders(200).get('cache-control')).toContain('no-store');
  });
});
