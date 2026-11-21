import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AdminVoter } from '../core/models';
import { AdminNavComponent } from './admin-nav.component';
import { channelLabel, filterVoters, formatDateTime } from './admin-helpers';

@Component({
  imports: [FormsModule, AdminNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <main class="admin-shell">
    <app-admin-nav />
    <h1>الناخبون</h1>
    <label class="search">بحث بالاسم
      <input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="اكتب جزءًا من الاسم">
    </label>
    @if (error()) { <p class="admin-error">{{ error() }}</p> }

    <table class="admin-table">
      <thead><tr><th>الاسم</th><th>القناة</th><th>الوقت</th><th>الحالة</th><th></th></tr></thead>
      <tbody>
        @for (voter of visible(); track voter.id) {
          <tr>
            <td>{{ voter.full_name }}</td>
            <td>{{ channelLabel(voter.channel) }}</td>
            <td>{{ formatDateTime(voter.created_at) }}</td>
            <td>
              @if (voter.voided === 1) { <span class="tag off">ملغى</span> }
              @else if (voter.is_duplicate === 1) { <span class="tag warn">اسم مكرر</span> }
              @else { <span class="tag on">سليم</span> }
            </td>
            <td>
              @if (voter.voided === 1) {
                <button class="btn" (click)="restore(voter)">استعادة</button>
              } @else {
                <button class="btn danger" (click)="voidVoter(voter)">إلغاء الأصوات</button>
              }
            </td>
          </tr>
        } @empty {
          <tr><td colspan="5">لا يوجد ناخبون مطابقون.</td></tr>
        }
      </tbody>
    </table>
  </main>`,
  styles: `.search { display: grid; gap: .4rem; max-width: 320px; margin: 1rem 0; }
    .search input { min-height: 48px; padding: .4rem .6rem; border: 1px solid #91aaa2; border-radius: .4rem; }`,
})
export class AdminVotersComponent {
  private api = inject(ApiService);
  readonly voters = signal<AdminVoter[]>([]);
  readonly query = signal('');
  readonly error = signal('');
  readonly visible = computed(() => filterVoters(this.voters(), this.query()));
  readonly channelLabel = channelLabel;
  readonly formatDateTime = formatDateTime;

  constructor() { void this.load(); }

  async load() {
    try { this.voters.set(await this.api.getVoters()); this.error.set(''); }
    catch { this.error.set('تعذر تحميل الناخبين.'); }
  }

  async voidVoter(voter: AdminVoter) {
    const reason = window.prompt('سبب إلغاء أصوات هذا الناخب؟', 'تم الإلغاء من الإدارة');
    if (reason === null) return;
    try {
      await this.api.voidVoter(voter.id, reason || 'تم الإلغاء من الإدارة');
      await this.load();
    } catch { this.error.set('تعذر إلغاء أصوات الناخب.'); }
  }

  async restore(voter: AdminVoter) {
    try {
      await this.api.restoreVoter(voter.id);
      await this.load();
    } catch { this.error.set('تعذر استعادة أصوات الناخب.'); }
  }
}
