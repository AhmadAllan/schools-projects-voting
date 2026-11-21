import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
describe('خدمة واجهة التصويت', () => {
  it('تجلب حالة التصويت من المسار العام', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ApiService); const http = TestBed.inject(HttpTestingController);
    const promise = api.getStatus();
    http.expectOne('/api/public/status').flush({ state: 'open', opensAt: null, closesAt: null });
    await expect(promise).resolves.toEqual({ state: 'open', opensAt: null, closesAt: null });
  });
});
