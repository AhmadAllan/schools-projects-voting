import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HomeShellComponent } from './home-shell.component';

const BALLOT = { sections: [{ id: 1, name: 'الروبوتات', sort_order: 1 }], projects: [{ id: 11, name: 'مشروع القمر', description: 'وصف', section_id: 1, school_name: 'مدرسة النور' }] };
const RESULTS = { source: 'digital', sections: [{ section_id: 1, section_name: 'الروبوتات', projects: [{ project_id: 11, project_name: 'مشروع القمر', school_name: 'مدرسة النور', image_url: null, votes: 9 }], tiedProjects: [] }] };
const UNPUBLISHED = { error: 'RESULTS_NOT_PUBLISHED', message: 'النتائج غير منشورة بعد' } as const;

async function drain() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe('الشاشة الرئيسية بتبويبين', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  function tabButton(fixture: { nativeElement: HTMLElement }, label: string) {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.trim() === label)!;
  }

  async function openWinnersTab(fixture: { nativeElement: HTMLElement; whenStable: () => Promise<unknown> }) {
    tabButton(fixture, 'الفائزون').click();
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/me').flush({ authenticated: true });
    await drain();
    http.expectOne('/api/public/results').flush(RESULTS);
    await drain();
    await fixture.whenStable();
  }

  it('التبويب الافتراضي هو التصويت', async () => {
    const fixture = TestBed.createComponent(HomeShellComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/public/ballot').flush(BALLOT);
    await drain(); await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('منافسة المشاريع المدرسية: التصويت');
    expect(el.querySelector('app-winners')).toBeNull();
  });

  it('تبويب الفائزين يعرض شاشة الفائزين المدمجة', async () => {
    const fixture = TestBed.createComponent(HomeShellComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/public/ballot').flush(BALLOT);
    await drain(); await fixture.whenStable();
    await openWinnersTab(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('.winner-card')).not.toBeNull();
  });

  it('التبويب يتبع حالة النشر حتى للمدير', async () => {
    const fixture = TestBed.createComponent(HomeShellComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/public/ballot').flush(BALLOT);
    await drain(); await fixture.whenStable();
    tabButton(fixture, 'الفائزون').click();
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/me').flush({ authenticated: true });
    await drain();
    http.expectOne('/api/public/results').flush(UNPUBLISHED, { status: 403, statusText: 'Forbidden' });
    await drain(); await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ما زال التصويت جاريًا');
    http.verify();
  });

  it('العودة إلى تبويب التصويت تحافظ على بيانات الناخب', async () => {
    const fixture = TestBed.createComponent(HomeShellComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/public/ballot').flush(BALLOT);
    await drain(); await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.project-card')!.click();
    await fixture.whenStable();
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'متابعة')!.click();
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.value = 'سارة';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await openWinnersTab(fixture);
    tabButton(fixture, 'التصويت').click();
    await fixture.whenStable();
    http.expectOne('/api/public/ballot').flush(BALLOT);
    await drain(); await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!.value).toBe('سارة');
  });
});
