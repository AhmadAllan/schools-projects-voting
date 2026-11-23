import { TestBed } from '@angular/core/testing';
import { MAX_VOTES, VoteCounterComponent } from './vote-counter.component';

describe('عدّاد الأصوات', () => {
  async function render(used: number) {
    const fixture = TestBed.createComponent(VoteCounterComponent);
    fixture.componentRef.setInput('used', used);
    await fixture.whenStable();
    return fixture;
  }

  it('يعرض عدد الأصوات المستخدمة من 3', async () => {
    const el = (await render(2)).nativeElement as HTMLElement;
    expect(el.textContent).toContain('الأصوات المستخدمة: 2 من 3');
  });

  it('يعرض النص في عنصر aria-live مهذّب', async () => {
    const el = (await render(0)).nativeElement as HTMLElement;
    const live = el.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('الأصوات المستخدمة: 0 من 3');
  });

  it('يملأ النقاط بعدد الأصوات المستخدمة فقط', async () => {
    const el = (await render(2)).nativeElement as HTMLElement;
    const dots = Array.from(el.querySelectorAll('span.dot'));
    expect(dots.length).toBe(3);
    expect(dots.filter((dot) => dot.classList.contains('on')).length).toBe(2);
  });

  it('الحد الأقصى 3 أصوات', () => {
    expect(MAX_VOTES).toBe(3);
  });
});
