import { TestBed } from '@angular/core/testing';
import { BulkDeleteDialogComponent } from './bulk-delete-dialog.component';
import { DeletePreview } from '../core/models';

const PREVIEW: DeletePreview = {
  items: [
    { id: 1, name: 'الروبوتات' },
    { id: 2, name: 'الطاقة' },
  ],
  projects: [
    { id: 101, name: 'مشروع القمر', context: 'مدرسة النور / قسم الروبوتات' },
    { id: 103, name: 'مشروع الرياح', context: 'مدرسة النور / قسم الطاقة' },
  ],
  votes: 7,
};

describe('نافذة تحذير الحذف المتسلسل', () => {
  async function render(inputs: { loading?: boolean; preview?: DeletePreview | null; busy?: boolean; error?: string } = {}) {
    const fixture = TestBed.createComponent(BulkDeleteDialogComponent);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    fixture.componentRef.setInput('preview', inputs.preview ?? null);
    fixture.componentRef.setInput('busy', inputs.busy ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? '');
    await fixture.whenStable();
    return fixture;
  }

  it('أثناء المعاينة تعرض حالة الحساب بلا زر حذف', async () => {
    const el = (await render({ loading: true, preview: PREVIEW })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('جارٍ حساب ما سيُحذف');
    expect(Array.from(el.querySelectorAll('button')).some((button) => button.textContent?.includes('حذف نهائي'))).toBe(false);
  });

  it('تعرض العناصر والمشاريع الساقطة وعدد الأصوات والتحذير', async () => {
    const el = (await render({ preview: PREVIEW })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('الروبوتات');
    expect(el.textContent).toContain('مشروع القمر');
    expect(el.textContent).toContain('مدرسة النور / قسم الروبوتات');
    expect(el.textContent).toContain('7');
    expect(el.textContent).toContain('لا يمكن التراجع');
  });

  it('زر الحذف يبقى معطلًا حتى كتابة كلمة تأكيد', async () => {
    const fixture = await render({ preview: PREVIEW });
    const el = fixture.nativeElement as HTMLElement;
    const wordInput = el.querySelector<HTMLInputElement>('label.confirm-word input')!;
    const deleteButton = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('حذف نهائي'))!;
    expect(deleteButton.disabled).toBe(true);
    wordInput.value = 'تأكيد';
    wordInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(deleteButton.disabled).toBe(false);
  });

  it('زر الحذف معطل أثناء تنفيذ الحذف', async () => {
    const fixture = await render({ preview: PREVIEW, busy: true });
    const el = fixture.nativeElement as HTMLElement;
    const wordInput = el.querySelector<HTMLInputElement>('label.confirm-word input')!;
    wordInput.value = 'تأكيد';
    wordInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const deleteButton = Array.from(el.querySelectorAll<HTMLButtonElement>('button.btn.danger')).find((button) => button.closest('.dialog-actions'))!;
    expect(deleteButton.disabled).toBe(true);
  });

  it('الإقرار يبث بعد كتابة التأكيد والإلغاء يبث عند الضغط', async () => {
    const fixture = await render({ preview: PREVIEW });
    const confirmed: number[] = [];
    const cancelled: number[] = [];
    fixture.componentInstance.confirmed.subscribe(() => confirmed.push(1));
    fixture.componentInstance.cancelled.subscribe(() => cancelled.push(1));
    const el = fixture.nativeElement as HTMLElement;
    const wordInput = el.querySelector<HTMLInputElement>('label.confirm-word input')!;
    wordInput.value = 'تأكيد';
    wordInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('حذف نهائي'))!.click();
    expect(confirmed.length).toBe(1);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'إلغاء')!.click();
    expect(cancelled.length).toBe(1);
  });

  it('open/close يتحكمان بالنافذة', async () => {
    const fixture = await render({ preview: PREVIEW });
    const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>('dialog')!;
    fixture.componentInstance.open();
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    fixture.componentInstance.close();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });
});
