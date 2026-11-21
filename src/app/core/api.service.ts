import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminProject, AdminSchool, AdminSection, AdminVoter, AdminVotesResponse,
  Ballot, ResultsResponse, ResultSource, SettingsMap, VotingStatus, VoteRequest,
} from './models';

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

  getSections() { return firstValueFrom(this.http.get<AdminSection[]>('/api/admin/sections')); }
  addSection(body: { name: string; description?: string; sort_order?: number }) {
    return firstValueFrom(this.http.post<{error:string;message:string}>('/api/admin/sections', body));
  }
  updateSection(id: number, patch: Partial<Pick<AdminSection, 'name' | 'description' | 'sort_order' | 'is_active'>>) {
    return firstValueFrom(this.http.put<{error:string;message:string}>(`/api/admin/sections/${id}`, patch));
  }

  getSchools() { return firstValueFrom(this.http.get<AdminSchool[]>('/api/admin/schools')); }
  addSchool(name: string) {
    return firstValueFrom(this.http.post<{error:string;message:string}>('/api/admin/schools', { name }));
  }

  getProjects() { return firstValueFrom(this.http.get<AdminProject[]>('/api/admin/projects')); }
  addProject(body: { name: string; description: string; section_id: number; school_id: number; url?: string; image_url?: string; image_id?: number }) {
    return firstValueFrom(this.http.post<{error:string;message:string}>('/api/admin/projects', body));
  }
  updateProject(id: number, patch: Partial<Pick<AdminProject, 'name' | 'description' | 'url' | 'image_url' | 'image_id' | 'is_active'>>) {
    return firstValueFrom(this.http.put<{error:string;message:string}>(`/api/admin/projects/${id}`, patch));
  }
  uploadImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<{id:number}>('/api/admin/images', form));
  }

  getSettings() { return firstValueFrom(this.http.get<SettingsMap>('/api/admin/settings')); }
  saveSettings(payload: SettingsMap) {
    return firstValueFrom(this.http.put<{error:string;message:string}>('/api/admin/settings', payload));
  }

  getVoters() { return firstValueFrom(this.http.get<AdminVoter[]>('/api/admin/voters')); }
  voidVoter(id: string, reason: string) {
    return firstValueFrom(this.http.post<{error:string;message:string}>(`/api/admin/voters/${id}/void`, { reason }));
  }
  restoreVoter(id: string) {
    return firstValueFrom(this.http.post<{error:string;message:string}>(`/api/admin/voters/${id}/restore`, {}));
  }

  getAdminVotes() { return firstValueFrom(this.http.get<AdminVotesResponse>('/api/admin/votes')); }
  setResultsSource(source: ResultSource) {
    return firstValueFrom(this.http.put<{error:string;message:string}>('/api/admin/votes/source', { source }));
  }
  updateProjectVotes(id: number, body: { writtenVotes?: number; announceInResults?: boolean }) {
    return firstValueFrom(this.http.put<{error:string;message:string}>(`/api/admin/votes/${id}`, body));
  }
  setWinner(sectionId: number, projectId: number | null) {
    return projectId === null
      ? firstValueFrom(this.http.delete<{error:string;message:string}>(`/api/admin/winners/${sectionId}`))
      : firstValueFrom(this.http.put<{error:string;message:string}>(`/api/admin/winners/${sectionId}`, { project_id: projectId }));
  }

  reset(scope: 'votes' | 'everything', confirm: string) {
    return firstValueFrom(this.http.post<{error:string;message:string}>('/api/admin/reset', { scope, confirm }));
  }
}
