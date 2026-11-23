import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BallotProject } from '../core/models';

@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="project-card" [class.selected]="selected()" [class.locked]="locked()">
      <div class="media">
        @if (project().image_url) {
          <img [src]="project().image_url" [alt]="project().name" loading="lazy">
        } @else {
          <div class="placeholder" aria-hidden="true">{{ project().name.charAt(0) }}</div>
        }
        @if (selected()) { <b class="check" aria-hidden="true">✓</b> }
      </div>
      <div class="body">
        <span class="badge badge-{{ badgeIndex() % 3 }}">{{ sectionName() }}</span>
        <h3 class="name">{{ project().name }}</h3>
        <p class="desc">{{ project().description }}</p>
        <small class="school">{{ project().school_name }}</small>
        <div class="actions">
          <button type="button" class="ghost" (click)="details.emit()">التفاصيل</button>
          <button type="button" class="vote-btn" [class.on]="selected()"
            [attr.aria-pressed]="selected()" [disabled]="locked() && !selected()"
            (click)="toggle.emit()">
            {{ selected() ? 'مُختار' : 'تصويت' }}
          </button>
        </div>
      </div>
    </article>
  `,
  styles: `
    .project-card { position: relative; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); overflow: hidden; transition: box-shadow .15s ease-out, translate .15s ease-out, border-color .15s ease-out; }
    @media (prefers-reduced-motion: no-preference) {
      .project-card:hover:not(.locked) { translate: 0 -2px; box-shadow: var(--shadow-md); }
    }
    .project-card.selected { border-color: var(--primary); background: var(--surface-selected); }
    .media { position: relative; }
    .media img, .placeholder { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
    .placeholder { display: grid; place-items: center; background: var(--surface-tint); color: var(--primary); font-size: 2.25rem; font-weight: 700; }
    .check { position: absolute; top: .6rem; inset-inline-end: .6rem; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; }
    .body { display: flex; flex-direction: column; align-items: flex-start; gap: .4rem; padding: .9rem; text-align: start; }
    .badge { padding: .12rem .6rem; border-radius: var(--radius-pill); font-size: .8rem; font-weight: 700; }
    .badge-0 { background: #E3EEF6; color: #1D6FA5; }
    .badge-1 { background: #E2EFEA; color: #2A7D6F; }
    .badge-2 { background: #F1E8D2; color: #8A6D2B; }
    .name { margin: 0; font-size: 1.05rem; }
    .desc { margin: 0; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .school { color: var(--text-muted); }
    .actions { display: flex; gap: .5rem; width: 100%; margin-top: .25rem; }
    .ghost { flex: 1; min-height: 44px; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; color: var(--text-muted); cursor: pointer; }
    .ghost:hover { background: var(--surface-tint); }
    .vote-btn { flex: 1.4; min-height: 44px; border: 1px solid var(--primary); border-radius: var(--radius); background: var(--primary); color: var(--on-primary); font-weight: 700; cursor: pointer; }
    .vote-btn.on { background: var(--surface-selected); color: var(--primary); }
    .vote-btn:disabled { cursor: not-allowed; }
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<BallotProject>();
  readonly sectionName = input('');
  readonly badgeIndex = input(0);
  readonly selected = input(false);
  readonly locked = input(false);
  readonly toggle = output<void>();
  readonly details = output<void>();
}
