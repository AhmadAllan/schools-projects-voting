import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ResultSection, ResultSource } from '../core/models';
import { AdminNavComponent } from './admin-nav.component';

const SOURCE_LABELS: Record<ResultSource, string> = {
  digital: 'رقمي فقط',
  written: 'ورقي فقط',
  combined: 'دمج رقمي + ورقي',
  manual: 'اختيار يدوي للإدارة',
};

@Component({
  imports: [FormsModule, RouterLink, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>النتائج</h1>
    <p>
      مصدر الترتيب الحالي: <span class="tag on">{{ sourceLabel() }}</span>
      — يمكن تغييره من صفحة <a routerLink="/admin/votes">الأصوات</a>.
    </p>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }
    @if (saved()) { <p class="admin-ok">تم التحديث.</p> }

    <div class="actions">
      <button class="btn {{ published() ? '' : 'primary' }}" (click)="togglePublish()">
        {{ published() ? 'إلغاء نشر النتائج' : 'نشر النتائج للعامة' }}
      </button>
      <a class="btn" href="/api/admin/export/results.csv">تصدير النتائج CSV</a>
      <a class="btn" href="/api/admin/export/voters.csv">تصدير الناخبين CSV</a>
      <a class="btn" routerLink="/winners">فتح شاشة الإعلان</a>
    </div>

    @for (section of sections(); track section.section_id) {
      <section class="section-block">
        <header>
          <h2>{{ section.section_name }}</h2>
          @if (section.tiedProjects.length > 1) { <span class="tag warn">تعادل في المركز الأول</span> }
        </header>
        <table class="admin-table">
          <thead><tr><th>#</th><th>المشروع</th><th>المدرسة</th><th>الأصوات</th><th>الحالة</th></tr></thead>
          <tbody>
            @for (project of section.projects; track project.project_id; let i = $index) {
              <tr>
                <td>{{ i + 1 }}</td>
                <td>{{ project.project_name }}</td>
                <td>{{ project.school_name || '—' }}</td>
                <td>{{ project.votes }}</td>
                <td>
                  @if (section.tiedProjects.includes(project.project_id)) { <span class="tag warn">متعادل</span> }
                  @else if (i === 0) { <span class="tag on">الأول</span> }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5">لا توجد مشاريع معلنة.</td></tr>
            }
          </tbody>
        </table>
        <label class="winner-pick">الفائز اليدوي (يُستخدم مع مصدر «اختيار يدوي»)
          <select [ngModel]="winners()[section.section_id] ?? null" (ngModelChange)="setWinner(section.section_id, $event)">
            <option [ngValue]="null">بدون فائز</option>
            @for (project of section.projects; track project.project_id) {
              <option [ngValue]="project.project_id">{{ project.project_name }}</option>
            }
          </select>
        </label>
      </section>
    } @empty {
      <p>لا توجد نتائج بعد. أضف أقسامًا ومشاريع أولًا.</p>
    }
  </main>`,
  styles: `.actions { display: flex; gap: .75rem; flex-wrap: wrap; margin: 1rem 0; }
    .section-block { margin-top: 2rem; }
    .section-block header { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .winner-pick { display: grid; gap: .4rem; max-width: 420px; margin: .75rem 0; }`,
})
export class AdminResultsComponent {
  private api = inject(ApiService);
  readonly sections = signal<ResultSection[]>([]);
  readonly winners = signal<Record<number, number | undefined>>({});
  readonly source = signal<ResultSource>('digital');
  readonly published = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly sourceLabel = computed(() => SOURCE_LABELS[this.source()]);

  constructor() { void this.load(); }

  async load() {
    try {
      const [results, votes, settings] = await Promise.all([
        this.api.getAdminResults(), this.api.getAdminVotes(), this.api.getSettings(),
      ]);
      this.sections.set(results.sections);
      this.source.set(results.source);
      this.winners.set(votes.winners ?? {});
      this.published.set(settings['results_published'] === '1');
      this.error.set('');
    } catch { this.error.set('تعذر تحميل النتائج.'); }
  }

  async setWinner(sectionId: number, projectId: number | null) {
    try {
      await this.api.setWinner(sectionId, projectId);
      this.winners.update((current) => {
        const next = { ...current };
        if (projectId === null) delete next[sectionId];
        else next[sectionId] = projectId;
        return next;
      });
      this.saved.set(true);
    } catch { this.error.set('تعذر حفظ الفائز اليدوي.'); }
  }

  async togglePublish() {
    try {
      await this.api.saveSettings({ results_published: this.published() ? '0' : '1' });
      this.published.update((value) => !value);
      this.saved.set(true);
    } catch { this.error.set('تعذر تحديث حالة النشر.'); }
  }
}
