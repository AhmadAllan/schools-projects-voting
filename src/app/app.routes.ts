import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./voter/home-placeholder.component').then((m) => m.HomePlaceholderComponent) },
  { path: 'kiosk', loadComponent: () => import('./kiosk/kiosk-placeholder.component').then((m) => m.KioskPlaceholderComponent) },
  { path: 'admin/login', loadComponent: () => import('./admin/login-placeholder.component').then((m) => m.LoginPlaceholderComponent) },
  { path: 'admin', loadComponent: () => import('./admin/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent) },
  { path: 'winners', loadComponent: () => import('./winners/winners-placeholder.component').then((m) => m.WinnersPlaceholderComponent) },
  { path: 'not-found', loadComponent: () => import('./shared/not-found-placeholder.component').then((m) => m.NotFoundPlaceholderComponent) },
  { path: '**', redirectTo: 'not-found' },
];
