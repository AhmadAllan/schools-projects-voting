import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminSchoolsComponent } from './admin-schools.component';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('صفحة المدارس — الحذف المتسلسل', () => {
  const rows = [
    { id: 10, name: 'مدرسة النور' },
    { id: 11, name: 'مدرسة السلام' },
  ];

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AdminSchoolsComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));

  async function setup(): Promise<{ fixture: ComponentFixture<AdminSchoolsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminSchoolsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/schools').flush(rows);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function rowCheckboxes(el: HTMLElement) { return Array.from(el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')); }
  function headerCheckbox(el: HTMLElement) { return el.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!; }
  async function settle(fixture: ComponentFixture<AdminSchoolsComponent>) { await new Promise((resolve) => setTimeout(resolve)); await fixture.whenStable(); fixture.detectChanges(); }

  it('تحديد الكل يظهر زر الحذف بعدد المحدد', async () => {
    const { fixture } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    headerCheckbox(el).click();
    await settle(fixture);
    expect(rowCheckboxes(el).every((checkbox) => checkbox.checked)).toBe(true);
    expect(el.textContent).toContain('حذف المحدد (2)');
  });

  it('الحذف الجماعي: معاينة تعرض المشاريع الساقطة ثم الحذف والملخص', async () => {
    const { fixture, http } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    headerCheckbox(el).click();
    await settle(fixture);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('حذف المحدد'))!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/schools/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [10, 11] });
    preview.flush({ error: 'OK', items: rows.map(({ id, name }) => ({ id, name })), projects: [{ id: 101, name: 'مشروع القمر', context: 'مدرسة النور / قسم الروبوتات' }], votes: 5 });
    await settle(fixture);
    const dialog = el.querySelector('dialog.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('مشروع القمر');
    expect(dialog.textContent).toContain('5 صوت');
    const word = dialog.querySelector<HTMLInputElement>('label.confirm-word input')!;
    word.value = 'تأكيد';
    word.dispatchEvent(new Event('input'));
    await settle(fixture);
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('حذف نهائي'))!.click();
    const bulk = http.expectOne({ method: 'POST', url: '/api/admin/schools/delete-bulk' });
    expect(bulk.request.body).toEqual({ ids: [10, 11] });
    bulk.flush({ error: 'OK', message: 'تم', deleted: { sections: 0, schools: 2, projects: 1, votes: 5 } });
    await settle(fixture);
    http.expectOne('/api/admin/schools').flush([]);
    await settle(fixture);
    expect(dialog.open).toBe(false);
    expect(el.textContent).toContain('تم حذف 2 مدرسة، 1 مشروع، 5 صوت');
    expect(el.textContent).not.toContain('حذف المحدد');
  });

  it('زر حذف الصف يمر بالمعاينة بمعرف واحد', async () => {
    const { fixture, http } = await setup();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button')).find((button) => button.textContent?.trim() === 'حذف')!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/schools/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [10] });
    preview.flush({ error: 'OK', items: [{ id: 10, name: 'مدرسة النور' }], projects: [], votes: 0 });
    await settle(fixture);
    expect((el.querySelector('dialog.delete-dialog') as HTMLDialogElement).open).toBe(true);
  });
});
