import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminProjectsComponent } from './admin-projects.component';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('صفحة المشاريع — التعديل', () => {
  const project = {
    id: 9, name: 'مشروع الروبوت', description: 'وصف', image_id: null, image_url: null, url: null,
    section_id: 1, school_id: 2, section_name: 'التقنية', school_name: 'مدرسة الأمل',
    sort_order: 0, is_active: 1, written_votes: 0, announce_in_results: 1,
  };
  const sections = [{ id: 1, name: 'التقنية', description: null, sort_order: 0, is_active: 1 }];
  const schools = [{ id: 2, name: 'مدرسة الأمل' }, { id: 4, name: 'مدرسة النور' }];

  async function setup(): Promise<{ fixture: ComponentFixture<AdminProjectsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminProjectsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/projects').flush([project]);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AdminProjectsComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));

  it('يفتح نافذة تعديل المشروع مملوءة', async () => {
    const { fixture } = await setup();
    ((fixture.nativeElement as HTMLElement).querySelectorAll('tbody .btn')[0] as HTMLElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(fixture.componentInstance.editForm.getRawValue()).toEqual({
      name: 'مشروع الروبوت', description: 'وصف', sectionId: 1, schoolId: 2, url: '', imageUrl: '',
    });
    expect(fixture.componentInstance.editFile()).toBeNull();
  });

  it('ينقل المشروع ويحدّث النصوص عبر PUT واحد', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(project as any);
    fixture.componentInstance.editForm.setValue({
      name: 'روبوت متقدم', description: 'وصف جديد', sectionId: 3, schoolId: 4, url: 'https://example.com', imageUrl: '',
    });
    // لا تنتظر saveEdit قبل flush: هي تنتظر إعادة التحميل نفسها
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/projects/9' });
    expect(req.request.body).toEqual({
      name: 'روبوت متقدم', description: 'وصف جديد', section_id: 3, school_id: 4,
      url: 'https://example.com', image_url: '',
    });
    expect(req.request.body).not.toHaveProperty('image_id');
    req.flush({ error: 'OK', message: 'تم تحديث المشروع' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/admin/projects').flush([project]);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('يرفض الحفظ باسم فارغ دون إرسال طلب', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(project as any);
    fixture.componentInstance.editForm.setValue({
      name: '   ', description: 'وصف', sectionId: 1, schoolId: 2, url: '', imageUrl: '',
    });
    expect(fixture.componentInstance.editForm.invalid).toBe(true);
    http.verify();
  });

  it('يرفع الصورة الجديدة ويرسل image_id ويمحو image_url القديمة', async () => {
    const withUrl = { ...project, image_url: 'https://old.example/i.png' };
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(withUrl as any);
    fixture.componentInstance.editFile.set(new File([new Uint8Array([1])], 'new.png', { type: 'image/png' }));
    fixture.componentInstance.editForm.setValue({
      name: 'روبوت متقدم', description: 'وصف جديد', sectionId: 1, schoolId: 2,
      url: '', imageUrl: 'https://old.example/i.png',
    });
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const upload = http.expectOne({ method: 'POST', url: '/api/admin/images' });
    upload.flush({ id: 42 });
    await new Promise((resolve) => setTimeout(resolve));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/projects/9' });
    expect(req.request.body).toMatchObject({ image_id: 42, image_url: '' });
    req.flush({ error: 'OK', message: 'تم تحديث المشروع' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/admin/projects').flush([project]);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('يمسح حقل ملف التعديل عند إعادة فتح النافذة', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.edit(project as any);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('dialog input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'value', { value: 'C:\\fake\\old.png', writable: true, configurable: true });
    expect(input.value).toBe('C:\\fake\\old.png');
    fixture.componentInstance.edit(project as any);
    expect(input.value).toBe('');
  });

  it('يمسح حقل ملف الإضافة بعد نجاح الإضافة', async () => {
    const { fixture, http } = await setup();
    const comp = fixture.componentInstance;
    comp.form.setValue({ name: 'مشروع جديد', description: 'وصف', sectionId: 1, schoolId: 2, url: '', imageUrl: '' });
    comp.file.set(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    const input = (fixture.nativeElement as HTMLElement).querySelector('main > form input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'value', { value: 'C:\\fake\\a.png', writable: true, configurable: true });
    const adding = comp.add();
    const upload = http.expectOne({ method: 'POST', url: '/api/admin/images' });
    upload.flush({ id: 7 });
    await new Promise((resolve) => setTimeout(resolve));
    const req = http.expectOne({ method: 'POST', url: '/api/admin/projects' });
    req.flush({ error: 'OK', message: 'تمت إضافة المشروع' }, { status: 201, statusText: 'Created' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/admin/projects').flush([project]);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await adding;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(comp.file()).toBeNull();
  });

  it('يعرض خطأ الحفظ داخل النافذة ويبقيها مفتوحة', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(project as any);
    fixture.componentInstance.editForm.setValue({
      name: 'روبوت متقدم', description: 'وصف جديد', sectionId: 1, schoolId: 2, url: '', imageUrl: '',
    });
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/projects/9' });
    req.flush({ error: 'VALIDATION_ERROR', message: 'بيانات المشروع غير صالحة' }, { status: 422, statusText: 'Unprocessable Entity' });
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('.admin-error')?.textContent).toContain('تعذر تحديث المشروع');
  });

  const secondProject = { ...project, id: 12, name: 'مشروع الطاقة الشمسية', section_id: 1, school_id: 4, school_name: 'مدرسة النور' };
  const projectsRows = [project, secondProject];

  async function setupTwo(): Promise<{ fixture: ComponentFixture<AdminProjectsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminProjectsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/projects').flush(projectsRows);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  function rowCheckboxes(el: HTMLElement) { return Array.from(el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')); }
  function headerCheckbox(el: HTMLElement) { return el.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!; }
  async function settle(fixture: ComponentFixture<AdminProjectsComponent>) { await new Promise((resolve) => setTimeout(resolve)); await fixture.whenStable(); fixture.detectChanges(); }

  it('الحذف الجماعي: معاينة بأصوات المشاريع ثم تأكيد كتابي ثم حذف وملخص', async () => {
    const { fixture, http } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    headerCheckbox(el).click();
    await settle(fixture);
    expect(el.textContent).toContain('حذف المحدد (2)');
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('حذف المحدد'))!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/projects/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [9, 12] });
    preview.flush({ error: 'OK', items: [{ id: 9, name: 'مشروع الروبوت' }, { id: 12, name: 'مشروع الطاقة الشمسية' }], projects: [{ id: 9, name: 'مشروع الروبوت', context: 'مدرسة الأمل / قسم التقنية' }, { id: 12, name: 'مشروع الطاقة الشمسية', context: 'مدرسة النور / قسم التقنية' }], votes: 9 });
    await settle(fixture);
    const dialog = el.querySelector('dialog.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('مشروع الطاقة الشمسية');
    expect(dialog.textContent).toContain('9 صوت');
    const word = dialog.querySelector<HTMLInputElement>('label.confirm-word input')!;
    word.value = 'تأكيد';
    word.dispatchEvent(new Event('input'));
    await settle(fixture);
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('حذف نهائي'))!.click();
    const bulk = http.expectOne({ method: 'POST', url: '/api/admin/projects/delete-bulk' });
    expect(bulk.request.body).toEqual({ ids: [9, 12] });
    bulk.flush({ error: 'OK', message: 'تم', deleted: { sections: 0, schools: 0, projects: 2, votes: 9 } });
    await settle(fixture);
    http.expectOne('/api/admin/projects').flush([]);
    http.expectOne('/api/admin/sections').flush(sections);
    http.expectOne('/api/admin/schools').flush(schools);
    await settle(fixture);
    expect(dialog.open).toBe(false);
    expect(el.textContent).toContain('تم حذف 2 مشروع، 9 صوت');
    expect(el.textContent).not.toContain('حذف المحدد');
  });

  it('زر حذف الصف يمر بالمعاينة بمعرف واحد', async () => {
    const { fixture, http } = await setupTwo();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button')).find((button) => button.textContent?.trim() === 'حذف')!.click();
    const preview = http.expectOne({ method: 'POST', url: '/api/admin/projects/delete-preview' });
    expect(preview.request.body).toEqual({ ids: [9] });
    preview.flush({ error: 'OK', items: [{ id: 9, name: 'مشروع الروبوت' }], projects: [{ id: 9, name: 'مشروع الروبوت', context: 'مدرسة الأمل / قسم التقنية' }], votes: 3 });
    await settle(fixture);
    const dialog = el.querySelector('dialog.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('3 صوت');
  });
});
