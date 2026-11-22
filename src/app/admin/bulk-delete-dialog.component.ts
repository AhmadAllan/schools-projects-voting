import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { DeletePreview } from '../core/models';

/**
 * نافذة تحذير الحذف المتسلسل: تعرض ما سيُحذف بالضبط (عناصر + مشاريع + أصوات)
 * ولا تسمح بالتنفيذ إلا بعد كتابة كلمة «تأكيد».
 */
@Component({
  selector: 'app-bulk-delete-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="admin-dialog delete-dialog" aria-labelledby="bulk-delete-title">
      <h2 id="bulk-delete-title">{{ title() }}</h2>
      @if (loading()) {
        <p class="delete-state" role="status">جارٍ حساب ما سيُحذف…</p>
      } @else if (preview(); as preview) {
        <p class="delete-warning">ستُحذف العناصر التالية نهائيًا:</p>
        <ul class="delete-list">
          @for (item of preview.items; track item.id) { <li>{{ item.name }}</li> }
        </ul>
        @if (preview.projects.length) {
          <p class="delete-warning">وستُحذف معها هذه المشاريع <strong>وأصواتها ({{ preview.votes }} صوت)</strong> — لا يمكن التراجع:</p>
          <ul class="delete-list">
            @for (project of preview.projects; track project.id) {
              <li>{{ project.name }} <small>({{ project.context }})</small></li>
            }
          </ul>
        } @else {
          <p class="delete-warning">لا توجد مشاريع مرتبطة بها{{ preview.votes ? ' — لكن ' + preview.votes + ' صوتًا مسجلًا عليها' : '' }}.</p>
        }
        <label class="confirm-word">اكتب كلمة «تأكيد» للمتابعة
          <input [value]="word()" (input)="word.set($any($event.target)?.value)" lang="ar" autocomplete="off">
        </label>
      }
      @if (error()) { <p class="admin-error" role="alert">{{ error() }}</p> }
      @if (!loading()) {
        <div class="dialog-actions">
          <button type="button" class="btn" autofocus [disabled]="busy()" (click)="cancelled.emit(); close()">إلغاء</button>
          @if (preview(); as preview) {
            <button type="button" class="btn danger" [disabled]="!canConfirm()" (click)="confirmed.emit()">
              {{ busy() ? 'جارٍ الحذف…' : 'حذف نهائي' }}
            </button>
          }
        </div>
      }
    </dialog>`,
  styles: `
    .delete-state { color: var(--text-muted); padding: 1rem 0; }
    .delete-warning { margin: .75rem 0 .35rem; font-weight: 700; }
    .delete-list { margin: 0 0 .5rem; padding-inline-start: 1.4rem; max-height: 11rem; overflow-y: auto; }
    .delete-list li { line-height: 1.7; }
    .delete-list small { color: var(--text-muted); }
    .confirm-word { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }
  `,
})
export class BulkDeleteDialogComponent {
  readonly title = input('تأكيد الحذف');
  readonly loading = input(false);
  readonly preview = input<DeletePreview | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  protected readonly word = signal('');
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected canConfirm() {
    return this.word().trim() === 'تأكيد' && !this.busy() && !this.loading() && this.preview() !== null;
  }

  open() {
    this.word.set('');
    const dialog = this.dialogRef().nativeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  close() {
    const dialog = this.dialogRef().nativeElement;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }
}
