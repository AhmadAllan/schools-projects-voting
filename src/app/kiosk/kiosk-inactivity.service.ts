import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class KioskInactivityService {
  readonly warning = signal(false); readonly countdown = signal(10);
  private idleTimer?: ReturnType<typeof setTimeout>; private warningTimer?: ReturnType<typeof setTimeout>; private countdownTimer?: ReturnType<typeof setInterval>;
  start(onReset: () => void) {
    this.clear();
    this.warningTimer = setTimeout(() => { this.warning.set(true); this.countdown.set(10); this.countdownTimer = setInterval(() => this.countdown.update((n) => Math.max(0, n - 1)), 1000); }, 50_000);
    this.idleTimer = setTimeout(onReset, 60_000);
  }
  clear() { clearTimeout(this.idleTimer); clearTimeout(this.warningTimer); clearInterval(this.countdownTimer); this.warning.set(false); }
  touch(onReset: () => void) { this.start(onReset); }
}
