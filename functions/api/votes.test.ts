import { describe, expect, it } from 'vitest';
import { validateSubmission } from './votes';

describe('قواعد التصويت', () => {
  const base = { requestId: '6f1c0c0e-4e4f-4a3a-a1b2-1234567890ab', name: { first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' } };

  it('يرفض الفارغ أو الأربعة أو تكرار المشروع نفسه', () => {
    expect(validateSubmission({ ...base, selections: [] }).error).toBe('VALIDATION_ERROR');
    expect(validateSubmission({ ...base, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 1, projectId: 1 }] }).error).toBe('VALIDATION_ERROR');
    expect(validateSubmission({ ...base, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 2, projectId: 2 }, { sectionId: 3, projectId: 3 }, { sectionId: 3, projectId: 9 }] }).error).toBe('VALIDATION_ERROR');
  });

  it('يقبل مشروعين من القسم نفسه وثلاثة من أي أقسام', () => {
    expect(validateSubmission({ ...base, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 1, projectId: 2 }] }).error).toBeUndefined();
    expect(validateSubmission({ ...base, selections: [{ sectionId: 1, projectId: 1 }, { sectionId: 2, projectId: 2 }, { sectionId: 3, projectId: 3 }] }).error).toBeUndefined();
  });
});
