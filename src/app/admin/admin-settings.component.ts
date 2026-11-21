import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  imports: [FormsModule, ReactiveFormsModule, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>الإعدادات</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }
    @if (saved()) { <p class="admin-ok">تم حفظ الإعدادات.</p> }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="save()">
      <h2>إعدادات الحدث</h2>
      <label>اسم الحدث <input formControlName="eventName" lang="ar"></label>
      <label>حالة التصويت
        <select formControlName="votingMode">
          <option value="closed">مغلق</option>
          <option value="open">مفتوح دائمًا</option>
          <option value="scheduled">بنافذة زمنية</option>
        </select>
      </label>
      @if (form.controls.votingMode.value === 'scheduled') {
        <label>بداية التصويت <input formControlName="votingStart" type="datetime-local"></label>
        <label>نهاية التصويت <input formControlName="votingEnd" type="datetime-local"></label>
      }
      <label class="check-line">
        <input type="checkbox" formControlName="resultsPublished">
        نشر النتائج للعامة
      </label>
      <button class="btn primary" type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
    </form>

    <section class="danger-zone">
      <h2>منطقة الخطر</h2>
      <p>إعادة الضبط تمسح البيانات ولا يمكن التراجع عنها.</p>
      <button class="btn danger" (click)="openReset()">إعادة ضبط البيانات…</button>
    </section>

    <dialog class="admin-dialog" #resetDialog>
      <form method="dialog" (submit)="confirmReset($event)">
        <h2>تأكيد إعادة الضبط</h2>
        <label>نطاق إعادة الضبط
          <select [ngModel]="resetScope()" (ngModelChange)="resetScope.set($event)" name="scope">
            <option value="votes">الأصوات والناخبون فقط</option>
            <option value="everything">كل شيء (الأقسام والمدارس والمشاريع أيضًا)</option>
          </select>
        </label>
        <label>اكتب كلمة «تأكيد» للمتابعة
          <input [ngModel]="resetWord()" (ngModelChange)="resetWord.set($event)" name="word" lang="ar" autocomplete="off">
        </label>
        <p class="admin-error">{{ resetError() }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="closeReset()">إلغاء</button>
          <button type="submit" class="btn danger" [disabled]="resetBusy()">تنفيذ</button>
        </div>
      </form>
    </dialog>
  </main>`,
  styles: `.danger-zone { margin-top: 2rem; padding: 1rem; border: 1px solid var(--danger); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-sm); max-width: 560px; }
    .danger-zone p { color: var(--danger); }
    dialog label { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }`,
})
export class AdminSettingsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly resetDialog = viewChild.required<ElementRef<HTMLDialogElement>>('resetDialog');
  readonly error = signal('');
  readonly saved = signal(false);
  readonly busy = signal(false);
  readonly resetScope = signal<'votes' | 'everything'>('votes');
  readonly resetWord = signal('');
  readonly resetError = signal('');
  readonly resetBusy = signal(false);
  readonly form = this.fb.group({
    eventName: [''],
    votingMode: ['closed', [Validators.required]],
    votingStart: [''],
    votingEnd: [''],
    resultsPublished: [false],
  });

  constructor() { void this.load(); }

  async load() {
    try {
      const settings = await this.api.getSettings();
      this.form.patchValue({
        eventName: settings['event_name'] ?? '',
        votingMode: settings['voting_mode'] ?? 'closed',
        votingStart: settings['voting_start'] ?? '',
        votingEnd: settings['voting_end'] ?? '',
        resultsPublished: settings['results_published'] === '1',
      });
      this.error.set('');
    } catch { this.error.set('تعذر تحميل الإعدادات.'); }
  }

  async save() {
    this.busy.set(true);
    this.saved.set(false);
    const value = this.form.getRawValue();
    const payload: Record<string, string> = {
      event_name: value.eventName.trim(),
      voting_mode: value.votingMode,
      results_published: value.resultsPublished ? '1' : '0',
    };
    if (value.votingMode === 'scheduled') {
      payload['voting_start'] = value.votingStart;
      payload['voting_end'] = value.votingEnd;
    }
    try {
      await this.api.saveSettings(payload);
      this.saved.set(true);
      this.error.set('');
    } catch { this.error.set('تعذر حفظ الإعدادات.'); }
    finally { this.busy.set(false); }
  }

  openReset() {
    this.resetError.set('');
    this.resetWord.set('');
    this.resetDialog().nativeElement.showModal();
  }

  closeReset() { this.resetDialog().nativeElement.close(); }

  async confirmReset(event: Event) {
    event.preventDefault();
    if (this.resetWord().trim() !== 'تأكيد') {
      this.resetError.set('اكتب كلمة «تأكيد» بالضبط للمتابعة.');
      return;
    }
    this.resetBusy.set(true);
    try {
      await this.api.reset(this.resetScope(), 'تأكيد');
      this.closeReset();
      await this.load();
    } catch { this.resetError.set('تعذر تنفيذ إعادة الضبط.'); }
    finally { this.resetBusy.set(false); }
  }
}
