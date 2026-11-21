import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from './api.service';
async function authenticated(api: ApiService): Promise<boolean> { try { return (await api.getAdminMe()).authenticated; } catch { return false; } }
export const adminGuard: CanActivateFn = async () => {
  const api = inject(ApiService); const router = inject(Router);
  return await authenticated(api) ? true : router.createUrlTree(['/admin/login']);
};
export const kioskGuard: CanActivateFn = async (_route, state) => {
  const api = inject(ApiService); const router = inject(Router);
  return await authenticated(api) ? true : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};
