import { TestBed } from '@angular/core/testing';
import { VoterNameFormComponent } from './voter-name-form.component';
import { NameParts } from '../core/models';

const STORED: NameParts = { first: 'سارة', father: 'أحمد', grandfather: 'خالد', family: 'العلي' };
const VALID: NameParts = { first: 'محمد', father: 'أحمد', grandfather: 'خالد', family: 'العبدالله' };

describe('نموذج الاسم الرباعي', () => {
  async function render(initial?: NameParts) {
    const fixture = TestBed.createComponent(VoterNameFormComponent);
    if (initial) fixture.componentRef.setInput('initial', initial);
    await fixture.whenStable();
    return fixture;
  }

  function continueButton(el: HTMLElement) {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'متابعة')!;
  }

  it('يعطل المتابعة ويظهر خطأ الحقل بعد لمسه فقط', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const first = el.querySelector<HTMLInputElement>('input')!;
    expect(continueButton(el).disabled).toBe(true);
    expect(el.querySelector('.field-error')).toBeNull();
    first.value = 'John';
    first.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    first.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    const error = el.querySelector<HTMLElement>('.field-error');
    expect(error).toBeTruthy();
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(first.getAttribute('aria-describedby')).toBe(error!.id);
    expect(continueButton(el).disabled).toBe(true);
  });

  it('اسم صحيح يخفي الخطأ ويفعّل المتابعة ويرسله', async () => {
    const emitted: NameParts[] = [];
    const fixture = await render();
    fixture.componentInstance.continueWith.subscribe((name) => emitted.push(name));
    const el = fixture.nativeElement as HTMLElement;
    const first = el.querySelector<HTMLInputElement>('input')!;
    first.value = 'John';
    first.dispatchEvent(new Event('input'));
    first.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(el.querySelector('.field-error')).toBeTruthy();
    first.value = VALID.first;
    first.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('.field-error')).toBeNull();
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
    [VALID.father, VALID.grandfather, VALID.family].forEach((value, index) => {
      inputs[index + 1]!.value = value;
      inputs[index + 1]!.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
    const button = continueButton(el);
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
    expect(emitted).toEqual([VALID]);
  });

  it('يبدأ من الاسم المخزن ويبث التغييرات فورًا', async () => {
    const changes: NameParts[] = [];
    const fixture = await render(STORED);
    fixture.componentInstance.nameChange.subscribe((name) => changes.push(name));
    const el = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.map((input) => input.value)).toEqual([STORED.first, STORED.father, STORED.grandfather, STORED.family]);
    inputs[2]!.value = 'سليم';
    inputs[2]!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(changes.at(-1)?.grandfather).toBe('سليم');
    expect(changes.at(-1)?.first).toBe(STORED.first);
  });

  it('حقل من المسافات فقط يُرفض كما في السيرفر (بعد الحذف)', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
    ['   ', 'أحمد', 'خالد', 'العبدالله'].forEach((value, index) => {
      inputs[index]!.value = value;
      inputs[index]!.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
    expect(continueButton(el).disabled).toBe(true);
    inputs[0]!.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(el.querySelector('.field-error')).toBeTruthy();
  });
});
