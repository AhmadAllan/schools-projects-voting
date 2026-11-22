import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Ballot } from '../core/models';
import { VoterStore } from '../voter/voter-store.service';
import { BallotCardsComponent } from '../voter/ballot-cards.component';
import { KioskResetService } from './kiosk-reset.service';
import { KioskInactivityService } from './kiosk-inactivity.service';
@Component({ imports: [FormsModule, BallotCardsComponent], template: `
<main class="kiosk" (pointerdown)="activity()" (keydown)="activity()">
  @if (step()===0){<button class="welcome" (click)="step.set(1)">ابدأ التصويت</button>}
  @else if (step()===1){<section><h1>أدخل اسمك الرباعي</h1><label>الاسم الأول<input lang="ar" autocomplete="off" [(ngModel)]="store.name().first"></label><label>اسم الأب<input lang="ar" autocomplete="off" [(ngModel)]="store.name().father"></label><label>اسم الجد<input lang="ar" autocomplete="off" [(ngModel)]="store.name().grandfather"></label><label>اسم العائلة<input lang="ar" autocomplete="off" [(ngModel)]="store.name().family"></label><button [disabled]="!nameValid()" (click)="step.set(2)">متابعة</button></section>}
  @else if (step()===2){<section><h1>اختر المشاريع</h1>
    <app-ballot-cards
      [ballot]="ballot()" [selections]="store.selections()"
      [loading]="ballotLoading()" [error]="ballotError()"
      (toggle)="store.toggleSelection($event.sectionId, $event.projectId)"
      (retry)="loadBallot()" />
    <button class="primary sticky" [disabled]="store.selections().length === 0" (click)="step.set(3)">إنهاء التصويت</button>
  </section>}
  @else if (step()===3){<section><h1>راجع اختياراتك</h1><p>بعد الإرسال لا يمكن تعديل الأصوات</p><button [disabled]="store.submitting()" (click)="submit()">تأكيد وإرسال</button></section>}
  @else {<section><h1>شكراً لمشاركتك!</h1><p>سيتم الانتقال للمصوّت التالي خلال 5 ثوانٍ</p><button (click)="reset.reset()">المصوّت التالي</button></section>}
  <button class="reset" (click)="requestReset()">ابدأ من جديد</button>
  <button type="button" class="admin-exit" (click)="requestAdminExit()">العودة إلى لوحة الإدارة</button>
  <dialog #resetDialog (close)="onResetDialogClose()" aria-labelledby="reset-warn-title" class="reset-dialog">
    <h2 id="reset-warn-title">بدء التصويت من جديد؟</h2>
    <p>لن يتم حفظ صوت هذا المصوّت.</p>
    <form method="dialog">
      <button type="submit" value="cancel" autofocus>إلغاء</button>
      <button type="submit" value="confirm" class="primary">بدء من جديد</button>
    </form>
  </dialog>
  @if(inactivity.warning()){<div class="warning"><h2>هل ما زلت هنا؟</h2><p>ستتم إعادة الضبط خلال {{ inactivity.countdown() }} ثانية</p><button (click)="activity()">نعم، أنا هنا</button></div>}
</main>`, styles:[`.kiosk{min-height:100dvh;padding:2rem}.kiosk button{min-height:56px;font-size:1.25rem}.welcome{width:min(520px,100%);min-height:160px;background:var(--surface);color:var(--text);border:2px solid var(--primary);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);transition:box-shadow .15s ease-out,translate .15s ease-out}@media(prefers-reduced-motion:no-preference){.welcome:hover:not(:disabled){translate:0 -2px}}.kiosk label{display:grid;margin:1rem 0}.kiosk input{min-height:56px}.reset{position:fixed;inset-block-start:1rem;inset-inline-end:1rem}.admin-exit{position:fixed;inset-block-start:1rem;inset-inline-start:1rem}.warning{position:fixed;inset:20%;display:grid;place-items:center;background:var(--surface);border:4px solid var(--primary);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg)}.primary{min-height:56px;padding:.75rem 1.5rem}.sticky{position:sticky;bottom:1rem;width:100%;box-shadow:var(--shadow-md)}.reset-dialog{border:2px solid var(--primary);border-radius:var(--radius-lg);background:var(--surface);color:var(--text);padding:1.5rem;max-width:min(440px,90vw);box-shadow:var(--shadow-lg)}.reset-dialog::backdrop{background:rgba(0,0,0,.45);overflow:hidden;overscroll-behavior:contain}.reset-dialog:modal{overscroll-behavior:contain}.reset-dialog form{display:flex;gap:1rem;justify-content:flex-end;margin-top:1rem}`]
})
export class KioskPlaceholderComponent {
  readonly store=inject(VoterStore); readonly reset=inject(KioskResetService); readonly inactivity=inject(KioskInactivityService);
  readonly step=this.store.step; readonly ballot=signal<Ballot|null>(null);
  readonly ballotLoading=signal(true); readonly ballotError=signal('');
  readonly resetDialog=viewChild.required<ElementRef<HTMLDialogElement>>('resetDialog');
  private api=inject(ApiService); private router=inject(Router); private thanksTimer?: ReturnType<typeof setTimeout>; private confirmAction: (() => void) | null=null;
  constructor(){
    this.inactivity.start(()=>this.reset.reset());
    effect(()=>{ if (this.step()===0) clearTimeout(this.thanksTimer); });
    inject(DestroyRef).onDestroy(()=>{
      this.inactivity.clear();
      clearTimeout(this.thanksTimer);
      this.confirmAction=null;
    });
    this.loadBallot();
  }
  loadBallot(){
    this.ballotLoading.set(true); this.ballotError.set('');
    void this.api.getBallot()
      .then((ballot)=>{ this.ballot.set(ballot); })
      .catch(()=>{ this.ballotError.set('تعذر تحميل المشاريع. تحقق من الاتصال ثم أعد المحاولة.'); })
      .finally(()=>{ this.ballotLoading.set(false); });
  }
  activity(){ this.inactivity.touch(()=>this.reset.reset()); }
  nameValid(){ const values=Object.values(this.store.name()); return values.every((value)=>/^[ء-ي ]{3,30}$/.test(value.trim())); }
  requestReset(){
    this.confirmAction=()=>this.reset.reset();
    this.requestWithConfirm(this.confirmAction);
  }
  requestAdminExit(){
    this.requestWithConfirm(()=>{ this.store.reset(); void this.router.navigate(['/admin']); });
  }
  private requestWithConfirm(action: () => void){
    if (this.step()>0 && this.step()<4){
      this.confirmAction=action;
      const dialog=this.resetDialog().nativeElement;
      if (typeof dialog.showModal==='function') dialog.showModal(); else dialog.setAttribute('open','');
    } else action();
  }
  onResetDialogClose(){
    const dialog=this.resetDialog().nativeElement; const confirmed=dialog.returnValue==='confirm';
    dialog.returnValue='';
    if (typeof dialog.close==='function') dialog.close(); else dialog.removeAttribute('open');
    const action=this.confirmAction; this.confirmAction=null;
    if (confirmed) action?.();
  }
  async submit(){ this.store.submitting.set(true); try { await this.api.submitKioskVote({requestId:this.store.requestId(),name:this.store.name(),selections:this.store.selections(),confirmDuplicate:this.store.duplicateWarning()}); this.step.set(4); this.thanksTimer=setTimeout(()=>this.reset.reset(),5000); } catch { this.store.submitting.set(false); } }
}
