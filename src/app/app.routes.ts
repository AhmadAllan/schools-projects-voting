import { Routes } from '@angular/router';
import { adminGuard, kioskGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./voter/home-shell.component').then((m) => m.HomeShellComponent) },
  { path: 'kiosk', loadComponent: () => import('./kiosk/kiosk-placeholder.component').then((m) => m.KioskPlaceholderComponent), canActivate: [kioskGuard] },
  { path: 'admin/login', loadComponent: () => import('./admin/login-placeholder.component').then((m) => m.LoginPlaceholderComponent) },
  { path: 'admin/sections', loadComponent: () => import('./admin/admin-sections.component').then((m) => m.AdminSectionsComponent), canActivate: [adminGuard] },
  { path: 'admin/schools', loadComponent: () => import('./admin/admin-schools.component').then((m) => m.AdminSchoolsComponent), canActivate: [adminGuard] },
  { path: 'admin/projects', loadComponent: () => import('./admin/admin-projects.component').then((m) => m.AdminProjectsComponent), canActivate: [adminGuard] },
  { path: 'admin/votes', loadComponent: () => import('./admin/votes.component').then((m) => m.VotesComponent), canActivate: [adminGuard] },
  { path: 'admin/voters', loadComponent: () => import('./admin/admin-voters.component').then((m) => m.AdminVotersComponent), canActivate: [adminGuard] },
  { path: 'admin/results', loadComponent: () => import('./admin/admin-results.component').then((m) => m.AdminResultsComponent), canActivate: [adminGuard] },
  { path: 'admin/settings', loadComponent: () => import('./admin/admin-settings.component').then((m) => m.AdminSettingsComponent), canActivate: [adminGuard] },
  { path: 'admin', loadComponent: () => import('./admin/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent), canActivate: [adminGuard] },
  { path: 'winners', loadComponent: () => import('./winners/winners-placeholder.component').then((m) => m.WinnersPlaceholderComponent) },
  { path: 'not-found', loadComponent: () => import('./shared/not-found-placeholder.component').then((m) => m.NotFoundPlaceholderComponent) },
  { path: '**', redirectTo: 'not-found' },
];
