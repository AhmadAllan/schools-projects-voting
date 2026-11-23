Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { afterEach, beforeEach, vi } from 'vitest';
import { KioskPlaceholderComponent } from './kiosk-placeholder.component';
import { VoterStore } from '../voter/voter-store.service';
import { KioskInactivityService } from './kiosk-inactivity.service';

const ballot = {
  sections: [{ id: 1, name: 'الروبوتات', sort_order: 1 }],
  projects: [{ id: 11, name: 'مشروع القمر', description: 'روبوت استكشاف', section_id: 1, school_name: 'مدرسة النور' }],
};

describe('شاشة الكشك', () => {
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Router, useValue: { navigate } },
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(KioskInactivityService).clear();
    vi.useRealTimers();
  });

  async function kiosk() {
    const fixture = TestBed.createComponent(KioskPlaceholderComponent);
    TestBed.inject(HttpTestingController).expectOne('/api/public/ballot').flush(ballot);
    await fixture.whenStable();
    return fixture;
  }

  async function atSelection(fixture: { whenStable: () => Promise<unknown>; nativeElement: HTMLElement; componentInstance: KioskPlaceholderComponent }) {
    const el = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('button.welcome')!.click();
    await fixture.whenStable();
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
    ['محمد', 'أحمد', 'خالد', 'العبدالله'].forEach((value, index) => {
      inputs[index]!.value = value;
      inputs[index]!.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'متابعة')!.click();
    await fixture.whenStable();
  }

  async function atThankYou(fixture: { whenStable: () => Promise<unknown>; nativeElement: HTMLElement; componentInstance: KioskPlaceholderComponent }) {
    await atSelection(fixture);
    const el = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('app-project-card .vote-btn')!.click();
    await fixture.whenStable();
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('إنهاء التصويت'))!.click();
    await fixture.whenStable();
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('تأكيد وإرسال'))!.click();
    TestBed.inject(HttpTestingController).expectOne('/api/kiosk/votes').flush({ error: 'OK', message: 'تم' });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await fixture.whenStable();
  }

  it('بعد الاسم تظهر شاشة اختيار المشاريع لا المراجعة', async () => {
    const fixture = await kiosk();
    await atSelection(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-project-card')).toBeTruthy();
    expect(el.textContent).toContain('مشروع القمر');
    expect(el.textContent).not.toContain('راجع اختياراتك');
  });

  it('زر إنهاء التصويت ينقل إلى المراجعة بعد اختيار مشروع', async () => {
    const fixture = await kiosk();
    await atSelection(fixture);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('app-project-card .vote-btn')!.click();
    await fixture.whenStable();
    const finish = Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('إنهاء التصويت'))!;
    expect(finish.disabled).toBe(false);
    finish.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('راجع اختياراتك');
  });

  it('ابدأ من جديد أثناء التصويت يطلب تأكيدًا ولا يعيد الضبط قبل الموافقة', async () => {
    const fixture = await kiosk();
    await atSelection(fixture);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('app-project-card .vote-btn')!.click();
    await fixture.whenStable();
    const store = TestBed.inject(VoterStore);
    el.querySelector<HTMLButtonElement>('button.reset')!.click();
    await fixture.whenStable();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.reset-dialog');
    expect(dialog?.open).toBe(true);
    expect(store.selections().length).toBe(1);
    dialog!.returnValue = 'cancel';
    fixture.componentInstance.onResetDialogClose();
    await fixture.whenStable();
    expect(dialog!.open).toBe(false);
    expect(store.selections().length).toBe(1);
    el.querySelector<HTMLButtonElement>('button.reset')!.click();
    await fixture.whenStable();
    el.querySelector<HTMLDialogElement>('dialog.reset-dialog')!.returnValue = 'confirm';
    fixture.componentInstance.onResetDialogClose();
    await fixture.whenStable();
    expect(store.selections().length).toBe(0);
    expect(el.querySelector('button.welcome')).toBeTruthy();
  });

  it('ابدأ من جديد في شاشة الشكر يعيد الضبط فورًا بدون تحذير', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    await atThankYou(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('شكراً لمشاركتك');
    el.querySelector<HTMLButtonElement>('button.reset')!.click();
    await fixture.whenStable();
    expect(el.querySelector<HTMLDialogElement>('dialog.reset-dialog')?.open).toBeFalsy();
    expect(el.querySelector('button.welcome')).toBeTruthy();
  });

  it('تعود شاشة الشكر تلقائيًا إلى البداية بعد ٥ ثوانٍ', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    await atThankYou(fixture);
    await vi.advanceTimersByTimeAsync(5000);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button.welcome')).toBeTruthy();
  });

  it('زر العودة إلى لوحة الإدارة يفتح التحذير أثناء التصويت', async () => {
    const fixture = await kiosk();
    await atSelection(fixture);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('app-project-card .vote-btn')!.click();
    await fixture.whenStable();
    const store = TestBed.inject(VoterStore);
    el.querySelector<HTMLButtonElement>('.admin-exit')!.click();
    await fixture.whenStable();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.reset-dialog')!;
    expect(dialog.open).toBe(true);
    expect(store.selections().length).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
    dialog.returnValue = 'confirm';
    fixture.componentInstance.onResetDialogClose();
    await fixture.whenStable();
    expect(store.step()).toBe(0);
    expect(store.selections().length).toBe(0);
    expect(navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('العودة من شاشة الترحيب تنقل مباشرة بدون تحذير', async () => {
    const fixture = await kiosk();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.admin-exit')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/admin']);
    expect(el.querySelector<HTMLDialogElement>('dialog.reset-dialog')!.open).toBe(false);
  });

  it('مؤقت الخمول لا يعيد المدير إلى الكشك بعد مغادرته', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.admin-exit')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/admin']);
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(navigate).not.toHaveBeenCalledWith(['/kiosk']);
  });

  it('زر المصوّت التالي يلغي مؤقت الخمس ثوانٍ فلا يُمسح اسم المصوّت الجديد', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    await atThankYou(fixture);
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('المصوّت التالي'))!.click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button.welcome')!.click();
    await fixture.whenStable();
    const nameInput = el.querySelector<HTMLInputElement>('input')!;
    nameInput.value = 'سارة';
    nameInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(6000);
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('سارة');
  });

  it('تحذير الخمول يظهر كنافذة حوارية وينغلق عند تأكيد البقاء', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    await vi.advanceTimersByTimeAsync(50_000);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector<HTMLDialogElement>('dialog.inactivity-dialog')!;
    expect(dialog).toBeTruthy();
    expect(dialog.open).toBe(true);
    expect(el.textContent).toContain('هل ما زلت هنا؟');
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('نعم، أنا هنا'))!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });

  it('إعادة الضبط التلقائية تغلق نافذة الخمول وتعود للترحيب', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fixture = await kiosk();
    await vi.advanceTimersByTimeAsync(60_000);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button.welcome')).toBeTruthy();
    const dialog = el.querySelector<HTMLDialogElement>('dialog.inactivity-dialog')!;
    expect(dialog.open).toBe(false);
  });
});
