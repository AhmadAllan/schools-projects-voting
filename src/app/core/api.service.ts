import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Ballot, VotingStatus, VoteRequest, ResultsResponse } from './models';
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  getBallot() { return firstValueFrom(this.http.get<Ballot>('/api/public/ballot')); }
  getStatus() { return firstValueFrom(this.http.get<VotingStatus>('/api/public/status')); }
  submitVote(body: VoteRequest) { return firstValueFrom(this.http.post<{error:string;message:string}>('/api/votes', body)); }
  submitKioskVote(body: VoteRequest) { return firstValueFrom(this.http.post<{error:string;message:string}>('/api/kiosk/votes', body)); }
  getAdminMe() { return firstValueFrom(this.http.get<{authenticated:boolean}>('/api/admin/me')); }
  login(password: string) { return firstValueFrom(this.http.post<{error:string;message:string}>('/api/admin/login', { password })); }
  getPublicResults() { return firstValueFrom(this.http.get<ResultsResponse>('/api/public/results')); }
  getAdminResults() { return firstValueFrom(this.http.get<ResultsResponse>('/api/admin/results')); }
}
