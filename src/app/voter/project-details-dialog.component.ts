import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { BallotProject } from '../core/models';

@Component({
  selector: 'app-project-details-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #detailsDialog class="details" (cancel)="onClose()" (close)="onClose()" aria-labelledby="details-title">
      @if (project(); as project) {
        <div class="media">
          @if (project.image_url) {
            <img [src]="project.image_url" [alt]="project.name">
          } @else {
            <div class="placeholder" aria-hidden="true">{{ project.name.charAt(0) }}</div>
          }
        </div>
        <div class="body">
          <span class="badge">{{ sectionName() }}</span>
          <h2 id="details-title">{{ project.name }}</h2>
          <p class="school">{{ project.school_name }}</p>
          <p class="desc">{{ project.description }}</p>
          @if (project.url) {
            <a class="visit" [href]="project.url" target="_blank" rel="noopener">زيارة المشروع</a>
          }
          <div class="actions">
            <button type="button" class="ghost" (click)="onClose()">إغلاق</button>
            <button type="button" class="vote-btn" [class.on]="selected()"
              [attr.aria-pressed]="selected()" [disabled]="locked() && !selected()"
              (click)="toggle.emit()">
              {{ selected() ? 'مُختار' : 'تصويت' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog.details { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); padding: 0; width: min(520px, 92vw); max-height: 85dvh; overflow-y: auto; }
    dialog.details::backdrop { background: var(--backdrop); }
    dialog.details:modal { overscroll-behavior: contain; }
    .media img, .placeholder { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
    .placeholder { display: grid; place-items: center; background: var(--surface-tint); color: var(--primary); font-size: 3rem; font-weight: 700; }
    .body { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; padding: 1.1rem; text-align: start; }
    .badge { padding: .12rem .6rem; border-radius: var(--radius-pill); font-size: .8rem; font-weight: 700; background: #E3EEF6; color: #1D6FA5; }
    h2 { margin: 0; }
    .school { margin: 0; color: var(--text-muted); }
    .desc { margin: 0; line-height: 1.7; }
    .visit { color: var(--primary); font-weight: 700; }
    .actions { display: flex; gap: .5rem; width: 100%; margin-top: .5rem; }
    .ghost { flex: 1; min-height: 48px; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: var(--text-muted); cursor: pointer; }
    .ghost:hover { background: var(--surface-tint); }
    .vote-btn { flex: 1.4; min-height: 48px; border: 1px solid var(--primary); border-radius: var(--radius); background: var(--primary); color: var(--on-primary); font-weight: 700; cursor: pointer; }
    .vote-btn.on { background: var(--surface-selected); color: var(--primary); }
    .vote-btn:disabled { cursor: not-allowed; }
  `,
})
export class ProjectDetailsDialogComponent {
  readonly project = input<BallotProject | null>(null);
  readonly sectionName = input('');
  readonly selected = input(false);
  readonly locked = input(false);
  readonly toggle = output<void>();
  readonly closed = output<void>();
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('detailsDialog');

  constructor() {
    effect(() => {
      const open = this.project() !== null;
      const dialog = this.dialogRef().nativeElement;
      if (open && !dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      } else if (!open && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  protected onClose() {
    if (this.project()) this.closed.emit();
  }
}
