import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { ResultProject, ResultsResponse } from '../core/models';

@Component({
  standalone: true,
  template: `
  <main class="winners">
    @if (loading()) {
      <p class="state">جارٍ تحميل النتائج…</p>
    } @else if (error()) {
      <p class="state error">{{ error() }}</p>
    } @else if (!sections().length) {
      <p class="state">لا توجد نتائج معلنة بعد.</p>
    } @else {
      <header>
        <small>القسم {{ sectionIndex() + 1 }} من {{ sections().length }}</small>
        <h1>{{ current()!.section_name }}</h1>
        @if (isManual()) {
          <p class="badge">اختيار الإدارة</p>
        } @else if (isTie()) {
          <p class="badge tie">تعادل في المركز الأول</p>
        } @else {
          <p class="badge">المركز الأول</p>
        }
      </header>

      <div class="podium" [class.tied]="isTie()">
        @for (project of winners(); track project.project_id) {
          <article class="winner-card">
            @if (project.image_url) {
              <img [src]="project.image_url" [alt]="project.project_name">
            }
            <h2>{{ project.project_name }}</h2>
            @if (project.school_name) { <p class="school">{{ project.school_name }}</p> }
            @if (!isManual()) { <strong>{{ project.votes }} صوت</strong> }
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
    .winners{min-height:100dvh;display:flex;flex-direction:column;justify-content:center;gap:2rem;padding:clamp(1rem,4vw,3rem);text-align:center;background:#f7fbf9;color:#102a24}
    .state{font-size:clamp(1.25rem,3vw,2rem)}
    .error{color:#9b1c1c}
    header h1{font-size:clamp(2rem,6vw,4.5rem);margin:.5rem 0}
    header small{font-size:clamp(1rem,2vw,1.4rem);color:#4a6b62}
    .badge{display:inline-block;margin:0;padding:.4rem 1rem;border-radius:999px;background:#d8f3e6;color:#087f5b;font-size:clamp(1rem,2vw,1.4rem)}
    .badge.tie{background:#fff3bf;color:#8a5a00}
    .podium{display:grid;grid-template-columns:1fr;gap:1.25rem;max-width:900px;margin:0 auto;width:100%}
    .podium.tied{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));max-width:1200px}
    .winner-card{display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:clamp(1rem,3vw,2rem);border:2px solid #b9ccc6;border-radius:1.25rem;background:white;box-shadow:0 12px 30px rgba(16,42,36,.08)}
    .winner-card img{width:100%;max-height:240px;object-fit:contain;border-radius:.75rem}
    .winner-card h2{font-size:clamp(1.5rem,4vw,3rem);margin:0}
    .winner-card .school{margin:0;color:#4a6b62;font-size:clamp(1rem,2vw,1.4rem)}
    .winner-card strong{font-size:clamp(1.1rem,2.5vw,1.6rem);color:#087f5b}
    footer{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap}
    footer button{min-height:56px;min-width:8rem;padding:.75rem 1.5rem;border:1px solid #91aaa2;border-radius:.75rem;background:white;font-size:1.1rem;cursor:pointer}
    footer button:disabled{opacity:.4;cursor:not-allowed}
  `]
})
export class WinnersPlaceholderComponent {
  private api = inject(ApiService);
  readonly results = signal<ResultsResponse | null>(null);
  readonly sectionIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sections = computed(() => this.results()?.sections ?? []);
  readonly current = computed(() => this.sections()[this.sectionIndex()] ?? null);
  readonly isManual = computed(() => this.results()?.source === 'manual');
  readonly isTie = computed(() => (this.current()?.tiedProjects.length ?? 0) > 1);
  readonly winners = computed<ResultProject[]>(() => {
    const section = this.current();
    if (!section) return [];
    const tied = new Set(section.tiedProjects);
    return tied.size
      ? section.projects.filter((project) => tied.has(project.project_id))
      : section.projects.slice(0, 1);
  });

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.results.set(await this.api.getAdminResults());
    } catch {
      try {
        this.results.set(await this.api.getPublicResults());
      } catch {
        this.error.set('النتائج غير منشورة بعد.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') this.next();
    if (event.key === 'ArrowRight') this.prev();
  }

  next() { this.sectionIndex.update((index) => Math.min(index + 1, this.sections().length - 1)); }
  prev() { this.sectionIndex.update((index) => Math.max(index - 1, 0)); }
}
