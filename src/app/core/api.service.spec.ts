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

  it('يعيد تسمية مدرسة عبر PUT', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ApiService);
    const http = TestBed.inject(HttpTestingController);
    const promise = api.updateSchool(4, 'مدرسة الأمل');
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/schools/4' });
    expect(req.request.body).toEqual({ name: 'مدرسة الأمل' });
    req.flush({ error: 'OK', message: 'تم تحديث المدرسة' });
    await expect(promise).resolves.toEqual({ error: 'OK', message: 'تم تحديث المدرسة' });
  });

  it('ينقل المشروع إلى قسم آخر عبر updateProject', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ApiService);
    const http = TestBed.inject(HttpTestingController);
    const promise = api.updateProject(9, { section_id: 2, school_id: 5 });
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/projects/9' });
    expect(req.request.body).toEqual({ section_id: 2, school_id: 5 });
    req.flush({ error: 'OK', message: 'تم تحديث المشروع' });
    await expect(promise).resolves.toEqual({ error: 'OK', message: 'تم تحديث المشروع' });
  });
});
