import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminProject, AdminSchool, AdminSection, DeletePreview } from '../core/models';
import { notBlank } from './admin-helpers';
import { AdminNavComponent } from './admin-nav.component';
import { BulkDeleteDialogComponent } from './bulk-delete-dialog.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent, BulkDeleteDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>المشاريع</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }
    @if (summary()) { <p class="admin-ok" role="status">{{ summary() }}</p> }

    @if (selected().size) {
      <div class="bulk-bar">
        <span>المحدد: {{ selected().size }}</span>
        <button type="button" class="btn danger" (click)="requestDelete([...selected()])">حذف المحدد ({{ selected().size }})</button>
      </div>
    }

    <form class="admin-form" [formGroup]="form" (ngSubmit)="add()">
      <h2>إضافة مشروع</h2>
      <label>اسم المشروع <input formControlName="name" lang="ar" required></label>
      <label>الوصف <textarea formControlName="description" lang="ar" required></textarea></label>
      <label>القسم
        <select formControlName="sectionId" required>
          <option [ngValue]="null">اختر القسم</option>
          @for (section of sections(); track section.id) {
            <option [ngValue]="section.id">{{ section.name }}</option>
          }
        </select>
      </label>
      <label>المدرسة
        <select formControlName="schoolId" required>
          <option [ngValue]="null">اختر المدرسة</option>
          @for (school of schools(); track school.id) {
            <option [ngValue]="school.id">{{ school.name }}</option>
          }
        </select>
      </label>
      <label>رابط المشروع (اختياري) <input formControlName="url" type="url" placeholder="https://"></label>
      <label>رابط صورة (اختياري) <input formControlName="imageUrl" type="url" placeholder="https://"></label>
      <label>أو ارفع صورة (حتى 300 كيلوبايت)
        <input #fileInput type="file" accept="image/png,image/jpeg,image/webp" (change)="pickFile($event)">
      </label>
      @if (file()) { <p class="admin-ok">تم اختيار: {{ file()!.name }}</p> }
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">{{ busy() ? 'جارٍ الحفظ…' : 'إضافة' }}</button>
    </form>

    <table class="admin-table">
      <thead><tr><th class="check-col"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll()" aria-label="تحديد كل المشاريع"></th><th>القسم</th><th>المشروع</th><th>المدرسة</th><th>الصورة</th><th>الحالة</th><th></th></tr></thead>
      <tbody>
        @for (project of projects(); track project.id) {
          <tr>
            <td class="check-col"><input type="checkbox" [checked]="selected().has(project.id)" (change)="toggleSelect(project.id)" [attr.aria-label]="'تحديد ' + project.name"></td>
            <td>{{ project.section_name }}</td>
            <td>
              {{ project.name }}
              @if (project.url) { <br><a [href]="project.url" target="_blank" rel="noopener">{{ project.url }}</a> }
            </td>
            <td>{{ project.school_name }}</td>
            <td>
              @if (project.image_url || project.image_id) { <span class="tag on">موجودة</span> }
              @else { <span class="tag">بدون</span> }
            </td>
            <td>
              <span class="tag" [class.on]="project.is_active === 1" [class.off]="project.is_active === 0">
                {{ project.is_active === 1 ? 'نشط' : 'موقوف' }}
              </span>
            </td>
            <td>
              <button class="btn" (click)="edit(project)">تعديل</button>
              <button class="btn" (click)="toggle(project)">{{ project.is_active === 1 ? 'إيقاف' : 'تنشيط' }}</button>
              <button class="btn danger" (click)="requestDelete([project.id])">حذف</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="7">لا توجد مشاريع بعد.</td></tr>
        }
      </tbody>
    </table>

    <dialog class="admin-dialog" #editDialog aria-labelledby="edit-project-title">
      <form class="admin-form" [formGroup]="editForm" method="dialog" (submit)="saveEdit($event)">
        <h2 id="edit-project-title">تعديل المشروع</h2>
        <label>اسم المشروع <input formControlName="name" lang="ar" autofocus required></label>
        <label>الوصف <textarea formControlName="description" lang="ar" required></textarea></label>
        <label>القسم
          <select formControlName="sectionId" required>
            <option [ngValue]="null">اختر القسم</option>
            @for (section of sections(); track section.id) {
              <option [ngValue]="section.id">{{ section.name }}</option>
            }
          </select>
        </label>
        <label>المدرسة
          <select formControlName="schoolId" required>
            <option [ngValue]="null">اختر المدرسة</option>
            @for (school of schools(); track school.id) {
              <option [ngValue]="school.id">{{ school.name }}</option>
            }
          </select>
        </label>
        <label>رابط المشروع (اختياري) <input formControlName="url" type="url" placeholder="https://"></label>
        <label>رابط صورة (اختياري) <input formControlName="imageUrl" type="url" placeholder="https://"></label>
        <label>أو ارفع صورة جديدة (حتى 300 كيلوبايت)
          <input #editFileInput type="file" accept="image/png,image/jpeg,image/webp" (change)="pickEditFile($event)">
        </label>
        @if (editFile()) { <p class="admin-ok">تم اختيار: {{ editFile()!.name }}</p> }
        @if (editError()) { <p class="admin-error">{{ editError() }}</p> }
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="closeEdit()">إلغاء</button>
          <button type="submit" class="btn primary" [disabled]="editForm.invalid || editBusy()">
            {{ editBusy() ? 'جارٍ الحفظ…' : 'حفظ التعديلات' }}
          </button>
        </div>
      </form>
    </dialog>

    <app-bulk-delete-dialog #deleteDialog title="تأكيد حذف المشاريع"
      [loading]="deleteLoading()" [preview]="deletePreview()" [busy]="deleteBusy()" [error]="deleteError()"
      (confirmed)="confirmDelete()" />
  </main>`,
  styles: `dialog label { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }
    .bulk-bar { display: flex; align-items: center; gap: .75rem; margin: .75rem 0; }
    .check-col { width: 2.5rem; text-align: center; }`,
})
export class AdminProjectsComponent {
  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  readonly projects = signal<AdminProject[]>([]);
  readonly sections = signal<AdminSection[]>([]);
  readonly schools = signal<AdminSchool[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly file = signal<File | null>(null);
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200), notBlank]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    sectionId: this.fb.control<number | null>(null, [Validators.required]),
    schoolId: this.fb.control<number | null>(null, [Validators.required]),
    url: [''],
    imageUrl: [''],
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
  readonly editing = signal<AdminProject | null>(null);
  readonly editBusy = signal(false);
  readonly editFile = signal<File | null>(null);
  readonly editError = signal('');
  readonly editFileInput = viewChild.required<ElementRef<HTMLInputElement>>('editFileInput');
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200), notBlank]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    sectionId: this.fb.control<number | null>(null, [Validators.required]),
    schoolId: this.fb.control<number | null>(null, [Validators.required]),
    url: [''],
    imageUrl: [''],
  });

  constructor() { void this.load(); }

  async load() {
    try {
      const [projects, sections, schools] = await Promise.all([
        this.api.getProjects(), this.api.getSections(), this.api.getSchools(),
      ]);
      this.projects.set(projects);
      this.sections.set(sections.filter((section) => section.is_active === 1));
      this.schools.set(schools);
      this.error.set('');
    } catch { this.error.set('تعذر تحميل المشاريع.'); }
  }

  pickFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
  }

  pickEditFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editFile.set(input.files?.[0] ?? null);
  }

  async add() {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const value = this.form.getRawValue();
      let imageId: number | undefined;
      if (this.file()) {
        const uploaded = await this.api.uploadImage(this.file()!);
        imageId = uploaded.id;
      }
      await this.api.addProject({
        name: value.name,
        description: value.description,
        section_id: value.sectionId!,
        school_id: value.schoolId!,
        url: value.url || undefined,
        image_url: value.imageUrl || undefined,
        image_id: imageId,
      });
      this.form.reset({ name: '', description: '', sectionId: null, schoolId: null, url: '', imageUrl: '' });
      this.file.set(null);
      this.fileInput().nativeElement.value = '';
      await this.load();
    } catch { this.error.set('تعذر إضافة المشروع. تحقق من البيانات وحجم الصورة.'); }
    finally { this.busy.set(false); }
  }

  async toggle(project: AdminProject) {
    try {
      await this.api.updateProject(project.id, { is_active: project.is_active === 1 ? 0 : 1 });
      await this.load();
    } catch { this.error.set('تعذر تحديث حالة المشروع.'); }
  }

  edit(project: AdminProject) {
    this.editing.set(project);
    this.editFile.set(null);
    this.editError.set('');
    this.editFileInput().nativeElement.value = '';
    this.editForm.patchValue({
      name: project.name,
      description: project.description,
      sectionId: project.section_id,
      schoolId: project.school_id,
      url: project.url ?? '',
      imageUrl: project.image_url ?? '',
    });
    this.editDialog().nativeElement.showModal();
  }

  closeEdit() { this.editDialog().nativeElement.close(); }

  async saveEdit(event: Event) {
    event.preventDefault();
    if (this.editForm.invalid || !this.editing() || this.editBusy()) return;
    this.editBusy.set(true);
    try {
      const value = this.editForm.getRawValue();
      const patch: Parameters<ApiService['updateProject']>[1] = {
        name: value.name,
        description: value.description,
        section_id: value.sectionId!,
        school_id: value.schoolId!,
        url: value.url || '',
        image_url: this.editFile() ? '' : value.imageUrl || '',
      };
      if (this.editFile()) {
        const uploaded = await this.api.uploadImage(this.editFile()!);
        patch.image_id = uploaded.id;
      }
      await this.api.updateProject(this.editing()!.id, patch);
      this.closeEdit();
      await this.load();
    } catch { this.editError.set('تعذر تحديث المشروع. تحقق من البيانات وحجم الصورة.'); }
    finally { this.editBusy.set(false); }
  }

  protected allSelected() {
    const projects = this.projects();
    return projects.length > 0 && projects.every((project) => this.selected().has(project.id));
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
      if (this.projects().every((project) => current.has(project.id))) return new Set<number>();
      return new Set(this.projects().map((project) => project.id));
    });
  }

  async requestDelete(ids: number[]) {
    this.pendingDeleteIds = ids;
    this.deleteLoading.set(true);
    this.deletePreview.set(null);
    this.deleteError.set('');
    this.summary.set('');
    this.deleteDialog().open();
    try { this.deletePreview.set(await this.api.previewDelete('projects', ids)); }
    catch { this.deleteError.set('تعذر حساب ما سيُحذف. أعد المحاولة.'); }
    finally { this.deleteLoading.set(false); }
  }

  async confirmDelete() {
    if (this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set('');
    try {
      const { deleted } = await this.api.bulkDelete('projects', this.pendingDeleteIds);
      this.deleteDialog().close();
      this.selected.set(new Set());
      this.summary.set(`تم حذف ${deleted.projects} مشروع، ${deleted.votes} صوت`);
      await this.load();
    } catch { this.deleteError.set('تعذر تنفيذ الحذف.'); }
    finally { this.deleteBusy.set(false); }
  }
}
