import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AdminVotersComponent } from './admin-voters.component';
import { AdminVoter } from '../core/models';

const VOTERS: AdminVoter[] = [
  { id: 'v1', full_name: 'محمد أحمد خالد العبدالله', channel: 'qr', is_duplicate: 0, voided: 0, void_reason: null, created_at: '2026-01-01T10:00:00Z' },
];

describe('شاشة الناخبين — إلغاء الأصوات', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminVotersComponent);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/voters').flush(VOTERS);
    await fixture.whenStable();
    return fixture;
  }

  it('إلغاء أصوات ناخب يفتح نافذة سبب بدل prompt', async () => {
    const prompt = vi.spyOn(window, 'prompt');
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('إلغاء الأصوات'))!.click();
    await fixture.whenStable();
    expect(prompt).not.toHaveBeenCalled();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.admin-dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('محمد أحمد خالد العبدالله');
    const reason = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    reason.value = 'سبب مخصص';
    reason.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('تأكيد الإلغاء'))!.click();
    await fixture.whenStable();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/admin/voters/v1/void');
    expect(req.request.body).toEqual({ reason: 'سبب مخصص' });
    req.flush({ error: 'OK', message: 'تم' });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/admin/voters').flush(VOTERS);
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });

  it('زر الإلغاء في النافذة يغلقها دون أي طلب', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('إلغاء الأصوات'))!.click();
    await fixture.whenStable();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.admin-dialog')!;
    expect(dialog.open).toBe(true);
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'إلغاء')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    TestBed.inject(HttpTestingController).verify();
  });
});
