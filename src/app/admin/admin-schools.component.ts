import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSchool, DeletePreview } from '../core/models';
import { notBlank } from './admin-helpers';
import { AdminNavComponent } from './admin-nav.component';
import { BulkDeleteDialogComponent } from './bulk-delete-dialog.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent, BulkDeleteDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>المدارس</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }
    @if (summary()) { <p class="admin-ok" role="status">{{ summary() }}</p> }

    @if (selected().size) {
      <div class="bulk-bar">
        <span>المحدد: {{ selected().size }}</span>
        <button type="button" class="btn danger" (click)="requestDelete([...selected()])">حذف المحدد ({{ selected().size }})</button>
      </div>
    }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="add()">
      <h2>إضافة مدرسة</h2>
      <label>اسم المدرسة <input formControlName="name" lang="ar" required></label>
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">إضافة</button>
    </form>

    <table class="admin-table">
      <thead><tr><th class="check-col"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll()" aria-label="تحديد كل المدارس"></th><th>المدرسة</th><th></th></tr></thead>
      <tbody>
        @for (school of schools(); track school.id) {
          <tr>
            <td class="check-col"><input type="checkbox" [checked]="selected().has(school.id)" (change)="toggleSelect(school.id)" [attr.aria-label]="'تحديد ' + school.name"></td>
            <td>{{ school.name }}</td>
            <td>
              <button class="btn" (click)="edit(school)">تعديل</button>
              <button class="btn danger" (click)="requestDelete([school.id])">حذف</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="3">لا توجد مدارس بعد.</td></tr>
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

    <app-bulk-delete-dialog #deleteDialog title="تأكيد حذف المدارس"
      [loading]="deleteLoading()" [preview]="deletePreview()" [busy]="deleteBusy()" [error]="deleteError()"
      (confirmed)="confirmDelete()" />
  </main>`,
  styles: `dialog label { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }
    .bulk-bar { display: flex; align-items: center; gap: .75rem; margin: .75rem 0; }
    .check-col { width: 2.5rem; text-align: center; }`,
})
export class AdminSchoolsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly schools = signal<AdminSchool[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(150), notBlank]] });

  readonly editDialog = viewChild.required<ElementRef<HTMLDialogElement>>('editDialog');
  readonly deleteDialog = viewChild.required<BulkDeleteDialogComponent>('deleteDialog');
  readonly selected = signal<Set<number>>(new Set());
  readonly deleteLoading = signal(false);
  readonly deletePreview = signal<DeletePreview | null>(null);
  readonly deleteBusy = signal(false);
  readonly deleteError = signal('');
  readonly summary = signal('');
  private pendingDeleteIds: number[] = [];
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

  protected allSelected() {
    const schools = this.schools();
    return schools.length > 0 && schools.every((school) => this.selected().has(school.id));
  }

  protected toggleSelect(id: number) {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  protected toggleSelectAll() {
    this.selected.update((current) => {
      if (this.schools().every((school) => current.has(school.id))) return new Set<number>();
      return new Set(this.schools().map((school) => school.id));
    });
  }

  async requestDelete(ids: number[]) {
    this.pendingDeleteIds = ids;
    this.deleteLoading.set(true);
    this.deletePreview.set(null);
    this.deleteError.set('');
    this.summary.set('');
    this.deleteDialog().open();
    try { this.deletePreview.set(await this.api.previewDelete('schools', ids)); }
    catch { this.deleteError.set('تعذر حساب ما سيُحذف. أعد المحاولة.'); }
    finally { this.deleteLoading.set(false); }
  }

  async confirmDelete() {
    if (this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set('');
    try {
      const { deleted } = await this.api.bulkDelete('schools', this.pendingDeleteIds);
      this.deleteDialog().close();
      this.selected.set(new Set());
      this.summary.set(`تم حذف ${deleted.schools} مدرسة، ${deleted.projects} مشروع، ${deleted.votes} صوت`);
      await this.load();
    } catch { this.deleteError.set('تعذر تنفيذ الحذف.'); }
    finally { this.deleteBusy.set(false); }
  }
}
