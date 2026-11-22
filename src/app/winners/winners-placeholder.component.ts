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
        } @else if (isTie()) {
          <p class="badge tie">تعادل في المركز الأول</p>
        }
      </header>

      <div class="podium" [class.tied]="isTie()">
        @for (entry of ranked(); track entry.project.project_id) {
          <article class="winner-card">
            @if (entry.rank > 0) { <p class="rank-badge">{{ rankLabel(entry.rank) }}</p> }
            @if (entry.project.image_url) {
              <img [src]="entry.project.image_url" [alt]="entry.project.project_name">
            }
            <h2>{{ entry.project.project_name }}</h2>
            @if (entry.project.school_name) { <p class="school">{{ entry.project.school_name }}</p> }
            @if (!isManual()) { <strong>{{ entry.project.votes }} صوت</strong> }
          </article>
        }
      </div>

      <footer>
        <button type="button" (click)="prev()" [disabled]="sectionIndex() === 0">السابق</button>
        <button type="button" (click)="next()" [disabled]="sectionIndex() === sections().length - 1">التالي</button>
      </footer>
    }
  </main>`,
  styles: [`
    .winners{min-height:100dvh;display:flex;flex-direction:column;justify-content:center;gap:2rem;padding:clamp(1rem,4vw,3rem);text-align:center;background:var(--bg);color:var(--text)}
    .winners.embedded{min-height:auto;justify-content:flex-start;padding:1rem 0}
    .state{font-size:clamp(1.25rem,3vw,2rem)}
    .error{color:var(--danger)}
    .admin-return{position:fixed;inset-block-start:1rem;inset-inline-start:1rem;min-height:56px;padding:.75rem 1.5rem;border:2px solid var(--primary);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:1.1rem;cursor:pointer;box-shadow:var(--shadow-md)}
    .admin-return:hover{background:var(--surface-tint)}
    header h1{font-size:clamp(2rem,6vw,4.5rem);margin:.5rem 0}
    header small{font-size:clamp(1rem,2vw,1.4rem);color:var(--text-muted)}
    .badge{display:inline-block;margin:0;padding:.4rem 1rem;border-radius:var(--radius-pill);background:var(--ok-bg);color:var(--ok-text);font-size:clamp(1rem,2vw,1.4rem)}
    .badge.tie{background:var(--warn-bg);color:var(--warn-text)}
    .podium{display:grid;grid-template-columns:1fr;gap:1.25rem;max-width:900px;margin:0 auto;width:100%}
    .podium.tied{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));max-width:1200px}
    .winners:not(.tied) .podium:not(.tied){grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
    .winner-card{display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:clamp(1rem,3vw,2rem);border:2px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-md)}
    .rank-badge{margin:0;padding:.35rem 1rem;border-radius:var(--radius-pill);background:var(--primary);color:var(--on-primary);font-size:clamp(1rem,2vw,1.3rem)}
    .winner-card img{width:100%;max-height:240px;object-fit:contain;border-radius:.75rem}
    .winner-card h2{font-size:clamp(1.5rem,4vw,3rem);margin:0}
    .winner-card .school{margin:0;color:var(--text-muted);font-size:clamp(1rem,2vw,1.4rem)}
    .winner-card strong{font-size:clamp(1.1rem,2.5vw,1.6rem);color:var(--primary)}
    footer{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap}
    footer button{min-height:56px;min-width:8rem;padding:.75rem 1.5rem;border:1px solid var(--border-strong);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-sm);font-size:1.1rem;cursor:pointer}
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
  readonly isTie = computed(() => (this.current()?.tiedProjects.length ?? 0) > 1);
  readonly ranked = computed<Array<{ project: ResultProject; rank: number }>>(() => {
    const section = this.current();
    if (!section) return [];
    if (this.isManual()) return section.projects.map((project) => ({ project, rank: 0 }));
    const totals = [...new Set(section.projects.map((project) => project.votes))].filter((votes) => votes > 0).sort((a, b) => b - a).slice(0, 3);
    if (!totals.length) return section.projects.slice(0, 3).map((project) => ({ project, rank: 0 }));
    return section.projects
      .filter((project) => totals.includes(project.votes))
      .map((project) => ({ project, rank: totals.indexOf(project.votes) + 1 }));
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

  rankLabel(rank: number) { return RANK_LABELS[rank] ?? ''; }
  toAdmin() { void this.router.navigate(['/admin']); }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') this.next();
    if (event.key === 'ArrowRight') this.prev();
  }

  next() { this.sectionIndex.update((index) => Math.min(index + 1, this.sections().length - 1)); }
  prev() { this.sectionIndex.update((index) => Math.max(index - 1, 0)); }
}
