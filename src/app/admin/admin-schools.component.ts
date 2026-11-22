import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSchool } from '../core/models';
import { notBlank } from './admin-helpers';
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
      <thead><tr><th>المدرسة</th><th></th></tr></thead>
      <tbody>
        @for (school of schools(); track school.id) {
          <tr>
            <td>{{ school.name }}</td>
            <td><button class="btn" (click)="edit(school)">تعديل</button></td>
          </tr>
        } @empty {
          <tr><td colspan="2">لا توجد مدارس بعد.</td></tr>
        }
      </tbody>
    </table>

    <dialog class="admin-dialog" #editDialog aria-labelledby="edit-school-title">
      <form class="admin-form" [formGroup]="editForm" method="dialog" (submit)="saveEdit($event)">
        <h2 id="edit-school-title">تعديل المدرسة</h2>
        <label>اسم المدرسة <input formControlName="name" lang="ar" autofocus required></label>
        @if (editError()) { <p class="admin-error">{{ editError() }}</p> }
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="closeEdit()">إلغاء</button>
          <button type="submit" class="btn primary" [disabled]="editForm.invalid || editBusy()">حفظ التعديلات</button>
        </div>
      </form>
    </dialog>
  </main>`,
  styles: `dialog label { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }`,
})
export class AdminSchoolsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly schools = signal<AdminSchool[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(150), notBlank]] });

  readonly editDialog = viewChild.required<ElementRef<HTMLDialogElement>>('editDialog');
  readonly editing = signal<AdminSchool | null>(null);
  readonly editBusy = signal(false);
  readonly editError = signal('');
  readonly editForm = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(150), notBlank]] });

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

  edit(school: AdminSchool) {
    this.editing.set(school);
    this.editError.set('');
    this.editForm.patchValue({ name: school.name });
    this.editDialog().nativeElement.showModal();
  }

  closeEdit() { this.editDialog().nativeElement.close(); }

  async saveEdit(event: Event) {
    event.preventDefault();
    if (this.editForm.invalid || !this.editing() || this.editBusy()) return;
    this.editBusy.set(true);
    const value = this.editForm.getRawValue();
    try {
      await this.api.updateSchool(this.editing()!.id, value.name);
      this.closeEdit();
      await this.load();
    } catch { this.editError.set('تعذر تحديث المدرسة.'); }
    finally { this.editBusy.set(false); }
  }
}
