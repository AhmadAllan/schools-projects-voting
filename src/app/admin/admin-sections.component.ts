import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminSection, DeletePreview } from '../core/models';
import { notBlank } from './admin-helpers';
import { AdminNavComponent } from './admin-nav.component';
import { BulkDeleteDialogComponent } from './bulk-delete-dialog.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent, BulkDeleteDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>الأقسام</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }
    @if (summary()) { <p class="admin-ok" role="status">{{ summary() }}</p> }

    @if (selected().size) {
      <div class="bulk-bar">
        <span>المحدد: {{ selected().size }}</span>
        <button type="button" class="btn danger" (click)="requestDelete([...selected()])">حذف المحدد ({{ selected().size }})</button>
      </div>
    }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="add()">
      <h2>إضافة قسم</h2>
      <label>اسم القسم <input formControlName="name" lang="ar" required></label>
      <label>الوصف <textarea formControlName="description" lang="ar"></textarea></label>
      <label>الترتيب <input formControlName="sortOrder" type="number" min="0" step="1"></label>
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">إضافة</button>
    </form>

    <table class="admin-table">
      <thead><tr><th class="check-col"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll()" aria-label="تحديد كل الأقسام"></th><th>القسم</th><th>الوصف</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead>
      <tbody>
        @for (section of sections(); track section.id) {
          <tr>
            <td class="check-col"><input type="checkbox" [checked]="selected().has(section.id)" (change)="toggleSelect(section.id)" [attr.aria-label]="'تحديد ' + section.name"></td>
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
              <button class="btn danger" (click)="requestDelete([section.id])">حذف</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6">لا توجد أقسام بعد.</td></tr>
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

    <app-bulk-delete-dialog #deleteDialog title="تأكيد حذف الأقسام"
      [loading]="deleteLoading()" [preview]="deletePreview()" [busy]="deleteBusy()" [error]="deleteError()"
      (confirmed)="confirmDelete()" />
  </main>`,
  styles: `dialog label { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }
    .bulk-bar { display: flex; align-items: center; gap: .75rem; margin: .75rem 0; }
    .check-col { width: 2.5rem; text-align: center; }`,
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
  readonly deleteDialog = viewChild.required<BulkDeleteDialogComponent>('deleteDialog');
  readonly selected = signal<Set<number>>(new Set());
  readonly deleteLoading = signal(false);
  readonly deletePreview = signal<DeletePreview | null>(null);
  readonly deleteBusy = signal(false);
  readonly deleteError = signal('');
  readonly summary = signal('');
  private pendingDeleteIds: number[] = [];
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

  protected allSelected() {
    const sections = this.sections();
    return sections.length > 0 && sections.every((section) => this.selected().has(section.id));
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
      if (this.sections().every((section) => current.has(section.id))) return new Set<number>();
      return new Set(this.sections().map((section) => section.id));
    });
  }

  async requestDelete(ids: number[]) {
    this.pendingDeleteIds = ids;
    this.deleteLoading.set(true);
    this.deletePreview.set(null);
    this.deleteError.set('');
    this.summary.set('');
    this.deleteDialog().open();
    try { this.deletePreview.set(await this.api.previewDelete('sections', ids)); }
    catch { this.deleteError.set('تعذر حساب ما سيُحذف. أعد المحاولة.'); }
    finally { this.deleteLoading.set(false); }
  }

  async confirmDelete() {
    if (this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set('');
    try {
      const { deleted } = await this.api.bulkDelete('sections', this.pendingDeleteIds);
      this.deleteDialog().close();
      this.selected.set(new Set());
      this.summary.set(`تم حذف ${deleted.sections} قسم، ${deleted.projects} مشروع، ${deleted.votes} صوت`);
      await this.load();
    } catch { this.deleteError.set('تعذر تنفيذ الحذف.'); }
    finally { this.deleteBusy.set(false); }
  }
}
