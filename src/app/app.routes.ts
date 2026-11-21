import { Routes } from '@angular/router';
import { adminGuard, kioskGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./voter/voter-shell.component').then((m) => m.VoterShellComponent) },
  { path: 'kiosk', loadComponent: () => import('./kiosk/kiosk-placeholder.component').then((m) => m.KioskPlaceholderComponent), canActivate: [kioskGuard] },
  { path: 'admin/login', loadComponent: () => import('./admin/login-placeholder.component').then((m) => m.LoginPlaceholderComponent) },
  { path: 'admin', loadComponent: () => import('./admin/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent), canActivate: [adminGuard] },
  { path: 'admin/votes', loadComponent: () => import('./admin/votes.component').then((m) => m.VotesComponent), canActivate: [adminGuard] },
  { path: 'winners', loadComponent: () => import('./winners/winners-placeholder.component').then((m) => m.WinnersPlaceholderComponent) },
  { path: 'not-found', loadComponent: () => import('./shared/not-found-placeholder.component').then((m) => m.NotFoundPlaceholderComponent) },
  { path: '**', redirectTo: 'not-found' },
];
