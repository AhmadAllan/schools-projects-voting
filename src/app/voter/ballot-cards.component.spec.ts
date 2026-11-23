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

describe('صفحة الاقتراع', () => {
  async function render(inputs: { ballot?: Ballot | null; selections?: Selection[]; loading?: boolean; error?: string } = {}) {
    const fixture = TestBed.createComponent(BallotCardsComponent);
    fixture.componentRef.setInput('ballot', inputs.ballot ?? null);
    fixture.componentRef.setInput('selections', inputs.selections ?? []);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? '');
    await fixture.whenStable();
    return fixture;
  }

  function cardEls(el: HTMLElement) { return Array.from(el.querySelectorAll('app-project-card')); }
  function cardsByName(el: HTMLElement, name: string) { return cardEls(el).filter((c) => c.textContent?.includes(name)); }
  function voteButton(card: Element) { return card.querySelector<HTMLButtonElement>('button.vote-btn')!; }
  function tabButtons(el: HTMLElement) { return Array.from(el.querySelectorAll<HTMLButtonElement>('.filter-tabs button')); }
  function searchInput(el: HTMLElement) { return el.querySelector<HTMLInputElement>('input[type="search"]')!; }
  function sortSelect(el: HTMLElement) { return el.querySelector<HTMLSelectElement>('select')!; }

  async function type(fixture: { whenStable: () => Promise<unknown> }, input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('يعرض حالة التحميل', async () => {
    const el = (await render({ loading: true, ballot: BALLOT })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('جارٍ تحميل المشاريع…');
    expect(el.querySelector('app-project-card')).toBeNull();
  });

  it('يعرض الخطأ وزر إعادة المحاولة', async () => {
    const fixture = await render({ error: 'تعذر تحميل المشاريع.' });
    const retried: number[] = [];
    fixture.componentInstance.retry.subscribe(() => retried.push(1));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('تعذر تحميل المشاريع.');
    const retry = Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'إعادة المحاولة')!;
    retry.click();
    expect(retried.length).toBe(1);
  });

  it('يعرض حالة الفراغ عند اقتراع بلا مشاريع', async () => {
    const el = (await render({ ballot: { sections: [], projects: [] } })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('لا توجد مشاريع بعد.');
  });

  it('يعرض تبويبات مع عدد المشاريع لكل فئة', async () => {
    const el = (await render({ ballot: BALLOT })).nativeElement as HTMLElement;
    const tabs = tabButtons(el);
    expect(tabs.length).toBe(5);
    expect(tabs[0].textContent).toContain('الكل');
    expect(tabs[0].textContent).toContain('5');
    const robots = tabs.find((t) => t.textContent?.includes('الروبوتات'))!;
    expect(robots.textContent).toContain('2');
  });

  it('اختيار تبويب فئة يعرض مشاريعها فقط', async () => {
    const fixture = await render({ ballot: BALLOT });
    const el = fixture.nativeElement as HTMLElement;
    expect(cardEls(el).length).toBe(5);
    tabButtons(el).find((t) => t.textContent?.includes('الروبوتات'))!.click();
    await fixture.whenStable();
    expect(cardEls(el).length).toBe(2);
    expect(cardEls(el).every((c) => c.textContent?.includes('الروبوتات'))).toBe(true);
  });

  it('البحث يرشّح بالاسم والمدرسة ويتجاهل الفراغات الزائدة', async () => {
    const fixture = await render({ ballot: BALLOT });
    const el = fixture.nativeElement as HTMLElement;
    await type(fixture, searchInput(el), 'مشروع الشمس');
    expect(cardEls(el).length).toBe(1);
    expect(cardsByName(el, 'مشروع الشمس').length).toBe(1);
    await type(fixture, searchInput(el), '  مشروع   القمر ');
    expect(cardsByName(el, 'مشروع القمر').length).toBe(1);
    await type(fixture, searchInput(el), 'مدرسة النهى');
    expect(cardsByName(el, 'مشروع المريخ').length).toBe(1);
    await type(fixture, searchInput(el), 'كلمة غير موجودة');
    expect(el.textContent).toContain('لا توجد نتائج مطابقة لبحثك');
    await type(fixture, searchInput(el), '');
    expect(cardEls(el).length).toBe(5);
  });

  it('أعداد التبويبات لا تتأثر بالبحث', async () => {
    const fixture = await render({ ballot: BALLOT });
    const el = fixture.nativeElement as HTMLElement;
    await type(fixture, searchInput(el), 'مشروع الشمس');
    const tabs = tabButtons(el);
    expect(tabs[0].textContent).toContain('5');
    expect(tabs.find((t) => t.textContent?.includes('الروبوتات'))!.textContent).toContain('2');
  });

  it('الترتيب الأبجدي يرتّب المشاريع بالاسم', async () => {
    const fixture = await render({ ballot: BALLOT });
    const el = fixture.nativeElement as HTMLElement;
    sortSelect(el).value = 'name';
    sortSelect(el).dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const names = cardEls(el).map((c) => c.querySelector('h3')?.textContent?.trim());
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'ar'));
    expect(names).toEqual(sorted);
  });

  it('العدّاد الحي وتنبيه الحد الأقصى عند 3 اختيارات', async () => {
    const open = (await render({ ballot: BALLOT, selections: FULL_SELECTIONS })).nativeElement as HTMLElement;
    expect(open.textContent).toContain('الأصوات المستخدمة: 3 من 3');
    const notice = open.querySelector('.limit-notice');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('وصلت إلى الحد الأقصى (3 أصوات)');
    const moon = cardsByName(open, 'مشروع القمر')[0];
    const rocket = cardsByName(open, 'مشروع الصاروخ')[0];
    expect(voteButton(rocket).disabled).toBe(true);
    expect(voteButton(moon).disabled).toBe(false);
    const partial = (await render({ ballot: BALLOT, selections: FULL_SELECTIONS.slice(0, 2) })).nativeElement as HTMLElement;
    expect(partial.querySelector('.limit-notice')).toBeNull();
    expect(voteButton(cardsByName(partial, 'مشروع الصاروخ')[0]).disabled).toBe(false);
  });

  it('نافذة التفاصيل تعرض المشروع وإغلاقها لا يبدّل الاختيار', async () => {
    const fixture = await render({ ballot: BALLOT, selections: [{ sectionId: 1, projectId: 11 }] });
    const toggles: Selection[] = [];
    fixture.componentInstance.toggle.subscribe((selection) => toggles.push(selection));
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('app-project-details-dialog')!;
    expect((dialog as HTMLElement).textContent).not.toContain('مشروع القمر');
    Array.from(cardsByName(el, 'مشروع القمر')[0].querySelectorAll('button')).find((b) => b.textContent?.trim() === 'التفاصيل')!.click();
    await fixture.whenStable();
    expect((dialog as HTMLElement).textContent).toContain('مشروع القمر');
    Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'إغلاق')!.click();
    await fixture.whenStable();
    expect(toggles.length).toBe(0);
  });

  it('زر التصويت يرسل القسم والمشروع حتى من الفئة نفسها', async () => {
    const fixture = await render({ ballot: BALLOT });
    const emitted: Selection[] = [];
    fixture.componentInstance.toggle.subscribe((selection) => emitted.push(selection));
    const el = fixture.nativeElement as HTMLElement;
    voteButton(cardsByName(el, 'مشروع القمر')[0]).click();
    voteButton(cardsByName(el, 'مشروع المريخ')[0]).click();
    expect(emitted).toEqual([
      { sectionId: 1, projectId: 11 },
      { sectionId: 1, projectId: 12 },
    ]);
  });
});
