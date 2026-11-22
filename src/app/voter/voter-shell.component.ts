import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Ballot } from '../core/models';
import { VoterStore } from './voter-store.service';
import { BallotCardsComponent } from './ballot-cards.component';

@Component({
  selector: 'app-voter-shell',
  imports: [FormsModule, BallotCardsComponent],
  template: `
  <main class="voter-shell">
    <header><h1>منافسة المشاريع المدرسية: التصويت</h1></header>
    @if (step() === 0) {
      <app-ballot-cards
        [ballot]="ballot()" [selections]="store.selections()"
        [loading]="ballotLoading()" [error]="ballotError()"
        (toggle)="store.toggleSelection($event.sectionId, $event.projectId)"
        (retry)="loadBallot()" />
      <button class="btn primary sticky" [disabled]="store.selections().length === 0 && step() === 0" (click)="step.set(1)">ابدأ التصويت</button>
    } @else if (step() === 1) {
      <section><h2>أدخل اسمك الرباعي</h2>
        <label>الاسم الأول<input lang="ar" autocomplete="off" [(ngModel)]="store.name().first"></label>
        <label>اسم الأب<input lang="ar" autocomplete="off" [(ngModel)]="store.name().father"></label>
        <label>اسم الجد<input lang="ar" autocomplete="off" [(ngModel)]="store.name().grandfather"></label>
        <label>اسم العائلة<input lang="ar" autocomplete="off" [(ngModel)]="store.name().family"></label>
        <button class="btn primary" [disabled]="!nameValid()" (click)="step.set(2)">متابعة الاختيار</button>
      </section>
    } @else if (step() === 2) {
      <section><h2>راجع اختياراتك</h2><p>بعد الإرسال لا يمكن تعديل الأصوات</p><button class="primary" [disabled]="store.submitting()" (click)="submit()">تأكيد وإرسال</button></section>
    } @else { <section><h2>شكراً لمشاركتك!</h2><p>تم تسجيل صوتك</p></section> }
  </main>`,
  styles: [`.voter-shell{display:block;width:100%;justify-items:stretch;max-width:1100px;margin:auto;padding:1rem}.voter-shell header{display:flex;justify-content:space-between}.primary{min-height:56px;padding:.75rem 1.5rem}.sticky{position:sticky;bottom:1rem;width:100%;box-shadow:var(--shadow-md)}label{display:grid;gap:.5rem;margin:1rem 0}input{min-height:56px;padding:.75rem}`]
})
export class VoterShellComponent {
  readonly store = inject(VoterStore); readonly step = this.store.step; readonly ballot = signal<Ballot|null>(null);
  readonly ballotLoading = signal(true); readonly ballotError = signal('');
  private api = inject(ApiService);
  constructor() { this.loadBallot(); }
  loadBallot() {
    this.ballotLoading.set(true); this.ballotError.set('');
    void this.api.getBallot()
      .then((ballot) => { this.ballot.set(ballot); })
      .catch(() => { this.ballotError.set('تعذر تحميل المشاريع. تحقق من الاتصال ثم أعد المحاولة.'); })
      .finally(() => { this.ballotLoading.set(false); });
  }
  nameValid() { const values = Object.values(this.store.name()); return values.every((value) => /^[ء-ي ]{3,30}$/.test(value.trim())); }
  async submit() {
    this.store.submitting.set(true);
    try { await this.api.submitVote({ requestId: this.store.requestId(), name: this.store.name(), selections: this.store.selections(), confirmDuplicate: this.store.duplicateWarning() }); this.step.set(3); }
    catch { this.store.submitting.set(false); }
  }
}
