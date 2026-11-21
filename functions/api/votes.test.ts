import { describe, expect, it } from 'vitest';
import { validateSubmission } from './votes';

describe('قواعد التصويت', () => {
  it('يرفض الاختيارات الفارغة أو الأربع أو تكرار القسم', () => {
    expect(validateSubmission({ requestId: '6f1c0c0e-4e4f-4a3a-a1b2-1234567890ab', name: { first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' }, selections: [] }).error).toBe('VALIDATION_ERROR');
    expect(validateSubmission({ requestId: '6f1c0c0e-4e4f-4a3a-a1b2-1234567890ab', name: { first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' }, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 1, projectId: 2 }] }).error).toBe('VALIDATION_ERROR');
  });

  it('يقبله اختياريًا لثلاث فئات مختلفة', () => {
    expect(validateSubmission({ requestId: '6f1c0c0e-4e4f-4a3a-a1b2-1234567890ab', name: { first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' }, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 2, projectId: 2 }, { sectionId: 3, projectId: 3 }] }).error).toBeUndefined();
  });
});
