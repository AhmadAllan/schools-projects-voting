import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { WinnersPlaceholderComponent } from './winners-placeholder.component';
import { ResultsResponse } from '../core/models';

function results(source: string, votes: number[]): ResultsResponse {
  return {
    source: source as ResultsResponse['source'],
    sections: [{
      section_id: 1,
      section_name: 'قسم الروبوتات',
      projects: votes.map((votes, index) => ({ project_id: index + 1, project_name: `مشروع ${index + 1}`, school_name: 'مدرسة النور', image_url: null, votes })),
      tiedProjects: [],
    }],
  };
}

const UNAUTHORIZED = { error: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول' } as const;
async function drain() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe('شاشة الفائزين', () => {
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  async function standalone() {
    const fixture = TestBed.createComponent(WinnersPlaceholderComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/admin/me').flush(UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
    await drain();
    return fixture;
  }

  function text(fixture: { nativeElement: HTMLElement }) { return (fixture.nativeElement as HTMLElement).textContent ?? ''; }
  function cards(fixture: { nativeElement: HTMLElement }) { return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.winner-card')); }
  function badges(fixture: { nativeElement: HTMLElement }) { return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rank-badge')).map((badge) => badge.textContent?.trim()); }

  it('يعرض المراكز الثلاثة الأولى حسب ترتيب الأصوات', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [9, 7, 5, 3]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(3);
    expect(badges(fixture)).toEqual(['المركز الأول', 'المركز الثاني', 'المركز الثالث']);
    expect(text(fixture)).not.toContain('مشروع 4');
  });

  it('المتعادلون في الأول يتقاسمون المركز ثم يُكمل الثاني والثالث', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    const body = results('digital', [10, 10, 5]);
    body.sections[0]!.tiedProjects = [1, 2];
    http.expectOne('/api/admin/results').flush(body);
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(3);
    expect(badges(fixture)).toEqual(['المركز الأول', 'المركز الأول', 'المركز الثاني']);
    expect(text(fixture)).toContain('تعادل في المركز الأول');
  });

  it('قسم بأقل من ثلاثة مشاريع يعرض ما هو متاح', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [7, 2]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(2);
    expect(badges(fixture)).toEqual(['المركز الأول', 'المركز الثاني']);
  });

  it('لا شارات مراكز عندما كل الأصوات صفر', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [0, 0]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(2);
    expect(badges(fixture)).toEqual([]);
  });

  it('المصدر اليدوي يعرض الفائز المختار فقط دون أصوات أو مراكز', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('manual', [0]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(1);
    expect(badges(fixture)).toEqual([]);
    expect(text(fixture)).not.toContain('صوت');
    expect(text(fixture)).toContain('اختيار الإدارة');
  });

  it('غير المنشور يعرض رسالة ما زال التصويت جاريًا', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
    await drain();
    http.expectOne('/api/public/results').flush({ error: 'RESULTS_NOT_PUBLISHED', message: 'النتائج غير منشورة بعد' }, { status: 403, statusText: 'Forbidden' });
    await drain(); await fixture.whenStable();
    expect(text(fixture)).toContain('ما زال التصويت جاريًا — النتائج غير معلنة بعد');
    expect((fixture.nativeElement as HTMLElement).querySelector('button.admin-return')).toBeNull();
  });

  it('الزر للعودة إلى لوحة الإدارة يظهر للمدير فقط', async () => {
    const fixture = TestBed.createComponent(WinnersPlaceholderComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/me').flush({ authenticated: true });
    await drain();
    http.expectOne('/api/admin/results').flush(results('digital', [9, 7, 5]));
    await drain(); await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.admin-return');
    expect(button).not.toBeNull();
    button!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('الوضع المدمج يستدعي النتائج العامة فقط', async () => {
    const fixture = TestBed.createComponent(WinnersPlaceholderComponent);
    fixture.componentRef.setInput('embedded', true);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/me').flush(UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
    await drain();
    http.expectOne('/api/public/results').flush(results('digital', [9, 7, 5]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(3);
    http.verify();
  });
});
