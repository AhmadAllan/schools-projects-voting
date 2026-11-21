import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSection } from '../core/models';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>الأقسام</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="add()">
      <h2>إضافة قسم</h2>
      <label>اسم القسم <input formControlName="name" lang="ar" required></label>
      <label>الوصف <textarea formControlName="description" lang="ar"></textarea></label>
      <label>الترتيب <input formControlName="sortOrder" type="number" min="0" step="1"></label>
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">إضافة</button>
    </form>

    <table class="admin-table">
      <thead><tr><th>القسم</th><th>الوصف</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
      <tbody>
        @for (section of sections(); track section.id) {
          <tr>
            <td>{{ section.name }}</td>
            <td>{{ section.description || '—' }}</td>
            <td>{{ section.sort_order }}</td>
            <td>
              <span class="tag" [class.on]="section.is_active === 1" [class.off]="section.is_active === 0">
                {{ section.is_active === 1 ? 'نشط' : 'موقوف' }}
              </span>
            </td>
            <td>
              <button class="btn" (click)="toggle(section)">
                {{ section.is_active === 1 ? 'إيقاف' : 'تنشيط' }}
              </button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="5">لا توجد أقسام بعد.</td></tr>
        }
      </tbody>
    </table>
  </main>`,
})
export class AdminSectionsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly sections = signal<AdminSection[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    sortOrder: [0, [Validators.min(0)]],
  });

  constructor() { void this.load(); }

  async load() {
    try { this.sections.set(await this.api.getSections()); this.error.set(''); }
    catch { this.error.set('تعذر تحميل الأقسام.'); }
  }

  async add() {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.api.addSection({
        name: this.form.getRawValue().name,
        description: this.form.getRawValue().description || undefined,
        sort_order: this.form.getRawValue().sortOrder,
      });
      this.form.reset({ name: '', description: '', sortOrder: 0 });
      await this.load();
    } catch { this.error.set('تعذر إضافة القسم.'); }
    finally { this.busy.set(false); }
  }

  async toggle(section: AdminSection) {
    try {
      await this.api.updateSection(section.id, { is_active: section.is_active === 1 ? 0 : 1 });
      await this.load();
    } catch { this.error.set('تعذر تحديث حالة القسم.'); }
  }
}
