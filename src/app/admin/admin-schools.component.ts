import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSchool } from '../core/models';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>المدارس</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="add()">
      <h2>إضافة مدرسة</h2>
      <label>اسم المدرسة <input formControlName="name" lang="ar" required></label>
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">إضافة</button>
    </form>

    <table class="admin-table">
      <thead><tr><th>المدرسة</th></tr></thead>
      <tbody>
        @for (school of schools(); track school.id) {
          <tr><td>{{ school.name }}</td></tr>
        } @empty {
          <tr><td>لا توجد مدارس بعد.</td></tr>
        }
      </tbody>
    </table>
  </main>`,
})
export class AdminSchoolsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly schools = signal<AdminSchool[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(150)]] });

  constructor() { void this.load(); }

  async load() {
    try { this.schools.set(await this.api.getSchools()); this.error.set(''); }
    catch { this.error.set('تعذر تحميل المدارس.'); }
  }

  async add() {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.api.addSchool(this.form.getRawValue().name);
      this.form.reset({ name: '' });
      await this.load();
    } catch { this.error.set('تعذر إضافة المدرسة.'); }
    finally { this.busy.set(false); }
  }
}
