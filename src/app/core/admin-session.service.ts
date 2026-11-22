import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private api = inject(ApiService);
  readonly isAdmin = signal(false);

  constructor() {
    void this.api.getAdminMe().then(() => this.isAdmin.set(true)).catch(() => this.isAdmin.set(false));
  }
}
