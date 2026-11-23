import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export const MAX_VOTES = 3;

@Component({
  selector: 'app-vote-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="counter" aria-live="polite">
      الأصوات المستخدمة: {{ used() }} من {{ max }}
      <span class="dots" aria-hidden="true">
        @for (i of dots; track i) {
          <span class="dot" [class.on]="i <= used()"></span>
        }
      </span>
    </p>
  `,
  styles: `
    .counter { display: inline-flex; align-items: center; gap: .6rem; margin: 0; font-weight: 700; }
    .dots { display: inline-flex; gap: .35rem; }
    .dot { width: .65rem; height: .65rem; border-radius: 50%; border: 2px solid var(--primary); background: transparent; }
    .dot.on { background: var(--primary); }
  `,
})
export class VoteCounterComponent {
  readonly used = input(0);
  protected readonly max = MAX_VOTES;
  protected readonly dots = Array.from({ length: MAX_VOTES }, (_, i) => i + 1);
}
