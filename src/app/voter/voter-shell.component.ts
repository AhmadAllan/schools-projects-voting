import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Ballot, BallotProject } from '../core/models';
import { VoterStore } from './voter-store.service';

@Component({
  selector: 'app-voter-shell',
  standalone: true,
  imports: [FormsModule],
  template: `
  <main class="voter-shell">
    <header><h1>منافسة المشاريع المدرسية: التصويت</h1><strong>اخترت {{ store.selections().length }} من 3</strong></header>
    @if (step() === 0) {
      <section><h2>المشاريع المشاركة</h2>
        @for (section of ballot()?.sections ?? []; track section.id) {
          <h3>{{ section.name }}</h3><div class="cards">
            @for (project of projectsFor(section.id); track project.id) {
              <button type="button" class="project-card" [disabled]="store.selections().length === 3 && !selectedInSection(section.id)" (click)="store.toggleSelection(section.id, project.id)">
                @if (project.image_url) { <img [src]="project.image_url" [alt]="project.name" loading="lazy"> }
                <strong>{{ project.name }}</strong><span>{{ project.description }}</span><small>{{ project.school_name }}</small>
                @if (store.selections().some((selection) => selection.projectId === project.id)) { <b>✓</b> }
              </button>
            }
          </div>
        }
      </section>
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
  styles: [`.voter-shell{display:block;width:100%;justify-items:stretch;max-width:1100px;margin:auto;padding:1rem}.voter-shell header{display:flex;justify-content:space-between}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}.project-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:.4rem;min-height:180px;text-align:start;padding:1rem;border:2px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-sm);cursor:pointer;transition:box-shadow .15s ease-out,translate .15s ease-out,background-color .15s ease-out}.project-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius)}.project-card b{position:absolute;top:.6rem;inset-inline-end:.6rem;width:1.5rem;height:1.5rem;border-radius:50%;background:var(--primary);color:var(--on-primary);display:grid;place-items:center}.project-card:disabled{cursor:not-allowed}.project-card:has(b){border-color:var(--primary);background:var(--surface-selected);box-shadow:var(--shadow-md)}@media(prefers-reduced-motion:no-preference){.project-card:hover:not(:disabled){translate:0 -2px;box-shadow:var(--shadow-md)}}.primary{min-height:56px;padding:.75rem 1.5rem}.sticky{position:sticky;bottom:1rem;width:100%;box-shadow:var(--shadow-md)}label{display:grid;gap:.5rem;margin:1rem 0}input{min-height:56px;padding:.75rem}`]
})
export class VoterShellComponent {
  readonly store = inject(VoterStore); readonly step = this.store.step; readonly ballot = signal<Ballot|null>(null);
  private api = inject(ApiService);
  constructor() { void this.api.getBallot().then((ballot) => this.ballot.set(ballot)); }
  projectsFor(sectionId: number) { return (this.ballot()?.projects ?? []).filter((project) => project.section_id === sectionId); }
  selectedInSection(sectionId: number) { return this.store.selections().some((selection) => selection.sectionId === sectionId); }
  nameValid() { const values = Object.values(this.store.name()); return values.every((value) => /^[ء-ي ]{3,30}$/.test(value.trim())); }
  async submit() {
    this.store.submitting.set(true);
    try { await this.api.submitVote({ requestId: this.store.requestId(), name: this.store.name(), selections: this.store.selections(), confirmDuplicate: this.store.duplicateWarning() }); this.step.set(3); }
    catch { this.store.submitting.set(false); }
  }
}
