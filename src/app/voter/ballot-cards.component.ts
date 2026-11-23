import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Ballot, BallotProject, Selection } from '../core/models';
import { ProjectCardComponent } from './project-card.component';
import { ProjectDetailsDialogComponent } from './project-details-dialog.component';
import { VoteCounterComponent } from './vote-counter.component';

type SortMode = 'default' | 'name';

@Component({
  selector: 'app-ballot-cards',
  imports: [ProjectCardComponent, ProjectDetailsDialogComponent, VoteCounterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="state" role="status">جارٍ تحميل المشاريع…</p>
    } @else if (error()) {
      <div class="state error-block">
        <p role="alert">{{ error() }}</p>
        <button type="button" class="btn" (click)="retry.emit()">إعادة المحاولة</button>
      </div>
    } @else if (!sections().length) {
      <p class="state">لا توجد مشاريع بعد.</p>
    } @else {
      <nav class="filter-tabs" aria-label="تصفية الفئات">
        <button type="button" [class.active]="activeTab() === 0" (click)="activeTab.set(0)">
          الكل <span class="count">{{ sectionProjects().length }}</span>
        </button>
        @for (section of sections(); track section.id) {
          <button type="button" [class.active]="activeTab() === section.id" (click)="activeTab.set(section.id)">
            {{ section.name }} <span class="count">{{ countFor(section.id) }}</span>
          </button>
        }
      </nav>
      <div class="tools">
        <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="ابحث عن مشروع أو مدرسة…" aria-label="ابحث عن مشروع أو مدرسة">
        <label>
          <span class="sr-only">الترتيب</span>
          <select [value]="sortMode()" (change)="sortMode.set($any($event.target).value)">
            <option value="default">الترتيب: الافتراضي</option>
            <option value="name">أبجدي</option>
          </select>
        </label>
      </div>
      <div class="ballot-meta">
        <app-vote-counter [used]="selections().length" />
        <span class="rule-hint">اختر حتى 3 مشاريع من أي فئة</span>
      </div>
      @if (selections().length === 3) {
        <p class="limit-notice" role="status">وصلت إلى الحد الأقصى (3 أصوات). أزل أحد الاختيارات لتغيير صوتك</p>
      }
      @if (!visibleProjects().length) {
        <p class="state">لا توجد نتائج مطابقة لبحثك</p>
      } @else {
        <div class="cards">
          @for (project of visibleProjects(); track project.id) {
            <app-project-card
              [project]="project"
              [sectionName]="sectionNameOf(project)"
              [badgeIndex]="badgeIndexFor(project)"
              [selected]="isSelected(project.id)"
              [locked]="selections().length === 3"
              (toggle)="onToggle(project)"
              (details)="detailsProject.set(project)" />
          }
        </div>
      }
      <app-project-details-dialog
        [project]="detailsProject()"
        [sectionName]="detailsProject() ? sectionNameOf(detailsProject()!) : ''"
        [selected]="detailsProject() ? isSelected(detailsProject()!.id) : false"
        [locked]="selections().length === 3"
        (toggle)="onToggle(detailsProject()!)"
        (closed)="detailsProject.set(null)" />
    }
  `,
  styles: `
    .state { text-align: center; padding: 2rem 0; color: var(--text-muted); }
    .error-block { display: grid; justify-items: center; gap: .75rem; }
    .error-block p { margin: 0; color: var(--danger); }
    .filter-tabs { display: flex; flex-wrap: wrap; gap: .4rem; margin: .25rem 0 .75rem; }
    .filter-tabs button { min-height: 44px; padding: .3rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--surface); color: var(--text-muted); cursor: pointer; }
    .filter-tabs button:hover:not(.active) { background: var(--surface-tint); }
    .filter-tabs button.active { background: var(--primary); border-color: var(--primary); color: var(--on-primary); font-weight: 700; }
    .filter-tabs .count { opacity: .8; font-size: .85em; margin-inline-start: .15rem; }
    .tools { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: .75rem; }
    .tools input[type="search"] { flex: 2; min-width: 200px; }
    .tools select { flex: 1; min-width: 160px; }
    .ballot-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; margin: .25rem 0 .75rem; }
    .rule-hint { color: var(--text-muted); font-size: .9rem; }
    .limit-notice { margin: 0 0 .75rem; padding: .5rem .9rem; border-radius: var(--radius); background: var(--warn-bg); color: var(--warn-text); font-weight: 700; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    @media (max-width: 560px) { .tools { flex-direction: column; } .tools input, .tools select { width: 100%; } }
  `,
})
export class BallotCardsComponent {
  readonly ballot = input<Ballot | null>(null);
  readonly selections = input<Selection[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly toggle = output<Selection>();
  readonly retry = output<void>();

  protected readonly activeTab = signal(0);
  protected readonly query = signal('');
  protected readonly sortMode = signal<SortMode>('default');
  protected readonly detailsProject = signal<BallotProject | null>(null);

  protected readonly sections = computed(() => this.ballot()?.sections ?? []);
  protected readonly projects = computed(() => this.ballot()?.projects ?? []);
  private readonly sectionById = computed(() => new Map(this.sections().map((section) => [section.id, section])));

  /** مشاريع الأقسام النشطة فقط: مشروع بلا قسم ظاهر لا يُعرض ولا يُحتسب. */
  protected readonly sectionProjects = computed(() => this.projects().filter((project) => this.sectionById().has(project.section_id)));

  protected readonly visibleProjects = computed(() => {
    const tab = this.activeTab();
    const needle = normalizeText(this.query());
    const list = this.sectionProjects().filter((project) =>
      (tab === 0 || project.section_id === tab)
      && (needle === '' || normalizeText(`${project.name} ${project.school_name} ${project.description}`).includes(needle)));
    return this.sortMode() === 'name'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      : list;
  });

  protected countFor(sectionId: number) { return this.sectionProjects().filter((project) => project.section_id === sectionId).length; }
  protected sectionNameOf(project: BallotProject) { return this.sectionById().get(project.section_id)?.name ?? ''; }
  protected badgeIndexFor(project: BallotProject) { return this.sections().findIndex((section) => section.id === project.section_id); }
  protected isSelected(projectId: number) { return this.selections().some((selection) => selection.projectId === projectId); }

  protected onToggle(project: BallotProject) {
    this.toggle.emit({ sectionId: project.section_id, projectId: project.id });
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
