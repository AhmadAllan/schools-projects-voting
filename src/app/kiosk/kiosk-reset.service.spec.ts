Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VoterStore } from '../voter/voter-store.service';
import { KioskResetService } from './kiosk-reset.service';
describe('إعادة ضبط الطاولة', () => {
  it('تمسح الاسم والاختيار وتنتج طلبًا جديدًا', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'kiosk', component: KioskResetService }]), VoterStore] });
    const store = TestBed.inject(VoterStore); const reset = TestBed.inject(KioskResetService);
    store.name.set({ first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' });
    store.toggleSelection(1, 9); const oldId = store.requestId();
    reset.reset();
    expect(store.name()).toEqual({ first: '', father: '', grandfather: '', family: '' });
    expect(store.selections()).toEqual([]); expect(store.requestId()).not.toBe(oldId);
  });
});
