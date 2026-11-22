import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { Ballot } from '../core/models';
import { VoterStore } from './voter-store.service';
import { BallotCardsComponent } from './ballot-cards.component';
import { VoterNameFormComponent } from './voter-name-form.component';
import { BallotReviewComponent, parseSubmitError, SubmitError, toReviewItems } from './ballot-review.component';

@Component({
  selector: 'app-voter-shell',
  imports: [BallotCardsComponent, VoterNameFormComponent, BallotReviewComponent],
  template: `
  <main class="voter-shell">
    <header><h1>منافسة المشاريع المدرسية: التصويت</h1></header>
    @if (step() === 0) {
      <app-ballot-cards
        [ballot]="ballot()" [selections]="store.selections()"
        [loading]="ballotLoading()" [error]="ballotError()"
        (toggle)="store.toggleSelection($event.sectionId, $event.projectId)"
        (retry)="loadBallot()" />
      <button class="btn primary sticky" [disabled]="store.selections().length === 0 && step() === 0" (click)="step.set(1)">متابعة</button>
    } @else if (step() === 1) {
      <app-voter-name-form [initial]="store.name()" (nameChange)="store.name.set($event)" (continueWith)="step.set(2)" />
    } @else if (step() === 2) {
      <app-ballot-review
        [items]="reviewItems()" [submitting]="store.submitting()" [submitError]="submitError()"
        (confirm)="submit()" (confirmDuplicate)="submit(true)" />
    } @else { <section><h2>شكراً لمشاركتك!</h2><p>تم تسجيل صوتك</p></section> }
  </main>`,
  styles: [`.voter-shell{display:block;width:100%;justify-items:stretch;max-width:1100px;margin:auto;padding:1rem}.voter-shell header{display:flex;justify-content:space-between}.primary{min-height:56px;padding:.75rem 1.5rem}.sticky{position:sticky;bottom:1rem;width:100%;box-shadow:var(--shadow-md)}label{display:grid;gap:.5rem;margin:1rem 0}input{min-height:56px;padding:.75rem}`]
})
export class VoterShellComponent {
  readonly store = inject(VoterStore); readonly step = this.store.step; readonly ballot = signal<Ballot|null>(null);
  readonly ballotLoading = signal(true); readonly ballotError = signal('');
  readonly submitError = signal<SubmitError | null>(null);
  readonly reviewItems = computed(() => toReviewItems(this.ballot(), this.store.selections()));
  private api = inject(ApiService);
  constructor() { this.loadBallot(); }
  loadBallot() {
    this.ballotLoading.set(true); this.ballotError.set('');
    void this.api.getBallot()
      .then((ballot) => { this.ballot.set(ballot); })
      .catch(() => { this.ballotError.set('تعذر تحميل المشاريع. تحقق من الاتصال ثم أعد المحاولة.'); })
      .finally(() => { this.ballotLoading.set(false); });
  }
  async submit(confirmedDuplicate = false) {
    if (confirmedDuplicate) this.store.duplicateWarning.set(true);
    this.store.submitting.set(true);
    this.submitError.set(null);
    try {
      await this.api.submitVote({ requestId: this.store.requestId(), name: this.store.name(), selections: this.store.selections(), confirmDuplicate: this.store.duplicateWarning() });
      this.step.set(3);
    } catch (e) {
      this.submitError.set(parseSubmitError(e));
      this.store.submitting.set(false);
    }
  }
}
