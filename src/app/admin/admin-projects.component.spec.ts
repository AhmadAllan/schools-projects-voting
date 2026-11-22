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
});
