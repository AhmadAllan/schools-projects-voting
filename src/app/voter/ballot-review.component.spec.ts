import { TestBed } from '@angular/core/testing';
import { BallotReviewComponent, parseSubmitError, ReviewItem, SubmitError } from './ballot-review.component';
import { Selection } from '../core/models';

const ITEMS: ReviewItem[] = [
  { selection: { sectionId: 1, projectId: 11 }, sectionName: 'الروبوتات', projectName: 'مشروع القمر', schoolName: 'مدرسة النور' },
  { selection: { sectionId: 2, projectId: 21 }, sectionName: 'الطاقة', projectName: 'مشروع الشمس', schoolName: 'مدرسة السلام' },
];

describe('شاشة مراجعة الاختيارات', () => {
  async function render(inputs: { items?: ReviewItem[]; submitting?: boolean; submitError?: SubmitError | null } = {}) {
    const fixture = TestBed.createComponent(BallotReviewComponent);
    fixture.componentRef.setInput('items', inputs.items ?? ITEMS);
    fixture.componentRef.setInput('submitting', inputs.submitting ?? false);
    fixture.componentRef.setInput('submitError', inputs.submitError ?? null);
    await fixture.whenStable();
    return fixture;
  }

  it('يعرض أسماء الأقسام والمشاريع والمدارس لكل اختيار', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll('ol li'));
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('مشروع القمر');
    expect(items[0].textContent).toContain('الروبوتات');
    expect(items[0].textContent).toContain('مدرسة النور');
  });

  it('خطأ الإرسال يظهر برسالة الخادم', async () => {
    const el = (await render({ submitError: { message: 'من الخادم', duplicate: false } })).nativeElement as HTMLElement;
    const error = el.querySelector<HTMLElement>('.submit-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('من الخادم');
    expect(el.textContent).not.toContain('متابعة رغم تطابق الاسم');
  });

  it('الخطأ المكرر يظهر زر المتابعة رغم التطابق', async () => {
    const fixture = await render({ submitError: { message: 'هذا الاسم سبق أن صوّت.', duplicate: true } });
    const confirmed: number[] = [];
    fixture.componentInstance.confirmDuplicate.subscribe(() => confirmed.push(1));
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('متابعة رغم تطابق الاسم'))!;
    expect(button).toBeTruthy();
    button.click();
    expect(confirmed.length).toBe(1);
  });

  it('زر التأكيد معطّل أثناء الإرسال', async () => {
    const el = (await render({ submitting: true })).nativeElement as HTMLElement;
    const confirm = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('تأكيد وإرسال'))!;
    expect(confirm.disabled).toBe(true);
  });

  it('parseSubmitError يتعرف على خطأ الاسم المكرر والرسائل العامة', () => {
    expect(parseSubmitError({ error: { error: 'DUPLICATE_NAME', message: 'مكرر' } })).toEqual({ message: 'مكرر', duplicate: true });
    expect(parseSubmitError({ error: { error: 'VALIDATION_ERROR', message: 'آخر' } })).toEqual({ message: 'آخر', duplicate: false });
    expect(parseSubmitError(new Error('network'))).toEqual({ message: 'تعذر إرسال الأصوات. حاول مرة أخرى.', duplicate: false });
  });

  it('زر الإزالة يرسل اختيار العنصر نفسه', async () => {
    const fixture = await render();
    const removed: Selection[] = [];
    fixture.componentInstance.remove.subscribe((selection) => removed.push(selection));
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent?.trim() === 'إزالة');
    expect(buttons.length).toBe(2);
    buttons[0]!.click();
    expect(removed).toEqual([{ sectionId: 1, projectId: 11 }]);
  });

  it('زر التأكيد معطّل عند إزالة كل الاختيارات', async () => {
    const el = (await render({ items: [] })).nativeElement as HTMLElement;
    const confirm = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('تأكيد وإرسال'))!;
    expect(confirm.disabled).toBe(true);
  });

  it('زر الرجوع والخلفية يرسلان back', async () => {
    const fixture = await render();
    const backs: void[] = [];
    fixture.componentInstance.back.subscribe(() => backs.push(undefined));
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('رجوع للتعديل'))!.click();
    expect(backs.length).toBe(1);
    (el.querySelector('.scrim') as HTMLElement).click();
    expect(backs.length).toBe(2);
  });

  it('مفتاح Escape يغلق الدرج بزر الرجوع للتعديل', async () => {
    const fixture = await render();
    const backs: void[] = [];
    fixture.componentInstance.back.subscribe(() => backs.push(undefined));
    const drawer = (fixture.nativeElement as HTMLElement).querySelector('.drawer')!;
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(backs.length).toBe(1);
  });

  it('زر الرجوع للتعديل يستقبل التركيز عند فتح الدرج', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    const close = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('رجوع للتعديل'))!;
    expect(close.hasAttribute('autofocus')).toBe(true);
  });
});
