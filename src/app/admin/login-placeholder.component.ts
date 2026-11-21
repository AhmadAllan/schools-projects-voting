import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
@Component({ standalone:true, imports:[FormsModule], template:`<main class="login"><form (submit)="login()"><h1>تسجيل دخول الإدارة</h1><label>كلمة المرور<input type="password" [(ngModel)]="password" name="password" autocomplete="current-password"></label><button>دخول</button><p>{{error()}}</p></form></main>`, styles:[`.login{min-height:100dvh;display:grid;place-items:center}.login form{width:min(420px,100%);padding:2rem}.login label{display:grid;gap:.5rem}.login input{min-height:56px}`] })
export class LoginPlaceholderComponent { password=''; error=signal(''); private api=inject(ApiService); private router=inject(Router); private route=inject(ActivatedRoute); async login(){ try { await this.api.login(this.password); await this.router.navigate([this.route.snapshot.queryParamMap.get('returnUrl')||'/admin']); } catch { this.error.set('تعذر تسجيل الدخول'); } } }
