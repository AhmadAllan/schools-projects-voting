import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { VoterShellComponent } from './voter-shell.component';
import { WinnersPlaceholderComponent } from '../winners/winners-placeholder.component';

type TabName = 'vote' | 'winners';

@Component({
  selector: 'app-home-shell',
  imports: [VoterShellComponent, WinnersPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="home-shell">
    <nav class="tabs" role="tablist" aria-label="أقسام الشاشة الرئيسية" (keydown)="onTablistKeydown($event)">
      @for (item of tabs; track item.name) {
        <button type="button" role="tab" [id]="item.id" [class.active]="tab() === item.name"
          [attr.aria-selected]="tab() === item.name" [attr.aria-controls]="item.panelId"
          [tabindex]="tab() === item.name ? 0 : -1"
          (click)="setTab(item.name)">{{ item.label }}</button>
      }
    </nav>
    <div [id]="panelId()" role="tabpanel" [attr.aria-labelledby]="'home-tab-' + tab()">
      @if (tab() === 'vote') {
        <app-voter-shell />
      } @else {
        <app-winners [embedded]="true" />
      }
    </div>
  </div>`,
  styles: `
    .home-shell{display:block;width:100%}
    .tabs{display:flex;justify-content:center;gap:.5rem;padding:.75rem 1rem}
    .tabs button{min-height:48px;padding:.5rem 1.75rem;border:1px solid var(--border-strong);border-radius:var(--radius-pill);background:var(--surface);color:var(--text);font-size:1.05rem;cursor:pointer}
    .tabs button.active{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
  `,
})
export class HomeShellComponent {
  readonly tab = signal<TabName>('vote');
  protected readonly tabs: ReadonlyArray<{ name: TabName; label: string; id: string; panelId: string }> = [
    { name: 'vote', label: 'التصويت', id: 'home-tab-vote', panelId: 'home-panel-vote' },
    { name: 'winners', label: 'الفائزون', id: 'home-tab-winners', panelId: 'home-panel-winners' },
  ];
  protected panelId() { return `home-panel-${this.tab()}`; }

  protected setTab(tab: TabName) { this.tab.set(tab); }

  // RTL: السهم الأيسر يتقدم للأمام، والأيمن يرجع للخلف.
  protected onTablistKeydown(event: KeyboardEvent) {
    const order: TabName[] = ['vote', 'winners'];
    const current = order.indexOf(this.tab());
    let next: number;
    if (event.key === 'ArrowLeft') next = Math.min(current + 1, order.length - 1);
    else if (event.key === 'ArrowRight') next = Math.max(current - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    const target = order[next]!;
    this.tab.set(target);
    document.getElementById(`home-tab-${target}`)?.focus();
  }
}
