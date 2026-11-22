import { TestBed } from '@angular/core/testing';
import { BallotCardsComponent } from './ballot-cards.component';
import { Ballot, Selection } from '../core/models';

const BALLOT: Ballot = {
  sections: [
    { id: 1, name: 'الروبوتات', sort_order: 1 },
    { id: 2, name: 'الطاقة', sort_order: 2 },
    { id: 3, name: 'الزراعة', sort_order: 3 },
    { id: 4, name: 'الفضاء', sort_order: 4 },
  ],
  projects: [
    { id: 11, name: 'مشروع القمر', description: 'وصف', section_id: 1, school_name: 'مدرسة النور' },
    { id: 12, name: 'مشروع المريخ', description: 'وصف', section_id: 1, school_name: 'مدرسة النهى' },
    { id: 21, name: 'مشروع الشمس', description: 'وصف', section_id: 2, school_name: 'مدرسة السلام' },
    { id: 31, name: 'مشروع القمح', description: 'وصف', section_id: 3, school_name: 'مدرسة الأمل' },
    { id: 41, name: 'مشروع الصاروخ', description: 'وصف', section_id: 4, school_name: 'مدرسة الفتح' },
  ],
};

const FULL_SELECTIONS: Selection[] = [
  { sectionId: 1, projectId: 11 },
  { sectionId: 2, projectId: 21 },
  { sectionId: 3, projectId: 31 },
];

describe('بطاقات الاقتراع المشتركة', () => {
  async function render(inputs: { ballot?: Ballot | null; selections?: Selection[]; loading?: boolean; error?: string } = {}) {
    const fixture = TestBed.createComponent(BallotCardsComponent);
    fixture.componentRef.setInput('ballot', inputs.ballot ?? null);
    fixture.componentRef.setInput('selections', inputs.selections ?? []);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? '');
    await fixture.whenStable();
    return fixture;
  }

  function cards(el: HTMLElement) { return Array.from(el.querySelectorAll<HTMLButtonElement>('.project-card')); }

  it('يعرض حالة التحميل', async () => {
    const fixture = await render({ loading: true, ballot: BALLOT });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('جارٍ تحميل المشاريع…');
    expect(el.querySelector('.project-card')).toBeNull();
  });

  it('يعرض الخطأ وزر إعادة المحاولة', async () => {
    const fixture = await render({ error: 'تعذر تحميل المشاريع.' });
    const retried: number[] = [];
    fixture.componentInstance.retry.subscribe(() => retried.push(1));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('تعذر تحميل المشاريع.');
    const retry = Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'إعادة المحاولة')!;
    expect(retry).toBeTruthy();
    retry.click();
    expect(retried.length).toBe(1);
  });

  it('يعرض حالة الفراغ عند اقتراع بلا مشاريع', async () => {
    const fixture = await render({ ballot: { sections: [], projects: [] } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('لا توجد مشاريع بعد.');
  });

  it('البطاقة المختارة تحمل aria-pressed=true والأخرى false', async () => {
    const fixture = await render({ ballot: BALLOT, selections: [{ sectionId: 1, projectId: 11 }] });
    const el = fixture.nativeElement as HTMLElement;
    const moon = cards(el).find((card) => card.textContent?.includes('مشروع القمر'))!;
    const mars = cards(el).find((card) => card.textContent?.includes('مشروع المريخ'))!;
    expect(moon.getAttribute('aria-pressed')).toBe('true');
    expect(moon.classList.contains('selected')).toBe(true);
    expect(mars.getAttribute('aria-pressed')).toBe('false');
    expect(mars.classList.contains('selected')).toBe(false);
  });

  it('تعطيل بطاقات قسم رابع بعد 3 اختيارات', async () => {
    const fixture = await render({ ballot: BALLOT, selections: FULL_SELECTIONS });
    const el = fixture.nativeElement as HTMLElement;
    const rocket = cards(el).find((card) => card.textContent?.includes('مشروع الصاروخ'))!;
    const mars = cards(el).find((card) => card.textContent?.includes('مشروع المريخ'))!;
    expect(rocket.disabled).toBe(true);
    expect(mars.disabled).toBe(false);
  });

  it('النقر يرسل اختيار القسم والمشروع', async () => {
    const fixture = await render({ ballot: BALLOT });
    const emitted: Selection[] = [];
    fixture.componentInstance.toggle.subscribe((selection) => emitted.push(selection));
    cards(fixture.nativeElement as HTMLElement).find((card) => card.textContent?.includes('مشروع القمر'))!.click();
    expect(emitted).toEqual([{ sectionId: 1, projectId: 11 }]);
  });
});
