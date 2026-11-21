import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminProject, AdminSchool, AdminSection } from '../core/models';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  imports: [ReactiveFormsModule, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>المشاريع</h1>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }

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
        <input type="file" accept="image/png,image/jpeg,image/webp" (change)="pickFile($event)">
      </label>
      @if (file()) { <p class="admin-ok">تم اختيار: {{ file()!.name }}</p> }
      <button class="btn primary" type="submit" [disabled]="form.invalid || busy()">{{ busy() ? 'جارٍ الحفظ…' : 'إضافة' }}</button>
    </form>

    <table class="admin-table">
      <thead><tr><th>القسم</th><th>المشروع</th><th>المدرسة</th><th>الصورة</th><th>الحالة</th><th></th></tr></thead>
      <tbody>
        @for (project of projects(); track project.id) {
          <tr>
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
              <button class="btn" (click)="toggle(project)">{{ project.is_active === 1 ? 'إيقاف' : 'تنشيط' }}</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6">لا توجد مشاريع بعد.</td></tr>
        }
      </tbody>
    </table>
  </main>`,
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
    name: ['', [Validators.required, Validators.maxLength(200)]],
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
}
