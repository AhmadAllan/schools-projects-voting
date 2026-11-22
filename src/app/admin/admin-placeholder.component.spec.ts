import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminPlaceholderComponent } from './admin-placeholder.component';

describe('لوحة الإدارة — الرئيسية', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });

  it('تعرض روابط الكشك وشاشة الفائزين', async () => {
    const fixture = TestBed.createComponent(AdminPlaceholderComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/settings').flush({});
    http.expectOne('/api/public/status').flush({ state: 'open', opensAt: null, closesAt: null });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const kiosk = el.querySelector<HTMLAnchorElement>('.actions a[href="/kiosk"]');
    const winners = el.querySelector<HTMLAnchorElement>('.actions a[href="/winners"]');
    expect(kiosk?.textContent?.trim()).toBe('شاشة الكشك');
    expect(winners?.textContent?.trim()).toBe('شاشة الفائزين');
  });
});
