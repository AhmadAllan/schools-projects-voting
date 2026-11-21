export type VotingState = 'not_started' | 'open' | 'closed';
export interface VotingStatus { state: VotingState; opensAt: string | null; closesAt: string | null }
export interface ApiError { error: string; message: string; field?: string }
export interface BallotSection { id: number; name: string; description?: string; sort_order: number }
export interface BallotProject { id: number; name: string; description: string; image_id?: number; image_url?: string; url?: string; section_id: number; school_name: string; logo_image_id?: number }
export interface Ballot { sections: BallotSection[]; projects: BallotProject[] }
export interface NameParts { first: string; father: string; grandfather: string; family: string }
export interface Selection { sectionId: number; projectId: number }
export interface VoteRequest { requestId: string; name: NameParts; selections: Selection[]; confirmDuplicate?: boolean }
