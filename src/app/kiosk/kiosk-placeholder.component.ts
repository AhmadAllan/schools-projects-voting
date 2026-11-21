import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { VoterStore } from '../voter/voter-store.service';
import { KioskResetService } from './kiosk-reset.service';
import { KioskInactivityService } from './kiosk-inactivity.service';
@Component({ standalone: true, imports: [FormsModule], template: `
<main class="kiosk" (pointerdown)="activity()" (keydown)="activity()">
@if (step()===0){<button class="welcome" (click)="step.set(1)">ابدأ التصويت</button>}
@else if (step()===1){<section><h1>أدخل اسمك الرباعي</h1><label>الاسم الأول<input lang="ar" autocomplete="off" [(ngModel)]="store.name().first"></label><label>اسم الأب<input lang="ar" autocomplete="off" [(ngModel)]="store.name().father"></label><label>اسم الجد<input lang="ar" autocomplete="off" [(ngModel)]="store.name().grandfather"></label><label>اسم العائلة<input lang="ar" autocomplete="off" [(ngModel)]="store.name().family"></label><button (click)="step.set(2)">متابعة</button></section>}
@else if (step()===2){<section><h1>راجع اختياراتك</h1><button [disabled]="store.submitting()" (click)="submit()">تأكيد وإرسال</button></section>}
@else {<section><h1>شكراً لمشاركتك!</h1><p>سيتم الانتقال للمصوّت التالي خلال 5 ثوانٍ</p><button (click)="reset.reset()">المصوّت التالي</button></section>}
<button class="reset" (click)="reset.reset()">ابدأ من جديد</button>
@if(inactivity.warning()){<div class="warning"><h2>هل ما زلت هنا؟</h2><p>ستتم إعادة الضبط خلال {{ inactivity.countdown() }} ثانية</p><button (click)="activity()">نعم، أنا هنا</button></div>}
</main>`, styles:[`.kiosk{min-height:100dvh;padding:2rem}.kiosk button{min-height:56px;font-size:1.25rem}.welcome{width:min(520px,100%);min-height:160px;background:var(--surface);color:var(--text);border:2px solid var(--primary);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);transition:box-shadow .15s ease-out,translate .15s ease-out}@media(prefers-reduced-motion:no-preference){.welcome:hover:not(:disabled){translate:0 -2px}}.kiosk label{display:grid;margin:1rem 0}.kiosk input{min-height:56px}.reset{position:fixed;inset-block-start:1rem;inset-inline-end:1rem}.warning{position:fixed;inset:20%;display:grid;place-items:center;background:var(--surface);border:4px solid var(--primary);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg)}`]
})
export class KioskPlaceholderComponent {
  readonly store=inject(VoterStore); readonly reset=inject(KioskResetService); readonly inactivity=inject(KioskInactivityService); readonly step=signal(0); private api=inject(ApiService);
  constructor(){ this.inactivity.start(()=>this.reset.reset()); }
  activity(){ this.inactivity.touch(()=>this.reset.reset()); }
  async submit(){ this.store.submitting.set(true); try { await this.api.submitKioskVote({requestId:this.store.requestId(),name:this.store.name(),selections:this.store.selections(),confirmDuplicate:this.store.duplicateWarning()}); this.step.set(3); setTimeout(()=>this.reset.reset(),5000); } catch { this.store.submitting.set(false); } }
}
