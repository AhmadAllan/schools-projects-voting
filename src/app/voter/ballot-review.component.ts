import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Ballot, Selection } from '../core/models';

export interface ReviewItem { selection: Selection; sectionName: string; projectName: string; schoolName: string }
export interface SubmitError { message: string; duplicate: boolean }

/** يحوّل رسالة الخادم إلى حالة واجهة: الرسالة + هل هي تحذير اسم مكرر. */
export function parseSubmitError(e: unknown): SubmitError {
  const body = (e as HttpErrorResponse | undefined)?.error as { error?: string; message?: string } | undefined;
  if (body?.message) return { message: body.message, duplicate: body.error === 'DUPLICATE_NAME' };
  return { message: 'تعذر إرسال الأصوات. حاول مرة أخرى.', duplicate: false };
}

/** يحل الاختيارات إلى أسماء عرض (قسم/مشروع/مدرسة) من بيانات الاقتراع. */
export function toReviewItems(ballot: Ballot | null, selections: Selection[]): ReviewItem[] {
  if (!ballot) return [];
  const sections = new Map(ballot.sections.map((section) => [section.id, section.name]));
  const projects = new Map(ballot.projects.map((project) => [project.id, project]));
  return selections.map((selection) => {
    const project = projects.get(selection.projectId);
    return {
      selection,
      sectionName: sections.get(selection.sectionId) ?? '',
      projectName: project?.name ?? '',
      schoolName: project?.school_name ?? '',
    };
  });
}

@Component({
  selector: 'app-ballot-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="back.emit()" aria-hidden="true"></div>
    <section class="drawer" role="dialog" aria-modal="true" aria-labelledby="review-title" (keydown.escape)="back.emit()">
      <header class="drawer-head">
        <h2 id="review-title">راجع اختياراتك</h2>
        <button type="button" class="close" autofocus (click)="back.emit()">رجوع للتعديل</button>
      </header>
      <ol class="review-list">
        @for (item of items(); track item.selection.projectId) {
          <li>
            <div class="item-text">
              <strong>{{ item.projectName }}</strong> — {{ item.sectionName }} <small>({{ item.schoolName }})</small>
            </div>
            <button type="button" class="remove" (click)="remove.emit(item.selection)">إزالة</button>
          </li>
        }
      </ol>
      <p class="review-warning">بعد الإرسال لا يمكن تعديل الأصوات</p>
      @if (submitError(); as error) {
        <p class="submit-error" role="alert">{{ error.message }}</p>
        @if (error.duplicate) {
          <button type="button" class="btn" (click)="confirmDuplicate.emit()">متابعة رغم تطابق الاسم</button>
        }
      }
      <button type="button" class="btn primary confirm" [disabled]="submitting() || !items().length" (click)="confirm.emit()">تأكيد وإرسال</button>
    </section>`,
  styles: `
    .scrim { position: fixed; inset: 0; background: var(--backdrop); z-index: 19; }
    .drawer { position: fixed; inset-block-end: 0; inset-inline: 0; margin-inline: auto; width: min(560px, 100%); max-height: 85dvh; overflow-y: auto; border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: var(--surface); box-shadow: var(--shadow-lg); padding: 1.25rem; z-index: 20; }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .drawer-head h2 { margin: 0; }
    .close { min-height: 44px; padding: .25rem .8rem; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: var(--text-muted); cursor: pointer; }
    .close:hover { background: var(--surface-tint); }
    .review-list { display: grid; gap: .5rem; margin: 1rem 0; padding-inline-start: 0; list-style: none; }
    .review-list li { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .6rem .75rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
    .review-list li { line-height: 1.6; }
    .review-list small { color: var(--text-muted); }
    .remove { min-height: 40px; padding: .2rem .7rem; border: 1px solid var(--border-strong); border-radius: var(--radius); background: transparent; color: var(--danger); cursor: pointer; }
    .remove:hover { background: var(--danger-bg); }
    .review-warning { color: var(--warn-text); background: var(--warn-bg); display: inline-block; padding: .3rem .9rem; border-radius: var(--radius-pill); }
    .submit-error { color: var(--danger); font-weight: 700; }
    .submit-error + .btn { margin-block: .5rem; }
    .confirm { display: block; width: 100%; max-width: 420px; }
  `,
})
export class BallotReviewComponent {
  readonly items = input<ReviewItem[]>([]);
  readonly submitting = input(false);
  readonly submitError = input<SubmitError | null>(null);
  readonly confirm = output<void>();
  readonly confirmDuplicate = output<void>();
  readonly back = output<void>();
  readonly remove = output<Selection>();
}
