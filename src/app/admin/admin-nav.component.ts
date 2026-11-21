import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <nav class="admin-nav" aria-label="تنقل لوحة الإدارة">
    <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">الرئيسية</a>
    <a routerLink="/admin/sections" routerLinkActive="active">الأقسام</a>
    <a routerLink="/admin/schools" routerLinkActive="active">المدارس</a>
    <a routerLink="/admin/projects" routerLinkActive="active">المشاريع</a>
    <a routerLink="/admin/votes" routerLinkActive="active">الأصوات</a>
    <a routerLink="/admin/voters" routerLinkActive="active">الناخبون</a>
    <a routerLink="/admin/results" routerLinkActive="active">النتائج</a>
    <a routerLink="/admin/settings" routerLinkActive="active">الإعدادات</a>
    <a routerLink="/winners">شاشة الإعلان</a>
  </nav>`,
  styles: `:host { display: block; }`,
})
export class AdminNavComponent {}
