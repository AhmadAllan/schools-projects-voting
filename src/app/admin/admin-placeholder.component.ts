import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>لوحة الإدارة</h1>
    <div class="actions">
      <a class="btn primary" routerLink="/kiosk">شاشة الكشك</a>
      <a class="btn" routerLink="/winners">شاشة الفائزين</a>
    </div>
    @if (event().name) { <p>الحدث الحالي: <strong>{{ event().name }}</strong> — {{ event().state }}</p> }
    <p>اختر صفحة من الأعلى لإدارة الأقسام والمدارس والمشاريع والأصوات والناخبين والنتائج والإعدادات.</p>
    <ul>
      <li><a routerLink="/admin/projects">أضف مشروعًا جديدًا</a> ليظهر في بطاقة التصويت.</li>
      <li><a routerLink="/admin/votes">الأصوات</a> لإدخال الأصوات الورقية واختيار مصدر الإعلان.</li>
      <li><a routerLink="/admin/results">النتائج</a> لمراجعة الترتيب والتعادلات ونشر النتائج.</li>
    </ul>
  </main>`,
  styles: `.actions { display: flex; gap: .75rem; flex-wrap: wrap; margin: 1rem 0; }`,
})
export class AdminPlaceholderComponent {
  private api = inject(ApiService);
  readonly event = signal<{ name: string; state: string }>({ name: '', state: '' });

  constructor() {
    void Promise.all([this.api.getSettings(), this.api.getStatus()]).then(([settings, status]) => {
      const labels: Record<string, string> = { open: 'التصويت مفتوح', closed: 'التصويت مغلق', not_started: 'لم يبدأ التصويت' };
      this.event.set({ name: settings['event_name'] ?? '', state: labels[status.state] ?? status.state });
    }).catch(() => this.event.set({ name: '', state: '' }));
  }
}
