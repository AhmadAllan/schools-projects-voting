import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { VoterStore } from '../voter/voter-store.service';
@Injectable({ providedIn: 'root' })
export class KioskResetService {
  private store = inject(VoterStore); private router = inject(Router);
  reset() {
    this.store.reset();
    void this.router.navigate(['/kiosk']);
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
