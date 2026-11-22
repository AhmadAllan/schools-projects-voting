import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Ballot, BallotSection, Selection } from '../core/models';

@Component({
  selector: 'app-ballot-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="state" role="status">جارٍ تحميل المشاريع…</p>
    } @else if (error()) {
      <div class="state error-block">
        <p role="alert">{{ error() }}</p>
        <button type="button" class="btn" (click)="retry.emit()">إعادة المحاولة</button>
      </div>
    } @else if (!sections().length) {
      <p class="state">لا توجد مشاريع بعد.</p>
    } @else {
      <div class="ballot-meta">
        <strong aria-live="polite">اخترت {{ selections().length }} من 3</strong>
        <span class="rule-hint">اختر مشروعًا واحدًا من كل قسم، وحتى 3 أقسام</span>
      </div>
      @for (section of sections(); track section.id) {
        <h3>{{ section.name }}</h3>
        <div class="cards">
          @for (project of projectsFor(section); track project.id) {
            <button type="button" class="project-card"
              [class.selected]="isSelected(project.id)"
              [attr.aria-pressed]="isSelected(project.id)"
              [disabled]="selections().length === 3 && !selectedInSection(section.id)"
              (click)="toggle.emit({ sectionId: section.id, projectId: project.id })">
              @if (project.image_url) { <img [src]="project.image_url" [alt]="project.name" loading="lazy"> }
              <strong>{{ project.name }}</strong>
              <span>{{ project.description }}</span>
              <small>{{ project.school_name }}</small>
              @if (isSelected(project.id)) { <b aria-hidden="true">✓</b> }
            </button>
          }
        </div>
      }
    }`,
  styles: `
    .state { text-align: center; padding: 2rem 0; color: var(--text-muted); }
    .error-block { display: grid; justify-items: center; gap: .75rem; }
    .error-block p { margin: 0; color: var(--danger); }
    .ballot-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem 1rem; margin: .25rem 0 .5rem; }
    .ballot-meta strong { font-size: 1.05rem; }
    .rule-hint { color: var(--text-muted); font-size: .9rem; }
    h3 { margin: 1.25rem 0 .5rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .project-card { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: .4rem; min-height: 180px; text-align: start; padding: 1rem; border: 2px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); cursor: pointer; transition: box-shadow .15s ease-out, translate .15s ease-out, background-color .15s ease-out; }
    .project-card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius); }
    .project-card b { position: absolute; top: .6rem; inset-inline-end: .6rem; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; }
    .project-card:disabled { cursor: not-allowed; }
    .project-card.selected { border-color: var(--primary); background: var(--surface-selected); box-shadow: var(--shadow-md); }
    @media (prefers-reduced-motion: no-preference) {
      .project-card:hover:not(:disabled) { translate: 0 -2px; box-shadow: var(--shadow-md); }
    }
  `,
})
export class BallotCardsComponent {
  readonly ballot = input<Ballot | null>(null);
  readonly selections = input<Selection[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly toggle = output<Selection>();
  readonly retry = output<void>();

  protected readonly sections = computed(() => this.ballot()?.sections ?? []);

  protected projectsFor(section: BallotSection) {
    return (this.ballot()?.projects ?? []).filter((project) => project.section_id === section.id);
  }
  protected isSelected(projectId: number) { return this.selections().some((selection) => selection.projectId === projectId); }
  protected selectedInSection(sectionId: number) { return this.selections().some((selection) => selection.sectionId === sectionId); }
}
