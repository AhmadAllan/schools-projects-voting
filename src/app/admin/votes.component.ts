import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ResultSource } from '../core/models';

interface VoteRow {
  id: number;
  section_id: number;
  name: string;
  section_name: string;
  school_name: string;
  digital_votes: number;
  written_votes: number;
  announce_in_results: number;
  final_votes: number;
}

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <main class="votes-page">
    <nav><a routerLink="/admin">العودة إلى لوحة الإدارة</a><a routerLink="/winners">شاشة الإعلان</a></nav>
    <h1>الأصوات الإلكترونية والورقية</h1>
    <p class="hint">أدخل عدد الأصوات الورقية لكل مشروع، وحدد المشاريع التي تظهر في الإعلان. لا تُضاف الأصوات الورقية إلى الرقمية تلقائيًا؛ اختر مصدر الترتيب أدناه.</p>

    <label class="source">مصدر الترتيب والإعلان
      <select [ngModel]="source()" (ngModelChange)="changeSource($event)">
        <option value="digital">رقمي فقط</option>
        <option value="written">ورقي فقط</option>
        <option value="combined">دمج رقمي + ورقي</option>
        <option value="manual">اختيار يدوي للإدارة</option>
      </select>
    </label>

    @if (error()) { <p class="error">{{ error() }}</p> }

    <table>
      <thead><tr><th>القسم</th><th>المشروع</th><th>أصوات رقمية</th><th>أصوات ورقية</th><th>الإجمالي النهائي</th><th>عرض في الإعلان</th></tr></thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr>
            <td>{{ row.section_name }}</td>
            <td>{{ row.name }}<br><small>{{ row.school_name }}</small></td>
            <td>{{ row.digital_votes }}</td>
            <td>
              <input type="number" min="0" step="1" inputmode="numeric"
                [ngModel]="row.written_votes"
                (ngModelChange)="row.written_votes = $event"
                (change)="saveWritten(row)">
            </td>
            <td>{{ source() === 'manual' ? 'يدوي' : row.final_votes }}</td>
            <td>
              <label class="check">
                <input type="checkbox" [ngModel]="row.announce_in_results === 1" (ngModelChange)="updateAnnouncement(row, $event)">
                إعلان
              </label>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6">لا توجد مشاريع بعد.</td></tr>
        }
      </tbody>
    </table>

    <section class="manual">
      <h2>الفائز اليدوي لكل قسم</h2>
      <p>يُستخدم هذا الاختيار عندما يكون مصدر الترتيب والإعلان «اختيار يدوي للإدارة».</p>
      <div class="manual-grid">
        @for (section of sections(); track section.id) {
          <label>{{ section.name }}
            <select [ngModel]="winners()[section.id] ?? null" (ngModelChange)="setWinner(section.id, $event)">
              <option [ngValue]="null">بدون فائز</option>
              @for (project of section.projects; track project.id) {
                <option [ngValue]="project.id">{{ project.name }}</option>
              }
            </select>
          </label>
        }
      </div>
    </section>
  </main>`,
  styles: [`
    .votes-page{max-width:1100px;margin:auto;padding:1rem}
    .votes-page nav{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem}
    .votes-page nav a{padding:.6rem .9rem;border:1px solid #91aaa2;border-radius:.5rem}
    .hint{max-width:70ch;line-height:1.7;color:#33564c}
    .source{display:grid;gap:.5rem;max-width:28rem;margin:1.25rem 0}
    .source select{min-height:56px;padding:.5rem;border:1px solid #91aaa2;border-radius:.5rem}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{padding:.75rem;border-bottom:1px solid #bdd0c9;text-align:start;vertical-align:middle}
    input[type=number]{width:7rem;min-height:56px;padding:.5rem;border:1px solid #91aaa2;border-radius:.5rem}
    .check{display:inline-flex;align-items:center;gap:.5rem;min-height:56px}
    .manual{margin-top:2rem;padding-top:1.5rem;border-top:2px solid #bdd0c9}
    .manual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1rem}
    .manual-grid label{display:grid;gap:.5rem}
    .manual-grid select{min-height:56px;padding:.5rem;border:1px solid #91aaa2;border-radius:.5rem}
    .error{color:#9b1c1c}
    @media(max-width:700px){table{display:block;overflow-x:auto;white-space:nowrap}}
  `]
})
export class VotesComponent {
  private http = inject(HttpClient);
  readonly rows = signal<VoteRow[]>([]);
  readonly winners = signal<Record<number, number | undefined>>({});
  readonly source = signal<ResultSource>('digital');
  readonly error = signal('');
  readonly sections = computed(() => {
    const groups = new Map<number, { id: number; name: string; projects: VoteRow[] }>();
    for (const row of this.rows()) {
      const group = groups.get(row.section_id) ?? { id: row.section_id, name: row.section_name, projects: [] };
      group.projects.push(row);
      groups.set(row.section_id, group);
    }
    return Array.from(groups.values());
  });

  constructor() { void this.load(); }

  async load() {
    try {
      const data = await firstValueFrom(
        this.http.get<{ source: ResultSource; projects: VoteRow[]; winners: Record<number, number> }>('/api/admin/votes'),
      );
      this.source.set(data.source);
      this.rows.set(data.projects);
      this.winners.set(data.winners ?? {});
      this.error.set('');
    } catch {
      this.error.set('تعذر تحميل الأصوات. تأكد من تسجيل الدخول.');
    }
  }

  async changeSource(source: ResultSource) {
    this.source.set(source);
    try {
      await firstValueFrom(this.http.put('/api/admin/votes/source', { source }));
      await this.load();
    } catch {
      this.error.set('تعذر تحديث مصدر النتائج.');
    }
  }

  async saveWritten(row: VoteRow) {
    const writtenVotes = Number(row.written_votes);
    if (!Number.isInteger(writtenVotes) || writtenVotes < 0) {
      this.error.set('عدد الأصوات الورقية يجب أن يكون رقمًا صحيحًا غير سالب.');
      return;
    }
    try {
      await firstValueFrom(this.http.put(`/api/admin/votes/${row.id}`, { writtenVotes }));
      await this.load();
    } catch {
      this.error.set('تعذر حفظ الأصوات الورقية.');
    }
  }

  async updateAnnouncement(row: VoteRow, announceInResults: boolean) {
    row.announce_in_results = announceInResults ? 1 : 0;
    try {
      await firstValueFrom(this.http.put(`/api/admin/votes/${row.id}`, { announceInResults }));
    } catch {
      row.announce_in_results = announceInResults ? 0 : 1;
      this.error.set('تعذر تحديث حالة الإعلان.');
    }
  }

  async setWinner(sectionId: number, projectId: number | null) {
    try {
      if (projectId === null) {
        await firstValueFrom(this.http.delete(`/api/admin/winners/${sectionId}`));
      } else {
        await firstValueFrom(this.http.put(`/api/admin/winners/${sectionId}`, { project_id: projectId }));
      }
      this.winners.update((winners) => {
        const next = { ...winners };
        if (projectId === null) delete next[sectionId];
        else next[sectionId] = projectId;
        return next;
      });
    } catch {
      this.error.set('تعذر حفظ الفائز اليدوي.');
    }
  }
}
