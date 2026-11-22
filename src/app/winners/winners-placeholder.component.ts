import { Component, HostListener, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AdminSessionService } from '../core/admin-session.service';
import { ResultProject, ResultsResponse } from '../core/models';

const RANK_LABELS = ['', 'المركز الأول', 'المركز الثاني', 'المركز الثالث'];

@Component({
  selector: 'app-winners',
  standalone: true,
  template: `
  <main class="winners" [class.embedded]="embedded()">
    @if (loading()) {
      <p class="state">جارٍ تحميل النتائج…</p>
    } @else if (error()) {
      <p class="state error">{{ error() }}</p>
    } @else if (!sections().length) {
      <p class="state">لا توجد نتائج معلنة بعد.</p>
    } @else {
      @if (!embedded() && admin.isAdmin()) {
        <button type="button" class="admin-return" (click)="toAdmin()">العودة إلى لوحة الإدارة</button>
      }
      <header>
        <small>القسم {{ sectionIndex() + 1 }} من {{ sections().length }}</small>
        <h1>{{ current()!.section_name }}</h1>
        @if (isManual()) {
          <p class="badge">اختيار الإدارة</p>
        }
      </header>

      <div class="podium">
        @for (place of places(); track place.rank) {
          <section class="place-row" [class.tied]="place.tied">
            @if (place.tied) { <p class="tie-badge">تعادل في {{ place.label }}</p> }
            @else if (place.rank > 0) { <p class="rank-badge">{{ place.label }}</p> }
            <div class="row-cards">
              @for (project of place.projects; track project.project_id) {
                <article class="winner-card">
                  <h2>{{ project.project_name }}</h2>
                  @if (project.school_name) { <p class="school">{{ project.school_name }}</p> }
                  @if (!isManual()) { <strong>{{ project.votes }} صوت</strong> }
                </article>
              }
            </div>
          </section>
        }
      </div>

      <footer>
        <button type="button" (click)="prev()" [disabled]="sectionIndex() === 0">السابق</button>
        <button type="button" (click)="next()" [disabled]="sectionIndex() === sections().length - 1">التالي</button>
      </footer>
    }
  </main>`,
  styles: [`
    .winners{min-height:100dvh;display:flex;flex-direction:column;gap:clamp(.4rem,1.2vh,1.25rem);padding:clamp(.6rem,2vh,2rem);text-align:center;background:var(--bg);color:var(--text)}
    .winners.embedded{min-height:auto;padding:1rem 0}
    .state{margin:auto;font-size:clamp(1.1rem,2.6vh,1.9rem)}
    .error{color:var(--danger)}
    .admin-return{position:fixed;inset-block-start:.75rem;inset-inline-start:.75rem;min-height:56px;padding:.6rem 1.25rem;border:2px solid var(--primary);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:clamp(.9rem,1.8vh,1.1rem);cursor:pointer;box-shadow:var(--shadow-md);z-index:2}
    .admin-return:hover{background:var(--surface-tint)}
    header{display:grid;gap:clamp(.15rem,.6vh,.5rem)}
    header h1{font-size:clamp(1.3rem,4.2vh,3.6rem);margin:0}
    header small{font-size:clamp(.85rem,1.8vh,1.3rem);color:var(--text-muted)}
    .badge{display:inline-block;margin:0;padding:.3rem 1rem;border-radius:var(--radius-pill);background:var(--ok-bg);color:var(--ok-text);font-size:clamp(.9rem,1.9vh,1.35rem)}
    .podium{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;gap:clamp(.4rem,1.2vh,1.1rem);max-width:1000px;margin:0 auto;width:100%;min-height:0}
    .place-row{flex:1;display:grid;align-content:center;justify-items:center;gap:clamp(.25rem,.8vh,.6rem);min-height:0}
    .place-row .tie-badge{margin:0;padding:.3rem 1.1rem;border-radius:var(--radius-pill);background:var(--warn-bg);color:var(--warn-text);font-size:clamp(.85rem,1.9vh,1.3rem)}
    .row-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,42vw),1fr));gap:clamp(.5rem,1.4vh,1.1rem);width:100%;min-height:0;justify-content:center}
    .place-row:not(.tied) .row-cards{grid-template-columns:minmax(min(340px,80vw),540px)}
    .winner-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(.2rem,.8vh,.6rem);padding:clamp(.5rem,1.8vh,1.5rem);border:2px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-md);min-height:0}
    .rank-badge{margin:0;padding:.3rem 1.1rem;border-radius:var(--radius-pill);background:var(--primary);color:var(--on-primary);font-size:clamp(.85rem,1.9vh,1.3rem)}
    .winner-card h2{font-size:clamp(1rem,3vh,2.4rem);margin:0}
    .winner-card .school{margin:0;color:var(--text-muted);font-size:clamp(.8rem,1.7vh,1.25rem)}
    .winner-card strong{font-size:clamp(.9rem,2vh,1.5rem);color:var(--primary)}
    footer{display:flex;justify-content:center;gap:clamp(.5rem,1.5vw,1rem);flex-wrap:wrap}
    footer button{min-height:clamp(48px,7vh,56px);min-width:clamp(5.5rem,18vw,8rem);padding:.5rem 1.25rem;border:1px solid var(--border-strong);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-sm);font-size:clamp(.95rem,1.9vh,1.1rem);cursor:pointer}
    footer button:hover:not(:disabled){background:var(--surface-tint);box-shadow:var(--shadow-md)}
    footer button:disabled{opacity:.4;cursor:not-allowed}
  `]
})
export class WinnersPlaceholderComponent {
  private api = inject(ApiService);
  readonly admin = inject(AdminSessionService);
  private router = inject(Router);
  readonly embedded = input(false);
  readonly results = signal<ResultsResponse | null>(null);
  readonly sectionIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sections = computed(() => this.results()?.sections ?? []);
  readonly current = computed(() => this.sections()[this.sectionIndex()] ?? null);
  readonly isManual = computed(() => this.results()?.source === 'manual');
  readonly places = computed<Array<{ rank: number; label: string; tied: boolean; projects: ResultProject[] }>>(() => {
    const section = this.current();
    if (!section) return [];
    if (this.isManual()) return [{ rank: 0, label: '', tied: false, projects: section.projects }];
    const positives = section.projects.filter((project) => project.votes > 0);
    if (!positives.length) return [{ rank: 0, label: '', tied: false, projects: section.projects.slice(0, 3) }];
    const groups = new Map<number, ResultProject[]>();
    for (const project of positives) {
      const rank = 1 + positives.filter((other) => other.votes > project.votes).length;
      if (rank > 3) continue;
      const list = groups.get(rank) ?? [];
      list.push(project);
      groups.set(rank, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
      .map(([rank, projects]) => ({ rank, label: RANK_LABELS[rank] ?? '', tied: projects.length > 1, projects }));
  });

  constructor() { afterNextRender(() => { void this.load(); }); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    if (!this.embedded()) this.admin.refresh();
    try {
      this.results.set(this.embedded() ? await this.api.getPublicResults() : await this.loadStandalone());
    } catch {
      this.error.set('ما زال التصويت جاريًا — النتائج غير معلنة بعد');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStandalone(): Promise<ResultsResponse> {
    try { return await this.api.getAdminResults(); } catch { return await this.api.getPublicResults(); }
  }

  toAdmin() { void this.router.navigate(['/admin']); }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') this.next();
    if (event.key === 'ArrowRight') this.prev();
  }

  next() { this.sectionIndex.update((index) => Math.min(index + 1, this.sections().length - 1)); }
  prev() { this.sectionIndex.update((index) => Math.max(index - 1, 0)); }
}
