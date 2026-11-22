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
});
