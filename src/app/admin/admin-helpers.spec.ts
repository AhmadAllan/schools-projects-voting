import { describe, expect, it } from 'vitest';
import { channelLabel, filterVoters, notBlank } from './admin-helpers';
import { AdminVoter } from '../core/models';

const voters: AdminVoter[] = [
  { id: '1', full_name: 'أحمد محمد علي حسن', channel: 'qr', is_duplicate: 0, voided: 0, void_reason: null, created_at: '2026-11-21T10:00:00Z' },
  { id: '2', full_name: 'سارة خالد يوسف عمر', channel: 'tablet', is_duplicate: 1, voided: 1, void_reason: 'خطأ', created_at: '2026-11-21T11:00:00Z' },
];

describe('مساعدات لوحة الإدارة', () => {
  it('يبحث في أسماء الناخبين بلا حساسية للمسافات', () => {
    expect(filterVoters(voters, ' خالد ')).toEqual([voters[1]]);
    expect(filterVoters(voters, '')).toEqual(voters);
    expect(filterVoters(voters, 'لا يوجد')).toEqual([]);
  });

  it('يعرض تسمية عربية لقناة التصويت', () => {
    expect(channelLabel('qr')).toBe('الهاتف');
    expect(channelLabel('tablet')).toBe('الطاولة');
  });

  it('يرفض الأسماء المؤلفة من مسافات فقط', () => {
    expect(notBlank({ value: 'الروبوتات' } as any)).toBeNull();
    expect(notBlank({ value: '   ' } as any)).toEqual({ blank: true });
    expect(notBlank({ value: '' } as any)).toEqual({ blank: true });
  });
});
