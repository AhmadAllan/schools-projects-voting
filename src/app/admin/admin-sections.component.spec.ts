import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminSectionsComponent } from './admin-sections.component';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('صفحة الأقسام — التعديل', () => {
  const row = { id: 3, name: 'الروبوتات', description: 'وصف', sort_order: 2, is_active: 1 };

  async function setup(): Promise<{ fixture: ComponentFixture<AdminSectionsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminSectionsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/sections').flush([row]);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AdminSectionsComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));

  it('يفتح نافذة تعديل مملوءة بالقيم الحالية', async () => {
    const { fixture } = await setup();
    ((fixture.nativeElement as HTMLElement).querySelectorAll('tbody .btn')[0] as HTMLElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(fixture.componentInstance.editForm.getRawValue()).toEqual({ name: 'الروبوتات', description: 'وصف', sortOrder: 2 });
  });

  it('يحفظ التعديل عبر PUT ثم يغلق النافذة ويُعيد التحميل', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(row as any);
    fixture.componentInstance.editForm.setValue({ name: 'الروبوتات المتقدمة', description: 'وصف جديد', sortOrder: 5 });
    // لا تنتظر saveEdit قبل flush: هي تنتظر إعادة التحميل نفسها
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/sections/3' });
    expect(req.request.body).toEqual({ name: 'الروبوتات المتقدمة', description: 'وصف جديد', sort_order: 5 });
    req.flush({ error: 'OK', message: 'تم تحديث القسم' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/admin/sections').flush([row]);
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('يرفض الحفظ باسم فارغ دون إرسال طلب', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(row as any);
    fixture.componentInstance.editForm.setValue({ name: '   ', description: '', sortOrder: 0 });
    expect(fixture.componentInstance.editForm.invalid).toBe(true);
    http.verify();
  });

  it('يعرض خطأ الحفظ داخل النافذة ويبقيها مفتوحة', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(row as any);
    fixture.componentInstance.editForm.setValue({ name: 'الروبوتات المتقدمة', description: 'وصف جديد', sortOrder: 5 });
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/sections/3' });
    req.flush({ error: 'VALIDATION_ERROR', message: 'بيانات القسم غير صالحة' }, { status: 422, statusText: 'Unprocessable Entity' });
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('.admin-error')?.textContent).toContain('تعذر تحديث القسم');
  });

  const secondRow = { id: 4, name: 'الطاقة', description: '', sort_order: 3, is_active: 1 };
  const rows = [row, secondRow];
  const previewBody = { error: 'OK', items: [{ id: 3, name: 'الروبوتات' }, { id: 4, name: 'الطاقة' }], projects: [{ id: 101, name: 'مشروع القمر', context: 'مدرسة النور / قسم الروبوتات' }], votes: 7 };

  async function setupTwo(): Promise<{ fixture: ComponentFixture<AdminSectionsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminSectionsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/sections').flush(rows);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function rowCheckboxes(el: HTMLElement) { return Array.from(el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')); }
  function headerCheckbox(el: HTMLElement) { return el.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!; }
  async function settle(fixture: ComponentFixture<AdminSectionsComponent>) { await new Promise((resolve) => setTimeout(resolve)); await fixture.whenStable(); fixture.detectChanges(); }

  it('تحديد الكل يفحص كل الصفوف ويظهر زر الحذف الجماعي بعدد المحدد', async () => {
    const { fixture } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('حذف المحدد');
    headerCheckbox(el).click();
    await settle(fixture);
    expect(rowCheckboxes(el).every((checkbox) => checkbox.checked)).toBe(true);
    expect(el.textContent).toContain('حذف المحدد (2)');
    headerCheckbox(el).click();
    await settle(fixture);
    expect(rowCheckboxes(el).every((checkbox) => !checkbox.checked)).toBe(true);
    expect(el.textContent).not.toContain('حذف المحدد');
  });

  it('زر صف واحد يحدده وحده', async () => {
    const { fixture } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    rowCheckboxes(el)[1]!.click();
    await settle(fixture);
    expect(rowCheckboxes(el)[0]!.checked).toBe(false);
    expect(rowCheckboxes(el)[1]!.checked).toBe(true);
    expect(el.textContent).toContain('حذف المحدد (1)');
  });

  it('الحذف الجماعي: معاينة ثم تأكيد كتابي ثم حذف وإعادة تحميل وملخص', async () => {
    const { fixture, http } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    headerCheckbox(el).click();
    await settle(fixture);
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('حذف المحدد'))!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/sections/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [3, 4] });
    preview.flush(previewBody);
    await settle(fixture);
    const dialog = el.querySelector('dialog.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('مشروع القمر');
    expect(dialog.textContent).toContain('لا يمكن التراجع');
    const word = dialog.querySelector<HTMLInputElement>('label.confirm-word input')!;
    word.value = 'تأكيد';
    word.dispatchEvent(new Event('input'));
    await settle(fixture);
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('حذف نهائي'))!.click();
    const bulk = http.expectOne({ method: 'POST', url: '/api/admin/sections/delete-bulk' });
    expect(bulk.request.body).toEqual({ ids: [3, 4] });
    bulk.flush({ error: 'OK', message: 'تم', deleted: { sections: 2, schools: 0, projects: 1, votes: 7 } });
    await settle(fixture);
    http.expectOne('/api/admin/sections').flush([secondRow]);
    await settle(fixture);
    expect(dialog.open).toBe(false);
    expect(el.textContent).toContain('تم حذف 2 قسم، 1 مشروع، 7 صوت');
    expect(el.textContent).not.toContain('حذف المحدد');
  });

  it('زر حذف الصف يمر بالمعاينة بمعرف واحد', async () => {
    const { fixture, http } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button')).find((button) => button.textContent?.trim() === 'حذف')!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/sections/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [3] });
    preview.flush({ error: 'OK', items: [{ id: 3, name: 'الروبوتات' }], projects: [], votes: 0 });
    await settle(fixture);
    const dialog = el.querySelector('dialog.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('لا توجد مشاريع مرتبطة بها');
  });
});
