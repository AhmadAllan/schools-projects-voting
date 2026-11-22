import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminSessionService } from './admin-session.service';

describe('جلسة الإدارة', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('يعلّم isAdmin عند نجاح /api/admin/me', async () => {
    const service = TestBed.inject(AdminSessionService);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/me').flush({ authenticated: true });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(service.isAdmin()).toBe(true);
  });

  it('يبقيها false عند 401', async () => {
    const service = TestBed.inject(AdminSessionService);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/me').flush(
      { error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(service.isAdmin()).toBe(false);
  });
});
