export type VoteSource = 'digital' | 'written' | 'combined' | 'manual';

export interface ProjectVoteInput {
  digitalVotes: number;
  writtenVotes: number;
}

export function calculateProjectVotes(project: ProjectVoteInput, source: VoteSource): number {
  if (source === 'written') return project.writtenVotes;
  if (source === 'combined') return project.digitalVotes + project.writtenVotes;
  if (source === 'digital') return project.digitalVotes;
  return project.digitalVotes;
}

export interface SectionTieRow {
  sectionId: number;
  projectId: number;
  votes: number;
}

/** يعيد معرّفات المشاريع المتعادلة في المركز الأول لكل قسم. */
export function calculateSectionTies(rows: SectionTieRow[]): Record<number, number[]> {
  const bySection = new Map<number, SectionTieRow[]>();
  for (const row of rows) {
    const list = bySection.get(row.sectionId) ?? [];
    list.push(row);
    bySection.set(row.sectionId, list);
  }

  const ties: Record<number, number[]> = {};
  for (const [sectionId, sectionRows] of bySection) {
    const max = Math.max(...sectionRows.map((row) => row.votes));
    if (max <= 0) continue;
    const tied = sectionRows.filter((row) => row.votes === max);
    if (tied.length > 1) ties[sectionId] = tied.map((row) => row.projectId);
  }
  return ties;
}

/** متوافق مع الاستخدام القديم: تعادل المركز الأول على مستوى القائمة المعطاة. */
export function calculateTies(rows: Array<{ projectId: number; votes: number }>): number[] {
  if (!rows.length) return [];
  const max = Math.max(...rows.map((row) => row.votes));
  if (max <= 0) return [];
  return rows.filter((row) => row.votes === max).map((row) => row.projectId);
}

export interface ResultRow {
  sectionId: number;
  sectionName: string;
  projectId: number;
  projectName: string;
  schoolName?: string;
  imageUrl?: string | null;
  votes: number;
  announceInResults?: number;
}

export interface ResultProject {
  project_id: number;
  project_name: string;
  school_name?: string;
  image_url?: string | null;
  votes: number;
}

export interface ResultSection {
  section_id: number;
  section_name: string;
  projects: ResultProject[];
  tiedProjects: number[];
}

/** يجمع صفوف النتائج في أقسام مرتبة، ويستبعد المشاريع غير المحددة للإعلان. */
export function groupResultsBySection(rows: ResultRow[]): ResultSection[] {
  const bySection = new Map<number, { name: string; projects: ResultProject[] }>();

  for (const row of rows) {
    if (row.announceInResults === 0) continue;
    const section = bySection.get(row.sectionId) ?? { name: row.sectionName, projects: [] };
    section.projects.push({
      project_id: row.projectId,
      project_name: row.projectName,
      ...(row.schoolName !== undefined ? { school_name: row.schoolName } : {}),
      ...(row.imageUrl !== undefined ? { image_url: row.imageUrl } : {}),
      votes: row.votes,
    });
    bySection.set(row.sectionId, section);
  }

  return Array.from(bySection, ([sectionId, section]) => {
    const projects = [...section.projects].sort((a, b) => b.votes - a.votes);
    const max = projects.length ? Math.max(...projects.map((project) => project.votes)) : 0;
    const tied = max > 0 ? projects.filter((project) => project.votes === max) : [];
    return {
      section_id: sectionId,
      section_name: section.name,
      projects,
      tiedProjects: tied.length > 1 ? tied.map((project) => project.project_id) : [],
    };
  });
}
