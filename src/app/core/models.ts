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
