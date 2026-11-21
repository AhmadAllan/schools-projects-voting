import { describe, expect, it } from 'vitest';
import { constantTimeEqual, issueAdminSession, verifyAdminSession } from './auth';

describe('جلسة الإدارة', () => {
  it('يقبل التوكن الموقع ويلغي التوكن المنتهي أو المزور', async () => {
    const secret = 'سر-طويل';
    const token = await issueAdminSession(secret, 1_000);
    const request = new Request('https://example.com/api/admin/me', { headers: { cookie: `admin_session=${token}` } });
    expect(await verifyAdminSession(request, secret, 2_000)).toBe(true);
    expect(await verifyAdminSession(request, 'سر-آخر', 2_000)).toBe(false);
    expect(await verifyAdminSession(request, secret, 43_300_000)).toBe(false);
  });

  it('يقارن السر بمقارنة بطول ثابت زمنيًا', () => {
    expect(constantTimeEqual('secret', 'secret')).toBe(true);
    expect(constantTimeEqual('secret', 'secrex')).toBe(false);
  });
});
