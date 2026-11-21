import { Injectable, signal } from '@angular/core';
import { VotingStatus } from './models';
@Injectable({ providedIn: 'root' })
export class VotingStatusService {
  readonly status = signal<VotingStatus>({ state: 'closed', opensAt: null, closesAt: null });
  setStatus(status: VotingStatus) { this.status.set(status); }
}
