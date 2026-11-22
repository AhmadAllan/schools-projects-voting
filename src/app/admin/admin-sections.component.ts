import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSection } from '../core/models';
import { notBlank } from './admin-helpers';
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
              <button class="btn" (click)="edit(section)">تعديل</button>
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

    <dialog class="admin-dialog" #editDialog aria-labelledby="edit-section-title">
      <form class="admin-form" [formGroup]="editForm" method="dialog" (submit)="saveEdit($event)">
        <h2 id="edit-section-title">تعديل القسم</h2>
        <label>اسم القسم <input formControlName="name" lang="ar" autofocus required></label>
        <label>الوصف <textarea formControlName="description" lang="ar"></textarea></label>
        <label>الترتيب <input formControlName="sortOrder" type="number" min="0" step="1"></label>
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
export class AdminSectionsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly sections = signal<AdminSection[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100), notBlank]],
    description: [''],
    sortOrder: [0, [Validators.min(0)]],
  });

  readonly editDialog = viewChild.required<ElementRef<HTMLDialogElement>>('editDialog');
  readonly editing = signal<AdminSection | null>(null);
  readonly editBusy = signal(false);
  readonly editError = signal('');
  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100), notBlank]],
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

  edit(section: AdminSection) {
    this.editing.set(section);
    this.editError.set('');
    this.editForm.patchValue({ name: section.name, description: section.description ?? '', sortOrder: section.sort_order });
    this.editDialog().nativeElement.showModal();
  }

  closeEdit() { this.editDialog().nativeElement.close(); }

  async saveEdit(event: Event) {
    event.preventDefault();
    if (this.editForm.invalid || !this.editing() || this.editBusy()) return;
    this.editBusy.set(true);
    const value = this.editForm.getRawValue();
    try {
      await this.api.updateSection(this.editing()!.id, { name: value.name, description: value.description, sort_order: value.sortOrder });
      this.closeEdit();
      await this.load();
    } catch { this.editError.set('تعذر تحديث القسم.'); }
    finally { this.editBusy.set(false); }
  }
}
