import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminSchoolsComponent } from './admin-schools.component';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('صفحة المدارس — التعديل', () => {
  const school = { id: 2, name: 'مدرسة الأمل' };

  async function setup(): Promise<{ fixture: ComponentFixture<AdminSchoolsComponent>; http: HttpTestingController }> {
    const fixture = TestBed.createComponent(AdminSchoolsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/admin/schools').flush([school]);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AdminSchoolsComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));

  it('يفتح نافذة تعديل المدرسة مملوءة', async () => {
    const { fixture } = await setup();
    ((fixture.nativeElement as HTMLElement).querySelectorAll('tbody .btn')[0] as HTMLElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(fixture.componentInstance.editForm.getRawValue()).toEqual({ name: 'مدرسة الأمل' });
  });

  it('يحفظ الاسم الجديد عبر PUT', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(school as any);
    fixture.componentInstance.editForm.setValue({ name: 'مدرسة النور' });
    // لا تنتظر saveEdit قبل flush: هي تنتظر إعادة التحميل نفسها
    const saving = fixture.componentInstance.saveEdit(new Event('submit'));
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/schools/2' });
    expect(req.request.body).toEqual({ name: 'مدرسة النور' });
    req.flush({ error: 'OK', message: 'تم تحديث المدرسة' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/admin/schools').flush([school]);
    await saving;
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('زر الإلغاء يغلق دون أي طلب', async () => {
    const { fixture, http } = await setup();
    fixture.componentInstance.edit(school as any);
    fixture.detectChanges();
    const cancel = (fixture.nativeElement as HTMLElement).querySelector('dialog .dialog-actions .btn') as HTMLElement;
    cancel.click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
    http.verify();
  });
});
