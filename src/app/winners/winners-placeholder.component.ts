import { Component, signal } from '@angular/core';
@Component({ standalone:true, template:`<main class="winners"><section><small>الفائز</small><h1>{{title()}}</h1><button (click)="title.set(title() === 'الفائز الأول' ? 'الفائز الثاني' : 'الفائز الأول')">القسم التالي</button></section></main>`, styles:[`.winners{min-height:100dvh;display:grid;place-items:center;text-align:center}.winners section{font-size:clamp(1.5rem,5vw,4rem)}.winners button{min-height:56px}`] })
export class WinnersPlaceholderComponent { readonly title=signal('الفائز الأول'); }
