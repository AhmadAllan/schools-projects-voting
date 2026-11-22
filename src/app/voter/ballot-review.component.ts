import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Ballot, Selection } from '../core/models';

export interface ReviewItem { sectionName: string; projectName: string; schoolName: string }
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
    <section>
      <h2>راجع اختياراتك</h2>
      <ol class="review-list">
        @for (item of items(); track item.projectName) {
          <li><strong>{{ item.projectName }}</strong> — {{ item.sectionName }} <small>({{ item.schoolName }})</small></li>
        }
      </ol>
      <p class="review-warning">بعد الإرسال لا يمكن تعديل الأصوات</p>
      @if (submitError(); as error) {
        <p class="submit-error" role="alert">{{ error.message }}</p>
        @if (error.duplicate) {
          <button type="button" class="btn" (click)="confirmDuplicate.emit()">متابعة رغم تطابق الاسم</button>
        }
      }
      <button type="button" class="btn primary confirm" [disabled]="submitting()" (click)="confirm.emit()">تأكيد وإرسال</button>
    </section>`,
  styles: `
    .review-list { display: grid; gap: .5rem; margin: 1rem 0; padding-inline-start: 1.5rem; }
    .review-list li { line-height: 1.6; }
    .review-list small { color: var(--text-muted); }
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
}
