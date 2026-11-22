import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
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

  <dialog class="admin-dialog" #voidDialog aria-labelledby="void-title">
    <h2 id="void-title">إلغاء أصوات الناخب</h2>
    <p>سيتم إلغاء أصوات <strong>{{ voiding()?.full_name }}</strong>. لا يمكن التراجع إلا بالاستعادة لاحقًا.</p>
    <label class="void-reason">سبب الإلغاء
      <textarea [value]="voidReason()" (input)="voidReason.set($any($event.target)?.value)" rows="3"></textarea>
    </label>
    @if (voidError()) { <p class="admin-error" role="alert">{{ voidError() }}</p> }
    <div class="dialog-actions">
      <button type="button" class="btn" (click)="closeVoid()">إلغاء</button>
      <button type="button" class="btn danger" [disabled]="voidBusy()" (click)="confirmVoid()">تأكيد الإلغاء</button>
    </div>
  </dialog>
  </main>`,
  styles: `.search { display: grid; gap: .4rem; max-width: 320px; margin: 1rem 0; }
    .void-reason { display: grid; gap: .4rem; margin: .75rem 0; }
    .dialog-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }`,
})
export class AdminVotersComponent {
  private api = inject(ApiService);
  readonly voters = signal<AdminVoter[]>([]);
  readonly query = signal('');
  readonly error = signal('');
  readonly voiding = signal<AdminVoter | null>(null);
  readonly voidReason = signal('تم الإلغاء من الإدارة');
  readonly voidError = signal('');
  readonly voidBusy = signal(false);
  readonly voidDialog = viewChild.required<ElementRef<HTMLDialogElement>>('voidDialog');
  readonly visible = computed(() => filterVoters(this.voters(), this.query()));
  readonly channelLabel = channelLabel;
  readonly formatDateTime = formatDateTime;

  constructor() { void this.load(); }

  async load() {
    try { this.voters.set(await this.api.getVoters()); this.error.set(''); }
    catch { this.error.set('تعذر تحميل الناخبين.'); }
  }

  voidVoter(voter: AdminVoter) {
    this.voiding.set(voter);
    this.voidReason.set(voter.void_reason ?? 'تم الإلغاء من الإدارة');
    this.voidError.set('');
    const dialog = this.voidDialog().nativeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  closeVoid() {
    const dialog = this.voidDialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  async confirmVoid() {
    const voter = this.voiding();
    if (!voter || this.voidBusy()) return;
    this.voidBusy.set(true);
    try {
      await this.api.voidVoter(voter.id, this.voidReason().trim() || 'تم الإلغاء من الإدارة');
      this.closeVoid();
      await this.load();
    } catch { this.voidError.set('تعذر إلغاء أصوات الناخب.'); }
    finally { this.voidBusy.set(false); }
  }

  async restore(voter: AdminVoter) {
    try {
      await this.api.restoreVoter(voter.id);
      await this.load();
    } catch { this.error.set('تعذر استعادة أصوات الناخب.'); }
  }
}
