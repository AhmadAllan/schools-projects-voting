export interface NameParts { first: string; father: string; grandfather: string; family: string }
export interface Selection { sectionId: number; projectId: number }
export interface VoteRequest { requestId: string; name: NameParts; selections: Selection[]; confirmDuplicate?: boolean }
export interface ApiError { error: string; message: string }
