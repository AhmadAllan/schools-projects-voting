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
    TestBed.inject(HttpTestingController).match('/api/admin/me')
      .forEach((request) => request.flush(UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' }));
    await drain();
    return fixture;
  }

  function text(fixture: { nativeElement: HTMLElement }) { return (fixture.nativeElement as HTMLElement).textContent ?? ''; }
  function cards(fixture: { nativeElement: HTMLElement }) { return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.winner-card')); }
  function rows(fixture: { nativeElement: HTMLElement }) { return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.place-row')); }
  function rowCards(row: Element) { return row.querySelectorAll('.winner-card'); }
  function rowBadge(row: Element) { return (row.querySelector('.rank-badge, .tie-badge')?.textContent ?? '').trim(); }

  it('يعرض المراكز الثلاثة الأولى كل مركز في صف', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    const body = results('digital', [9, 7, 5, 3]);
    body.sections[0]!.projects[0]!.image_url = '/img.png';
    http.expectOne('/api/admin/results').flush(body);
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(3);
    expect(placeRows.map((row) => rowCards(row).length)).toEqual([1, 1, 1]);
    expect(placeRows.map((row) => rowBadge(row))).toEqual(['المركز الأول', 'المركز الثاني', 'المركز الثالث']);
    expect(text(fixture)).not.toContain('مشروع 4');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
  });

  it('التعادل في الأول يجعل المشروع التالي في المركز الثالث', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [10, 10, 5]));
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(2);
    expect(rowCards(placeRows[0]!).length).toBe(2);
    expect(placeRows[0]!.querySelector('.tie-badge')?.textContent?.trim()).toBe('تعادل في المركز الأول');
    expect(rowCards(placeRows[1]!).length).toBe(1);
    expect(rowBadge(placeRows[1]!)).toBe('المركز الثالث');
  });

  it('التعادل في الأول مع رابع لا يظهر الرابع لأنه خارج المراكز الثلاثة', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [10, 10, 5, 3]));
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(2);
    expect(rowCards(placeRows[0]!).length).toBe(2);
    expect(rowBadge(placeRows[1]!)).toBe('المركز الثالث');
    expect(text(fixture)).not.toContain('مشروع 4');
  });

  it('التعادل في أي مركز يعرض بطاقاته مع لافتة تعادل خاصة به', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [10, 10, 5, 5, 2]));
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(2);
    expect(placeRows.map((row) => rowCards(row).length)).toEqual([2, 2]);
    expect(placeRows.map((row) => rowBadge(row))).toEqual(['تعادل في المركز الأول', 'تعادل في المركز الثالث']);
    expect(text(fixture)).not.toContain('مشروع 5');
  });

  it('التعادل في الثاني يعرض الأول ثم تعادل الثاني ولا ثالث', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [10, 7, 7, 3]));
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(2);
    expect(placeRows.map((row) => rowBadge(row))).toEqual(['المركز الأول', 'تعادل في المركز الثاني']);
    expect(placeRows.map((row) => rowCards(row).length)).toEqual([1, 2]);
    expect(text(fixture)).not.toContain('مشروع 4');
  });

  it('قسم بأقل من ثلاثة مراكز يعرض ما هو متاح', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [7, 2]));
    await drain(); await fixture.whenStable();
    const placeRows = rows(fixture);
    expect(placeRows.length).toBe(2);
    expect(placeRows.map((row) => rowBadge(row))).toEqual(['المركز الأول', 'المركز الثاني']);
  });

  it('لا شارات مراكز عندما كل الأصوات صفر', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [0, 0]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.rank-badge, .tie-badge').length).toBe(0);
  });

  it('المصدر اليدوي يعرض الفائز المختار فقط دون أصوات أو مراكز', async () => {
    const fixture = await standalone();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('manual', [0]));
    await drain(); await fixture.whenStable();
    expect(cards(fixture).length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.rank-badge, .tie-badge').length).toBe(0);
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
    http.match('/api/admin/me').forEach((request) => request.flush({ authenticated: true }));
    await drain();
    http.expectOne('/api/admin/results').flush(results('digital', [9, 7, 5]));
    await drain(); await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.admin-return');
    expect(button).not.toBeNull();
    button!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('تحديث الجلسة عند فتح الشاشة يُظهر زر العودة بعد تسجيل دخول لاحق', async () => {
    const first = await standalone();
    TestBed.inject(HttpTestingController).match('/api/admin/results')
      .forEach((request) => request.flush(UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' }));
    await drain();
    first.destroy();
    const fixture = TestBed.createComponent(WinnersPlaceholderComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/results').flush(results('digital', [9, 7, 5]));
    await drain();
    http.match('/api/admin/me').forEach((request) => request.flush({ authenticated: true }));
    await drain(); await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('button.admin-return')).not.toBeNull();
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
