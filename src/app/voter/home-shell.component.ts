import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { VoterShellComponent } from './voter-shell.component';
import { WinnersPlaceholderComponent } from '../winners/winners-placeholder.component';

@Component({
  selector: 'app-home-shell',
  imports: [VoterShellComponent, WinnersPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="home-shell">
    <nav class="tabs" aria-label="أقسام الشاشة الرئيسية">
      <button type="button" [class.active]="tab() === 'vote'" [attr.aria-selected]="tab() === 'vote'" (click)="tab.set('vote')">التصويت</button>
      <button type="button" [class.active]="tab() === 'winners'" [attr.aria-selected]="tab() === 'winners'" (click)="tab.set('winners')">الفائزون</button>
    </nav>
    @if (tab() === 'vote') {
      <app-voter-shell />
    } @else {
      <app-winners [embedded]="true" />
    }
  </div>`,
  styles: `
    .home-shell{display:block;width:100%}
    .tabs{display:flex;justify-content:center;gap:.5rem;padding:.75rem 1rem}
    .tabs button{min-height:48px;padding:.5rem 1.75rem;border:1px solid var(--border-strong);border-radius:var(--radius-pill);background:var(--surface);color:var(--text);font-size:1.05rem;cursor:pointer}
    .tabs button.active{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
  `,
})
export class HomeShellComponent {
  readonly tab = signal<'vote' | 'winners'>('vote');
}
