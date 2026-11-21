export type VotingState = 'not_started' | 'open' | 'closed';
export interface VotingStatus { state: VotingState; opensAt: string | null; closesAt: string | null }
export interface ApiError { error: string; message: string; field?: string }
export interface BallotSection { id: number; name: string; description?: string; sort_order: number }
export interface BallotProject { id: number; name: string; description: string; image_id?: number; image_url?: string; url?: string; section_id: number; school_name: string; logo_image_id?: number }
export interface Ballot { sections: BallotSection[]; projects: BallotProject[] }
export interface NameParts { first: string; father: string; grandfather: string; family: string }
export interface Selection { sectionId: number; projectId: number }
export interface VoteRequest { requestId: string; name: NameParts; selections: Selection[]; confirmDuplicate?: boolean }
export type ResultSource = 'digital' | 'written' | 'combined' | 'manual';
export interface ResultProject { project_id: number; project_name: string; school_name?: string; image_url?: string | null; votes: number }
export interface ResultSection { section_id: number; section_name: string; projects: ResultProject[]; tiedProjects: number[] }
export interface ResultsResponse { source: ResultSource; sections: ResultSection[] }
export interface AdminSection { id: number; name: string; description: string | null; sort_order: number; is_active: number }
export interface AdminSchool { id: number; name: string }
export interface AdminProject {
  id: number; name: string; description: string; image_id: number | null; image_url: string | null; url: string | null;
  section_id: number; school_id: number; section_name: string; school_name: string;
  sort_order: number; is_active: number; written_votes: number; announce_in_results: number;
}
export interface AdminVoter { id: string; full_name: string; channel: 'qr' | 'tablet'; is_duplicate: number; voided: number; void_reason: string | null; created_at: string }
export type SettingsMap = Record<string, string>;
export interface AdminVotesResponse { source: ResultSource; projects: Array<AdminProject & { digital_votes: number; final_votes: number }>; winners: Record<number, number | undefined> }
